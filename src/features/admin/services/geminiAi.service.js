const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function enhanceDescriptionWithAi({
  rawText,
  mode = "redaccion",
  productName = "",
  category = "",
}) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "No se ha configurado VITE_GEMINI_API_KEY en las variables de entorno.",
    );
  }

  const isRedaccion = mode === "redaccion";

  const systemInstruction = isRedaccion
    ? `Eres el redactor comercial exclusivo de ERXIDI, tienda de ropa interior y calcetería de algodón Pima peruano.
Tu objetivo es entregar una descripción de producto impecable, seductora, fluida y 100% en español.
Enfócate en la sensación al tacto, calce anatómico diario, frescura y resistencia de la confección.
REGLAS ESTRICTAS DE RESPUESTA:
1. Responde DIRECTAMENTE con el texto final de la descripción (2 a 3 oraciones completas y bien puntuadas).
2. Prohibido incluir notas, comentarios sobre el borrador, saludos o introducciones en inglés o español.
3. Prohibido dejar oraciones incompletas o cortar palabras.
4. Prohibido usar comillas al inicio o al final.`
    : `Eres el especialista en catálogo técnico y comercial de ERXIDI.
Tu objetivo es transformar el borrador en una ficha estructurada y persuasiva en español:
1. Una oración inicial contundente que resuma el beneficio de la prenda.
2. Exactamente 3 o 4 viñetas (usando el símbolo •) detallando:
   • Composición textil y suavidad del algodón Pima
   • Pretina elástica y soporte ergonómico
   • Respirabilidad y frescura prolongada
   • Durabilidad y acabados de confección
REGLAS ESTRICTAS DE RESPUESTA:
1. Responde DIRECTAMENTE con la oración y las viñetas terminadas.
2. Prohibido incluir análisis, introducciones o textos explicativos.`;

  const prompt = `Prenda: "${productName || "Prenda íntima"}"
Categoría: "${category || "Ropa interior"}"
Borrador a transformar:
"""
${rawText?.trim() || "Prenda cómoda de alta calidad confeccionada en algodón para uso diario."}
"""`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemInstruction }, { text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 1200,
    },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || "Error de comunicación con Gemini AI",
    );
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Limpieza estricta de salida
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }

  if (!text) return rawText;
  return text;
}

/**
 * Pipeline Real de Estudio Fotográfico:
 * Segmenta la prenda por muestreo perimetral de fondo, remueve superficies cotidianas y
 * encuadra la silueta sobre lienzo blanco 4:5 (#FFFFFF) con sombra de contacto difusa.
 */
export async function processStudioPhoto({
  imageFile,
  perspective = "frontal",
}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
      img.onload = () => {
        try {
          // 1. Canvas de análisis y aislamiento
          const analysisCanvas = document.createElement("canvas");
          const aWidth = Math.min(img.width, 1000);
          const aHeight = Math.round(img.height * (aWidth / img.width));
          analysisCanvas.width = aWidth;
          analysisCanvas.height = aHeight;
          const aCtx = analysisCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          aCtx.drawImage(img, 0, 0, aWidth, aHeight);

          const imgData = aCtx.getImageData(0, 0, aWidth, aHeight);
          const data = imgData.data;

          // Muestreo perimetral del color de fondo (esquinas exteriores)
          const cornerIndices = [
            0,
            (aWidth - 1) * 4,
            (aHeight - 1) * aWidth * 4,
            ((aHeight - 1) * aWidth + (aWidth - 1)) * 4,
          ];

          let bgR = 0,
            bgG = 0,
            bgB = 0;
          cornerIndices.forEach((idx) => {
            bgR += data[idx];
            bgG += data[idx + 1];
            bgB += data[idx + 2];
          });
          bgR = Math.round(bgR / cornerIndices.length);
          bgG = Math.round(bgG / cornerIndices.length);
          bgB = Math.round(bgB / cornerIndices.length);

          // Umbral de tolerancia de color euclidiano para segmentar el fondo
          const threshold = 55;
          let minX = aWidth,
            minY = aHeight,
            maxX = 0,
            maxY = 0;
          let hasForeground = false;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const dist = Math.sqrt(
              (r - bgR) * (r - bgR) +
                (g - bgG) * (g - bgG) +
                (b - bgB) * (b - bgB),
            );

            // Si está dentro del rango del color del fondo, hacerlo transparente
            if (dist < threshold) {
              data[i + 3] = 0; // Canal Alpha a 0
            } else {
              // Píxel perteneciente a la prenda
              const pixelIndex = i / 4;
              const px = pixelIndex % aWidth;
              const py = Math.floor(pixelIndex / aWidth);

              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
              hasForeground = true;
            }
          }

          aCtx.putImageData(imgData, 0, 0);

          // 2. Lienzo final de Estudio Fotográfico en Proporción Estándar 4:5
          const studioCanvas = document.createElement("canvas");
          studioCanvas.width = 800;
          studioCanvas.height = 1000;
          const sCtx = studioCanvas.getContext("2d");

          // Fondo blanco puro de catálogo
          sCtx.fillStyle = "#FFFFFF";
          sCtx.fillRect(0, 0, studioCanvas.width, studioCanvas.height);

          // Sombra de contacto difusa inferior
          sCtx.save();
          sCtx.filter = "blur(14px)";
          sCtx.fillStyle = "rgba(15, 23, 42, 0.14)";
          sCtx.beginPath();
          sCtx.ellipse(400, 830, 230, 26, 0, 0, 2 * Math.PI);
          sCtx.fill();
          sCtx.restore();

          // Encuadre y escalado proporcionado de la prenda aislada
          if (hasForeground && maxX > minX && maxY > minY) {
            const cropW = maxX - minX;
            const cropH = maxY - minY;
            const maxAllowedW = 660;
            const maxAllowedH = 760;
            const scale = Math.min(maxAllowedW / cropW, maxAllowedH / cropH);

            const destW = cropW * scale;
            const destH = cropH * scale;
            const destX = (studioCanvas.width - destW) / 2;
            const destY = (studioCanvas.height - destH) / 2 - 20;

            sCtx.drawImage(
              analysisCanvas,
              minX,
              minY,
              cropW,
              cropH,
              destX,
              destY,
              destW,
              destH,
            );
          } else {
            // Respaldo proporcionado con encuadre limpio
            const scale = Math.min(680 / aWidth, 780 / aHeight);
            const destW = aWidth * scale;
            const destH = aHeight * scale;
            const destX = (studioCanvas.width - destW) / 2;
            const destY = (studioCanvas.height - destH) / 2 - 20;
            sCtx.drawImage(analysisCanvas, destX, destY, destW, destH);
          }

          // Generación de archivo y URL
          studioCanvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Error al exportar blob de estudio fotográfico."));
              return;
            }
            const cleanFile = new File(
              [blob],
              `erxidi-estudio-${perspective}-${Date.now()}.png`,
              { type: "image/png" },
            );
            const previewUrl = URL.createObjectURL(blob);
            resolve({ file: cleanFile, previewUrl });
          }, "image/png");
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
  });
}
