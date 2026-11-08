import jsQR from "jsqr";

/**
 * Procesa un archivo de imagen, localiza los patrones del código QR y devuelve
 * un Blob cuadrado 1:1 centrado con fondo blanco puro.
 * @param {File} file - Archivo de imagen subido (afiche, captura de pantalla, etc.)
 * @returns {Promise<{ blob: Blob, previewUrl: string }>}
 */
export async function cropQrCode(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("El archivo seleccionado no es una imagen válida."));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 1. Dibujar imagen completa en un canvas de inspección
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 2. Localizar matriz del QR con jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (!code || !code.location) {
          return reject(
            new Error(
              "No se detectó un código QR legible en la imagen. Sube una captura más nítida o centrada."
            )
          );
        }

        // 3. Delimitar bounding box a partir de los 4 vértices del QR
        const loc = code.location;
        const minX = Math.min(
          loc.topLeftCorner.x,
          loc.bottomLeftCorner.x
        );
        const maxX = Math.max(
          loc.topRightCorner.x,
          loc.bottomRightCorner.x
        );
        const minY = Math.min(
          loc.topLeftCorner.y,
          loc.topRightCorner.y
        );
        const maxY = Math.max(
          loc.bottomLeftCorner.y,
          loc.bottomRightCorner.y
        );

        const qrWidth = maxX - minX;
        const qrHeight = maxY - minY;

        // 4. Agregar margen de respiración blanco (quiet zone del 12%)
        const padding = Math.max(20, Math.round(Math.max(qrWidth, qrHeight) * 0.12));
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(canvas.width - cropX, qrWidth + padding * 2);
        const cropHeight = Math.min(canvas.height - cropY, qrHeight + padding * 2);

        // 5. Dimensionar canvas de salida cuadrado a 512x512 píxeles
        const outCanvas = document.createElement("canvas");
        outCanvas.width = 512;
        outCanvas.height = 512;
        const outCtx = outCanvas.getContext("2d");

        // Fondo blanco puro (#FFFFFF) para eliminar bordes morados o de colores
        outCtx.fillStyle = "#FFFFFF";
        outCtx.fillRect(0, 0, 512, 512);

        outCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          512,
          512
        );

        outCanvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("Error al procesar el archivo final del QR."));
            }
            const previewUrl = URL.createObjectURL(blob);
            resolve({ blob, previewUrl });
          },
          "image/png",
          1.0
        );
      };

      img.onerror = () => reject(new Error("No se pudo cargar la imagen para escaneo."));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error("Error al leer el archivo desde el disco."));
    reader.readAsDataURL(file);
  });
}

export const cropQrImage = cropQrCode;
export default cropQrCode;
