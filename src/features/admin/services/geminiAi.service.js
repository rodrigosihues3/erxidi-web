const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const IMAGEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Convierte un File a Base64 puro (sin prefijo data URL)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  const response = await fetch(GEMINI_TEXT_URL, {
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
 * Pipeline de Estudio Fotográfico IA:
 * 1. Analiza prenda original con Gemini 2.5 Flash.
 * 2. Genera nueva toma de catálogo con Imagen 3 en relación 4:5.
 * 3. Respaldo transparente en Canvas 4:5 con fondo blanco y sombra si la API falla.
 */
export async function processStudioPhoto({
  imageFile,
  perspective = "frontal",
  productName = "",
  colorName = "",
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY no está configurada.");
  }

  try {
    const base64Image = await fileToBase64(imageFile);

    // 1. Análisis visual de la prenda con Gemini Vision
    const visionPayload = {
      contents: [
        {
          parts: [
            {
              text: "Describe con precisión la prenda de esta foto: color exacto, tipo de corte (bóxer, trusa, top, etc.), pretina elástica y textura de tela. Responde en 1 sola oración concisa en inglés.",
            },
            {
              inline_data: {
                mime_type: imageFile.type || "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
    };

    const visionRes = await fetch(GEMINI_TEXT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visionPayload),
    });

    let visualDescription = `${colorName || "colored"} underwear garment, premium cotton`;
    if (visionRes.ok) {
      const visionData = await visionRes.json();
      visualDescription =
        visionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        visualDescription;
    }

    // 2. Mapeo de perspectiva
    const perspectivePrompts = {
      frontal: "clean straight front view, flat lay or invisible mannequin",
      "3/4 Der.": "dynamic three-quarters right angle perspective view",
      "3/4 Izq.": "dynamic three-quarters left angle perspective view",
      espalda: "back view showing rear waistband and seamless construction",
    };
    const angleText = perspectivePrompts[perspective] || "studio front view";

    // 3. Solicitud a Imagen 3
    const prompt = `Professional commercial e-commerce product photograph of a ${visualDescription}, ${angleText}, isolated on pure solid white background (#FFFFFF), soft subtle contact drop shadow underneath, crisp studio softbox lighting, centered composition, high-end catalog presentation, 8k resolution, photorealistic.`;

    const imagenPayload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "4:5",
        outputOptions: { mimeType: "image/jpeg" },
      },
    };

    const imagenRes = await fetch(IMAGEN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imagenPayload),
    });

    if (imagenRes.ok) {
      const imagenData = await imagenRes.json();
      const b64Result = imagenData.predictions?.[0]?.bytesBase64Encoded;
      if (b64Result) {
        const byteCharacters = atob(b64Result);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "image/jpeg" });
        const cleanFile = new File(
          [blob],
          `estudio-ia-${perspective}-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        );
        const previewUrl = URL.createObjectURL(blob);
        return { file: cleanFile, previewUrl };
      }
    }
  } catch (err) {
    console.warn(
      "Fallo en pipeline Imagen 3, recurriendo a aislamiento local:",
      err,
    );
  }

  // Respaldo seguro en Canvas 4:5
  return fallbackCanvasStudio(imageFile, perspective);
}

function fallbackCanvasStudio(imageFile, perspective) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 1000;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.filter = "blur(14px)";
        ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
        ctx.beginPath();
        ctx.ellipse(400, 830, 240, 26, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        const scale = Math.min(680 / img.width, 780 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2 - 20;

        ctx.drawImage(img, x, y, w, h);

        canvas.toBlob((blob) => {
          const cleanFile = new File(
            [blob],
            `estudio-${perspective}-${Date.now()}.png`,
            { type: "image/png" },
          );
          const previewUrl = URL.createObjectURL(blob);
          resolve({ file: cleanFile, previewUrl });
        }, "image/png");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
  });
}
