import { useMemo, useState } from "react";
import { Edit3, Plus, Search, Power } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useAdminProducts } from "../hooks/useAdminProducts";
import { setProductActive } from "../services/adminProducts.service";

function money(value) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0)); }

export default function ProductsListView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({ search }), [search]);
  const { data, loading, error, reload } = useAdminProducts(filters);

  async function toggle(product) {
    const action = product.is_active ? "desactivar" : "activar";
    if (!window.confirm(`¿Deseas ${action} ${product.name}?`)) return;
    try {
      await setProductActive(product.id, !product.is_active);
      window.alert(`Producto ${action}do correctamente.`);
      reload();
    } catch (err) { window.alert(err.message || "No se pudo actualizar el producto."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Catálogo</p><h1 className="text-2xl font-black">Productos</h1><p className="text-sm text-brand-secondary mt-1">Administra prendas, imágenes, variantes y stock.</p></div><Button size="sm" onClick={() => navigate("/admin/productos/nuevo")}><Plus className="h-4 w-4 mr-2" /> Nuevo producto</Button></div>
      <Card>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-brand-muted" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o slug" className="pl-9" /></div>
      </Card>
      <Card className="p-0 overflow-hidden">
        {error ? <div className="p-6 text-sm text-status-danger-text">{error.message}</div> : loading ? <div className="p-6 text-sm text-brand-secondary">Cargando inventario...</div> : data.length === 0 ? <div className="p-10 text-center text-sm text-brand-secondary">No hay productos.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-surface-subtle"><tr><th className="text-left p-4">Producto</th><th className="text-left p-4">Categoría</th><th className="text-left p-4">Material</th><th className="text-left p-4">Precio</th><th className="text-left p-4">Stock</th><th className="text-left p-4">Estado</th><th className="p-4" /></tr></thead><tbody>{data.map((product) => { const stock = (product.product_variants || []).filter((v) => v.is_active).reduce((sum, v) => sum + Number(v.stock || 0), 0); return <tr key={product.id} className="border-t border-border"><td className="p-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded overflow-hidden bg-surface-subtle">{product.main_image_url && <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />}</div><div><p className="font-bold">{product.name}</p><p className="text-xs text-brand-secondary">{product.slug}</p></div></div></td><td className="p-4">{product.categories?.name || "—"}</td><td className="p-4">{product.materials?.name || "—"}</td><td className="p-4 font-semibold">{money(product.price)}</td><td className="p-4 font-semibold">{stock}</td><td className="p-4"><Badge variant={product.is_active ? "success" : "neutral"}>{product.is_active ? "Activo" : "Inactivo"}</Badge></td><td className="p-4 text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => navigate(`/admin/productos/${product.id}/editar`)}><Edit3 className="h-4 w-4 mr-1" /> Editar</Button><Button variant="ghost" size="sm" onClick={() => toggle(product)}><Power className="h-4 w-4 mr-1" /> {product.is_active ? "Desactivar" : "Activar"}</Button></div></td></tr>; })}</tbody></table></div>}
      </Card>
    </div>
  );
}
