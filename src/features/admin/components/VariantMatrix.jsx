import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pipette, X, Palette, Check } from "lucide-react";
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

function buildSku(colorName, sizeName, sizeId) {
  const prefix =
    colorName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase() || "COL";
  const suffix = Date.now().toString().slice(-5);
  return [prefix, sizeName, suffix, sizeId].join("-");
}

export default function VariantMatrix({
  sizes = [],
  variants = [],
  targetGender = "hombre",
  activeColor: externalActiveColor,
  onActiveColorChange,
  onDropImageToColor,
  onChange,
}) {
  const [isAddColorOpen, setIsAddColorOpen] = useState(false);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#E8C8B5");
  const [error, setError] = useState("");
  const [copiedHex, setCopiedHex] = useState(null);
  const [dragOverColor, setDragOverColor] = useState(null);
  const colorNameInputRef = useRef(null);

  useEffect(() => {
    if (isAddColorOpen) {
      colorNameInputRef.current?.focus();
    }
  }, [isAddColorOpen]);

  // 1. Filtrar tallas correspondientes al público seleccionado de forma estricta
  const audienceSizes = useMemo(() => {
    if (!Array.isArray(sizes) || sizes.length === 0) return [];

    return sizes.filter((s) => {
      if (s.is_active === false) return false;
      if (!Array.isArray(s.target_genders)) return false;
      return s.target_genders.includes(targetGender);
    });
  }, [sizes, targetGender]);

  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter(Boolean))],
    [variants],
  );

  // Estado del Color Seleccionado (sincronizado con prop externa o local)
  const [internalSelectedColor, setInternalSelectedColor] = useState(
    colors[0] || "",
  );
  const selectedColor =
    externalActiveColor !== undefined
      ? externalActiveColor
      : internalSelectedColor;

  function handleSelectColor(color) {
    setInternalSelectedColor(color);
    if (onActiveColorChange) {
      onActiveColorChange(color);
    }
  }

  useEffect(() => {
    if (colors.length > 0) {
      if (!colors.includes(selectedColor)) {
        handleSelectColor(colors[0]);
      }
    } else if (selectedColor !== "") {
      handleSelectColor("");
    }
  }, [colors, selectedColor]);

  // Sincronizar celdas existentes cuando cambia el público objetivo (targetGender)
  useEffect(() => {
    if (colors.length === 0 || audienceSizes.length === 0) return;

    const validSizeIdSet = new Set(audienceSizes.map((s) => Number(s.id)));
    const filteredVariants = variants.filter((v) =>
      validSizeIdSet.has(Number(v.size_id)),
    );
    const missingCells = [];

    for (const color of colors) {
      const sample = variants.find((v) => v.color === color);
      for (const size of audienceSizes) {
        const sizeId = Number(size.id);
        const exists = filteredVariants.some(
          (v) => v.color === color && Number(v.size_id) === sizeId,
        );
        if (!exists) {
          missingCells.push({
            product_id: sample?.product_id ?? null,
            size_id: sizeId,
            color,
            color_hex: sample?.color_hex || "#111827",
            stock: 0,
            sku: buildSku(color, size.name, sizeId),
            image_url: sample?.image_url || null,
            is_active: true,
          });
        }
      }
    }

    if (
      missingCells.length > 0 ||
      filteredVariants.length !== variants.length
    ) {
      onChange([...filteredVariants, ...missingCells]);
    }
  }, [targetGender, audienceSizes]);

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

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

  async function handleCopyHex(hex) {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => {
        setCopiedHex((curr) => (curr === hex ? null : curr));
      }, 2000);
    } catch {
      // Fallback si el navegador no concede permisos de portapapeles
    }
  }

  function handleAddColorSubmit(e) {
    if (e) e.preventDefault();
    const cleanName = colorName.trim();
    if (!cleanName) {
      setError("Ingresa el nombre descriptivo del color.");
      return;
    }

    if (colors.some((item) => item.toLowerCase() === cleanName.toLowerCase())) {
      setError('El color "' + cleanName + '" ya está registrado en la matriz.');
      return;
    }

    if (audienceSizes.length === 0) {
      setError("No hay tallas configuradas para el público objetivo seleccionado.");
      return;
    }

    let cleanHex = colorHex.trim();
    if (!cleanHex.startsWith("#")) cleanHex = "#" + cleanHex;
    if (!/^#[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      cleanHex = "#111827";
    }

    const next = audienceSizes.map((size) => ({
      product_id: null,
      size_id: size.id,
      color: cleanName,
      color_hex: cleanHex.toUpperCase(),
      stock: 0,
      sku: buildSku(cleanName, size.name, size.id),
      image_url: null,
      is_active: true,
    }));

    onChange([...variants, ...next]);
    handleSelectColor(cleanName);
    setIsAddColorOpen(false);
    setColorName("");
    setColorHex("#E8C8B5");
    setError("");
  }

  function handleCloseAddColor() {
    setIsAddColorOpen(false);
    setColorName("");
    setColorHex("#E8C8B5");
    setError("");
  }

  function handlePanelKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleAddColorSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCloseAddColor();
    }
  }

  function removeColor(color) {
    if (
      !window.confirm(
        `¿Eliminar el color "${color}" y todas sus variantes de la matriz?`,
      )
    ) {
      return;
    }
    onChange(variants.filter((variant) => variant.color !== color));
  }

  function updateCell(color, sizeId, field, rawValue) {
    onChange(
      variants.map((variant) => {
        if (
          variant.color !== color ||
          Number(variant.size_id) !== Number(sizeId)
        ) {
          return variant;
        }
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-brand-primary">
          Variantes e Inventario por Color
        </p>
      </div>

      {/* B. Pastillas de Color con Receptor Drop Nativo */}
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => {
          const sample = variants.find((v) => v.color === color);
          const currentColorHex = sample?.color_hex || "#111827";
          const isSelected = selectedColor === color;

          return (
            <div
              key={color}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={() => setDragOverColor(color)}
              onDragLeave={() => setDragOverColor(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColor(null);
                const draggedUrl = e.dataTransfer.getData("text/plain");
                if (draggedUrl && onDropImageToColor) {
                  onDropImageToColor(draggedUrl, color);
                }
              }}
              className={`rounded-button border overflow-hidden inline-flex items-stretch shadow-xs transition-all ${
                dragOverColor === color
                  ? "ring-2 ring-accent border-accent scale-105 bg-amber-50/50"
                  : isSelected
                  ? "border-accent ring-2 ring-accent/30 scale-[1.03] shadow-sm z-10"
                  : "border-border hover:border-border-strong opacity-85 hover:opacity-100"
              }`}
            >
              {/* 1. Bloque Swatch (Copia Hex): */}
              <button
                type="button"
                onClick={() => handleCopyHex(currentColorHex)}
                style={{ backgroundColor: currentColorHex }}
                className="w-7 min-h-[32px] flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 border-r border-border/40"
                title={`Copiar tono: ${currentColorHex}`}
              >
                {copiedHex === currentColorHex && (
                  <Check className="w-3 h-3 text-white drop-shadow-md" />
                )}
              </button>

              {/* 2. Bloque Texto (Fondo blanco siempre): */}
              <button
                type="button"
                onClick={() => handleSelectColor(color)}
                className="px-3 py-1.5 text-xs font-bold bg-white text-brand-primary hover:bg-slate-50 transition-colors flex items-center"
              >
                {color}
              </button>

              {/* 3. Bloque Eliminar (X con hover rojo): */}
              <button
                type="button"
                onClick={() => removeColor(color)}
                className="px-2 flex items-center justify-center border-l border-border/40 text-slate-400 hover:bg-rose-600 hover:text-white bg-slate-50 transition-colors"
                title={`Eliminar color ${color}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setIsAddColorOpen((prev) => !prev);
          }}
          className="h-8 px-3 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Color
        </Button>
      </div>

      {/* Panel Desplegable Inline para Registrar Nuevo Color */}
      {isAddColorOpen && (
        <div
          className="mt-3 p-4 rounded-card border border-border bg-surface-subtle/70 space-y-3 animate-in fade-in duration-150"
          onKeyDown={handlePanelKeyDown}
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                Registrar Nuevo Color
              </span>
            </div>
            <button
              type="button"
              onClick={handleCloseAddColor}
              className="text-slate-400 hover:text-brand-primary p-1 rounded transition-colors"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 p-2 rounded">
              {error}
            </p>
          )}

          {/* Fila de Nombre y Selector Hex + Pipeta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Nombre del Color
              </label>
              <input
                ref={colorNameInputRef}
                type="text"
                placeholder="Ej. Nude, Rosado, Gris Jaspe"
                value={colorName}
                onChange={(e) => {
                  setColorName(e.target.value);
                  setError("");
                }}
                className="w-full h-9 px-3 border border-border rounded-button bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Tono Visual (Hexadecimal)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                  className="w-9 h-9 p-0 border border-border rounded-button cursor-pointer shrink-0 bg-white"
                  title="Abrir paleta de colores"
                />

                <input
                  type="text"
                  value={colorHex}
                  maxLength={7}
                  onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 h-9 px-3 border border-border rounded-button bg-white text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder="#RRGGBB"
                />

                {hasEyeDropper && (
                  <button
                    type="button"
                    onClick={handlePickFromScreen}
                    className="h-9 px-2.5 rounded-button border border-border bg-white hover:bg-surface-subtle text-brand-primary flex items-center gap-1.5 shrink-0 transition-colors"
                    title="Capturar color de la imagen o pantalla con pipeta"
                  >
                    <Pipette className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-semibold">Pipeta</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Atajos rápidos de confección */}
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1.5">
              Atajos rápidos de confección
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-badge border border-border text-xs hover:border-brand-primary transition-colors bg-white"
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

          {/* Pie de acciones */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleCloseAddColor}
              className="px-3 py-1.5 rounded-button border border-border bg-white text-xs font-semibold text-brand-primary hover:bg-surface-subtle transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddColorSubmit}
              className="px-3.5 py-1.5 rounded-button bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors"
            >
              Agregar a Matriz
            </button>
          </div>
        </div>
      )}

      {/* C. Grilla de Tallas, SKU e Inventario del Color Activo */}
      {colors.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-6 text-center text-xs text-brand-secondary">
          Agrega el primer color con el botón <strong>+ Color</strong> para
          habilitar la grilla de tallas e inventario.
        </div>
      ) : (
        selectedColor && (
          <div className="overflow-x-auto border border-border rounded-card bg-white">
            <table className="w-full text-xs">
              <thead className="bg-surface-subtle border-b border-border text-brand-secondary uppercase tracking-wider font-bold">
                <tr>
                  <th className="text-left p-3">Talla</th>
                  <th className="text-left p-3">SKU de la Variante</th>
                  <th className="text-left p-3">Stock Físico Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {audienceSizes.map((size) => {
                  const variant = variants.find(
                    (v) =>
                      v.color === selectedColor &&
                      Number(v.size_id) === Number(size.id),
                  );

                  return (
                    <tr key={size.id} className="hover:bg-surface-subtle/40">
                      <td className="p-3">
                        <span className="font-bold text-xs text-brand-primary">
                          {size.name}
                        </span>
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          value={variant?.sku || ""}
                          onChange={(e) =>
                            updateCell(
                              selectedColor,
                              size.id,
                              "sku",
                              e.target.value,
                            )
                          }
                          className="w-full max-w-[200px] h-8 px-2 border border-border rounded-button text-xs font-mono uppercase"
                          placeholder="SKU-AUTO"
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() =>
                                updateCell(
                                  selectedColor,
                                  size.id,
                                  "stock",
                                  Math.max(
                                    0,
                                    Number(variant?.stock || 0) - 1,
                                  ),
                                )
                              }
                              className="w-7 h-8 border border-border rounded-l-button bg-slate-50 hover:bg-slate-100 font-bold text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={variant?.stock ?? 0}
                              onChange={(e) =>
                                updateCell(
                                  selectedColor,
                                  size.id,
                                  "stock",
                                  e.target.value,
                                )
                              }
                              className="w-14 h-8 text-center text-xs font-mono font-bold border-y border-border focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateCell(
                                  selectedColor,
                                  size.id,
                                  "stock",
                                  Number(variant?.stock || 0) + 1,
                                )
                              }
                              className="w-7 h-8 border border-border rounded-r-button bg-slate-50 hover:bg-slate-100 font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            un.
                          </span>

                          {/* Badge contextual de stock */}
                          {Number(variant?.stock || 0) === 0 ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                              Sin stock
                            </span>
                          ) : Number(variant?.stock || 0) <= 5 ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                              Stock bajo
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
