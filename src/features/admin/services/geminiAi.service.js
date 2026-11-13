const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

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
4. Prohibido usar comillas al inicio o al final.
5. PROHIBIDO usar formato Markdown con asteriscos (**). Escribe únicamente texto limpio.`
    : `Eres el especialista en catálogo técnico y comercial de ERXIDI.
Tu objetivo es transformar el borrador en una ficha estructurada y persuasiva en español:
1. Una oración inicial contundente que resuma el beneficio de la prenda.
2. Exactamente 3 o 4 viñetas detallando:
   • Composición textil y suavidad del algodón Pima
   • Pretina elástica y soporte ergonómico
   • Respirabilidad y frescura prolongada
   • Durabilidad y acabados de confección
REGLAS ESTRICTAS DE RESPUESTA:
1. Responde DIRECTAMENTE con la oración y las viñetas terminadas.
2. Para listas estructuradas, utiliza exclusivamente el símbolo • seguido de un espacio al inicio de cada línea.
3. PROHIBIDO usar formato Markdown con asteriscos (**). Escribe únicamente texto limpio.
4. Prohibido incluir análisis, introducciones o textos explicativos.`;

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
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingBudget: 0,
      },
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

  // Limpieza estricta de salida y eliminación de asteriscos Markdown residuales
  text = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .replace(/\*\*/g, "")
    .trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }

  if (!text) return rawText;
  return text;
}

export async function validateGarmentImage({
  imageFile,
  expectedCategory = "",
}) {
  if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY no configurada.");

  const base64 = await fileToBase64(imageFile);
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Analiza esta imagen para una tienda textil.
Categoría esperada del producto actual: "${expectedCategory || "Ropa interior"}".
Determina:
1. Si la imagen muestra una prenda textil real (isValid: true/false).
2. Qué prenda es (detectedGarment: nombre en español, ej. Calcetín, Bóxer, Trusa, etc.).
3. Si la prenda coincide conceptualmente con la categoría esperada (matchesCategory: true/false).
4. Resumen descriptivo corto (summary).
5. Explicación si no es prenda (reason).
Responde exclusivamente en JSON válido:
{
  "isValid": boolean,
  "detectedGarment": "string",
  "matchesCategory": boolean,
  "summary": "string",
  "reason": "string"
}`,
          },
          {
            inline_data: {
              mime_type: imageFile.type || "image/jpeg",
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(GEMINI_TEXT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      isValid: true,
      matchesCategory: true,
      summary: "Prenda textil admitida.",
    };
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      isValid: true,
      matchesCategory: true,
      summary: "Prenda textil admitida.",
    };
  }
}

export async function processStudioPhoto({
  imageFile,
  perspective = "frontal",
  colorName = "",
}) {
  if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY no configurada.");

  const base64 = await fileToBase64(imageFile);

  // 1. Análisis visual autónomo de la prenda (sin depender del nombre del producto)
  const visionPayload = {
    contents: [
      {
        parts: [
          {
            text: `Examina con precisión los píxeles de esta foto. Identifica la prenda real (ej. bóxer, calcetín/media, trusa, top, etc.), su corte exacto, su color predominante y los detalles textiles. Describe la prenda en 1 oración concreta en inglés enfocándote en su silueta física, pretina y texturas.`,
          },
          {
            inline_data: {
              mime_type: imageFile.type || "image/jpeg",
              data: base64,
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

  let detectedGarment = `${colorName || "colored"} apparel garment`;
  if (visionRes.ok) {
    const vData = await visionRes.json();
    detectedGarment =
      vData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      detectedGarment;
  }

  // 2. Mapeo de perspectiva
  const perspectiveMap = {
    frontal:
      "clean straight front view, flat lay or floating invisible ghost mannequin",
    "3/4 Der.":
      "dynamic three-quarters angle perspective view from the right side",
    "3/4 Izq.":
      "dynamic three-quarters angle perspective view from the left side",
    espalda:
      "rear back view showing seamless posterior construction and waistband details",
  };

  const angleInstruction =
    perspectiveMap[perspective] || "studio straight front view";

  // 3. Prompt estricto de estudio fotográfico
  const prompt = `High-end commercial e-commerce product photograph of this exact physical garment: ${detectedGarment}, ${angleInstruction}, presented in a pristine ghost mannequin floating style. Seamless pure solid white background (#FFFFFF). NO floor shadow, NO drop shadow, clean floating suspension. Studio softbox lighting, crisp fabric weave, realistic tension folds. CRITICAL: Preserve all original waistband text, branded typography and graphic prints exactly as they appear in the original image. Photorealistic, 8k resolution catalog presentation.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: imageFile.type || "image/jpeg",
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      imageConfig: {
        aspectRatio: "4:5",
      },
    },
  };

  const res = await fetch(GEMINI_IMAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (
      errData.error?.message?.toUpperCase().includes("SAFETY") ||
      errData.promptFeedback?.blockReason === "SAFETY"
    ) {
      const safetyError = new Error("RESTRICCION_COPYRIGHT");
      safetyError.code = "SAFETY_RESTRICTION";
      safetyError.details =
        "La prenda contiene ilustraciones, logotipos o elementos protegidos por derechos de autor o marcas comerciales (copyright). Por políticas de propiedad intelectual, no es posible generar una toma sintética de estudio.";
      throw safetyError;
    }
    throw new Error(
      errData.error?.message || "Error al conectar con el motor de imagen.",
    );
  }

  const data = await res.json();

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const inlineData = candidate?.content?.parts?.find(
    (p) => p.inlineData || p.inline_data,
  );
  const base64Data =
    inlineData?.inlineData?.data ||
    inlineData?.inline_data?.data ||
    inlineData?.data;

  // Si Google bloqueó por políticas de marca/copyright o no devolvió binarios
  if (
    finishReason === "SAFETY" ||
    data.promptFeedback?.blockReason === "SAFETY" ||
    !base64Data
  ) {
    const safetyError = new Error("RESTRICCION_COPYRIGHT");
    safetyError.code = "SAFETY_RESTRICTION";
    safetyError.details =
      "La prenda contiene ilustraciones, personajes o marcas comerciales con derechos de autor protegidos (copyright). Por políticas de propiedad intelectual de Google, no es posible generar una toma sintética de estudio.";
    throw safetyError;
  }

  const mimeType =
    inlineData?.inlineData?.mimeType ||
    inlineData?.inline_data?.mime_type ||
    "image/jpeg";

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const cleanFile = new File(
    [blob],
    `estudio-${perspective}-${Date.now()}.jpg`,
    { type: mimeType },
  );
  const previewUrl = URL.createObjectURL(blob);
  return { file: cleanFile, previewUrl };
}
