import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import Button from "../../../components/ui/Button";
import { uploadProductImage } from "../services/adminProducts.service";

export default function ProductDropzone({ value = [], onChange, maxFiles = 6 }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {}, []);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, maxFiles - value.length));
    if (!files.length) return;

    setError("");
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadProductImage(file));
      }
      onChange([...value, ...uploaded.map((item) => item.url)]);
    } catch (err) {
      setError(err.message || "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  function remove(index) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-card p-6 text-center transition ${dragging ? "border-accent bg-accent-light/20" : "border-border bg-surface-subtle"}`}
      >
        <ImagePlus className="mx-auto h-8 w-8 text-brand-muted" />
        <p className="mt-2 text-sm font-semibold">Arrastra imágenes aquí</p>
        <p className="mt-1 text-xs text-brand-muted">JPG, PNG o WebP · máximo {maxFiles}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()} isLoading={uploading}>
          <Upload className="h-4 w-4 mr-2" />
          Seleccionar imágenes
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-xs font-medium text-status-danger-text">{error}</p>}

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-square rounded-button overflow-hidden border border-border bg-surface-subtle">
              <img src={url} alt={`Producto ${index + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 text-red-600 flex items-center justify-center shadow">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
