import { useMemo, useState } from "react";
import { Plus, Trash2, Pipette, X, Palette } from "lucide-react";
import Button from "../../../components/ui/Button";

const QUICK_PRESETS = [
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Negro", hex: "#111827" },
  { name: "Nude", hex: "#E8C8B5" },
  { name: "Rosado", hex: "#F472B6" },
  { name: "Azul Marino", hex: "#0F172A" },
  { name: "Gris Jaspe", hex: "#6B7280" },
  { name: "Vino", hex: "#881337" },
];

export default function VariantMatrix({ sizes, variants, onChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#E8C8B5");
  const [error, setError] = useState("");

  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter(Boolean))],
    [variants],
  );

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  // Activa la pipeta nativa de pantalla
  async function handlePickFromScreen() {
    if (!hasEyeDropper) {
      window.alert(
        "La herramienta cuentagotas requiere Chrome, Edge u Opera en escritorio.",
      );
      return;
    }
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result?.sRGBHex) {
        setColorHex(result.sRGBHex.toUpperCase());
      }
    } catch {
      // Cancelado por el usuario con tecla Escape
    }
  }

  function handleAddColorSubmit(e) {
    e.preventDefault();
    const cleanName = colorName.trim();
    if (!cleanName) {
      setError("Ingresa el nombre descriptivo del color.");
      return;
    }

    if (colors.some((item) => item.toLowerCase() === cleanName.toLowerCase())) {
      setError(`El color "${cleanName}" ya está registrado en la matriz.`);
      return;
    }

    let cleanHex = colorHex.trim();
    if (!cleanHex.startsWith("#")) cleanHex = `#${cleanHex}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      cleanHex = "#111827";
    }

    const next = sizes.map((size) => ({
      product_id: null,
      size_id: size.id,
      color: cleanName,
      color_hex: cleanHex.toUpperCase(),
      stock: 0,
      sku: `${cleanName.slice(0, 3).toUpperCase()}-${size.name}-${Date.now().toString().slice(-5)}-${size.id}`,
      is_active: true,
    }));

    onChange([...variants, ...next]);
    setIsModalOpen(false);
    setColorName("");
    setColorHex("#E8C8B5");
    setError("");
  }

  function removeColor(color) {
    onChange(variants.filter((variant) => variant.color !== color));
  }

  function updateColorHex(color, newHex) {
    onChange(
      variants.map((variant) =>
        variant.color === color ? { ...variant, color_hex: newHex } : variant,
      ),
    );
  }

  function updateCell(color, sizeId, field, rawValue) {
    onChange(
      variants.map((variant) => {
        if (
          variant.color !== color ||
          Number(variant.size_id) !== Number(sizeId)
        )
          return variant;
        return {
          ...variant,
          [field]:
            field === "stock" ? Math.max(0, Number(rawValue) || 0) : rawValue,
        };
      }),
    );
  }

  if (!sizes.length) {
    return (
      <p className="text-sm text-brand-secondary">
        No hay tallas activas configuradas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-brand-primary">
            Variantes por talla y color
          </p>
          <p className="text-xs text-brand-muted">
            El stock se administra por combinación.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Color
        </Button>
      </div>

      {colors.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-6 text-center text-sm text-brand-secondary">
          Agrega el primer color para crear la matriz.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="text-left p-3">Color / Tono</th>
                {sizes.map((size) => (
                  <th key={size.id} className="p-3 text-left">
                    {size.name}
                  </th>
                ))}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => {
                const currentVariant = variants.find((v) => v.color === color);
                const currentColorHex = currentVariant?.color_hex || "#111827";

                return (
                  <tr key={color} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={currentColorHex}
                          onChange={(e) =>
                            updateColorHex(color, e.target.value)
                          }
                          className="w-7 h-7 rounded-full border border-border cursor-pointer p-0 bg-transparent shrink-0"
                          title="Clic para cambiar el tono de este color"
                        />
                        <div>
                          <span className="font-semibold block leading-tight text-brand-primary">
                            {color}
                          </span>
                          <span className="text-[10px] font-mono text-brand-muted uppercase">
                            {currentColorHex}
                          </span>
                        </div>
                      </div>
                    </td>
                    {sizes.map((size) => {
                      const variant = variants.find(
                        (v) =>
                          v.color === color &&
                          Number(v.size_id) === Number(size.id),
                      );
                      return (
                        <td key={size.id} className="p-3">
                          {variant ? (
                            <div className="space-y-2">
                              <input
                                type="number"
                                min="0"
                                value={variant.stock}
                                onChange={(e) =>
                                  updateCell(
                                    color,
                                    size.id,
                                    "stock",
                                    e.target.value,
                                  )
                                }
                                className="w-24 h-9 px-2 border border-border rounded-button text-sm"
                              />
                              <input
                                type="text"
                                value={variant.sku}
                                onChange={(e) =>
                                  updateCell(
                                    color,
                                    size.id,
                                    "sku",
                                    e.target.value,
                                  )
                                }
                                className="w-32 h-9 px-2 border border-border rounded-button text-xs font-mono"
                                placeholder="SKU"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-brand-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeColor(color)}
                        className="p-2 rounded-button text-red-600 hover:bg-red-50"
                        title="Eliminar este color de la matriz"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para Agregar Color con Selector, Pipeta y Presets */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white border border-border rounded-card p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-bold text-brand-primary">
                  Registrar Nuevo Color
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-brand-muted hover:text-brand-primary p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 p-2 rounded">
                {error}
              </p>
            )}

            <form onSubmit={handleAddColorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1">
                  Nombre del Color
                </label>
                <input
                  type="text"
                  placeholder="Ej. Nude, Rosado, Gris Jaspe"
                  value={colorName}
                  onChange={(e) => {
                    setColorName(e.target.value);
                    setError("");
                  }}
                  className="w-full h-10 px-3 border border-border rounded-button text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1">
                  Tono Visual (Hexadecimal)
                </label>
                <div className="flex items-center gap-2">
                  {/* Selector visual nativo */}
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                    className="w-10 h-10 p-0 border border-border rounded-button cursor-pointer shrink-0"
                    title="Abrir paleta de colores"
                  />

                  {/* Input textual de Hexadecimal */}
                  <input
                    type="text"
                    value={colorHex}
                    maxLength={7}
                    onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                    className="flex-1 h-10 px-3 border border-border rounded-button text-sm font-mono uppercase"
                    placeholder="#RRGGBB"
                    required
                  />

                  {/* Botón Pipeta (EyeDropper sobre la pantalla/imágenes) */}
                  {hasEyeDropper && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handlePickFromScreen}
                      className="h-10 px-3 flex items-center gap-1.5 shrink-0"
                      title="Capturar color de la imagen o pantalla con pipeta"
                    >
                      <Pipette className="w-4 h-4 text-accent" />
                      <span className="text-xs">Pipeta</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Atajos Rápidos */}
              <div>
                <span className="block text-[11px] font-semibold text-brand-muted mb-2">
                  Atajos rápidos de confección:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setColorName(preset.name);
                        setColorHex(preset.hex);
                        setError("");
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-badge border border-border text-xs hover:border-brand-primary transition-colors bg-surface-subtle"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Agregar a Matriz
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
