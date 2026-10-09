import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "../../../components/ui/Button";

export default function VariantMatrix({ sizes, variants, onChange }) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);

  function addColor() {
    const color = window.prompt("Nombre del nuevo color:");
    if (!color?.trim()) return;
    const clean = color.trim();
    if (colors.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    const next = sizes.map((size) => ({
      product_id: null,
      size_id: size.id,
      color: clean,
      color_hex: "#000000",
      stock: 0,
      sku: `${clean.slice(0, 3).toUpperCase()}-${size.name}-${Date.now().toString().slice(-5)}-${size.id}`,
      is_active: true,
    }));
    onChange([...variants, ...next]);
  }

  function removeColor(color) {
    onChange(variants.filter((variant) => variant.color !== color));
  }

  function updateCell(color, sizeId, field, rawValue) {
    onChange(variants.map((variant) => {
      if (variant.color !== color || Number(variant.size_id) !== Number(sizeId)) return variant;
      return { ...variant, [field]: field === "stock" ? Math.max(0, Number(rawValue) || 0) : rawValue };
    }));
  }

  if (!sizes.length) {
    return <p className="text-sm text-brand-secondary">No hay tallas activas configuradas.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">Variantes por talla y color</p>
          <p className="text-xs text-brand-muted">El stock se administra por combinación.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addColor}>
          <Plus className="h-4 w-4 mr-1" /> Color
        </Button>
      </div>

      {colors.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-6 text-center text-sm text-brand-secondary">Agrega el primer color para crear la matriz.</div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="text-left p-3">Color</th>
                {sizes.map((size) => <th key={size.id} className="p-3 text-left">{size.name}</th>)}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color} className="border-t border-border">
                  <td className="p-3 font-semibold">{color}</td>
                  {sizes.map((size) => {
                    const variant = variants.find((v) => v.color === color && Number(v.size_id) === Number(size.id));
                    return (
                      <td key={size.id} className="p-3">
                        {variant ? (
                          <div className="space-y-2">
                            <input type="number" min="0" value={variant.stock} onChange={(e) => updateCell(color, size.id, "stock", e.target.value)} className="w-24 h-9 px-2 border border-border rounded-button text-sm" />
                            <input type="text" value={variant.sku} onChange={(e) => updateCell(color, size.id, "sku", e.target.value)} className="w-32 h-9 px-2 border border-border rounded-button text-xs" placeholder="SKU" />
                          </div>
                        ) : <span className="text-xs text-brand-muted">—</span>}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right"><button type="button" onClick={() => removeColor(color)} className="p-2 rounded-button text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
