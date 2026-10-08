import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import ProductDropzone from "../components/ProductDropzone";
import VariantMatrix from "../components/VariantMatrix";
import { createProduct, getProduct, getProductDependencies, updateProduct } from "../services/adminProducts.service";

const initial = { category_id: "", material_id: "", name: "", slug: "", description: "", price: "", main_image_url: "", gallery_urls: [], has_size_guide: true, is_featured: false, is_active: true, target_gender: "hombre" };

function slugify(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function ProductFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(initial);
  const [variants, setVariants] = useState([]);
  const [deps, setDeps] = useState({ categories: [], materials: [], sizes: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dependencies = await getProductDependencies();
        if (!active) return;
        setDeps(dependencies);
        if (editing) {
          const product = await getProduct(id);
          if (!active) return;
          setForm({ category_id: product.category_id, material_id: product.material_id, name: product.name, slug: product.slug, description: product.description, price: product.price, main_image_url: product.main_image_url, gallery_urls: product.gallery_urls || [], has_size_guide: product.has_size_guide, is_featured: product.is_featured, is_active: product.is_active, target_gender: product.target_gender });
          setVariants((product.product_variants || []).map((variant) => ({ ...variant, product_id: product.id })));
        }
      } catch (err) { if (active) setError(err.message || "No se pudo cargar el formulario."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, editing]);

  const colors = useMemo(() => [...new Set(variants.map((variant) => variant.color))], [variants]);

  function update(field, value) { setForm((prev) => ({ ...prev, [field]: value })); }

  function handleNameChange(value) { setForm((prev) => ({ ...prev, name: value, slug: editing ? prev.slug : slugify(value) })); }

  function buildPayload() {
    const gallery = form.gallery_urls || [];
    const main = form.main_image_url || gallery[0];
    if (!main) throw new Error("Debes cargar al menos una imagen y definir la imagen principal.");
    if (!form.category_id || !form.material_id || !form.name.trim() || !form.description.trim() || Number(form.price) <= 0) throw new Error("Completa los campos obligatorios del producto.");
    if (!form.slug.trim()) throw new Error("El slug es obligatorio.");
    const seen = new Set();
    const cleanVariants = variants.map((variant) => ({ size_id: Number(variant.size_id), color: variant.color.trim(), color_hex: variant.color_hex || "#000000", stock: Math.max(0, Number(variant.stock) || 0), sku: variant.sku.trim(), is_active: variant.is_active !== false })).filter((variant) => { const key = `${variant.size_id}-${variant.color.toLowerCase()}`; if (!variant.color || !variant.sku || seen.has(key)) return false; seen.add(key); return true; });
    return { category_id: Number(form.category_id), material_id: Number(form.material_id), name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim(), price: Number(form.price), main_image_url: main, gallery_urls: gallery, has_size_guide: Boolean(form.has_size_guide), is_featured: Boolean(form.is_featured), is_active: Boolean(form.is_active), target_gender: form.target_gender, variants: cleanVariants };
  }

  async function submit(e) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const payload = buildPayload();
      if (editing) await updateProduct(id, payload); else await createProduct(payload);
      window.alert(`Producto ${editing ? "actualizado" : "creado"} correctamente.`);
      navigate("/admin/productos", { replace: true });
    } catch (err) { setError(err.message || "No se pudo guardar el producto."); }
    finally { setSaving(false); }
  }

  if (loading) return <Card><p className="text-sm text-brand-secondary">Cargando formulario...</p></Card>;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-3"><Button type="button" variant="ghost" size="sm" onClick={() => navigate("/admin/productos")}><ArrowLeft className="h-4 w-4 mr-1" /> Productos</Button><div><p className="text-xs text-brand-secondary">Catálogo</p><h1 className="text-2xl font-black">{editing ? "Editar producto" : "Nuevo producto"}</h1></div></div>
      {error && <div className="p-3 rounded-button border border-status-danger-border bg-status-danger-bg text-status-danger-text text-sm">{error}</div>}

      <Card><CardHeader><CardTitle>Información general</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nombre" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required /><Input label="Slug" value={form.slug} onChange={(e) => update("slug", slugify(e.target.value))} required /><label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Categoría<select required value={form.category_id} onChange={(e) => update("category_id", e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"><option value="">Selecciona</option>{deps.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Material<select required value={form.material_id} onChange={(e) => update("material_id", e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"><option value="">Selecciona</option>{deps.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Input label="Precio regular" type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} required /><label className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">Público<select value={form.target_gender} onChange={(e) => update("target_gender", e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm">{["hombre","mujer","nino","nina","unisex"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><label className="block mt-4 text-xs font-semibold uppercase tracking-wider text-brand-secondary">Descripción<textarea required rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} className="mt-1.5 w-full px-3 py-2 border border-border rounded-button text-sm resize-y" /></label></CardContent></Card>

      <Card><CardHeader><CardTitle>Imágenes</CardTitle></CardHeader><CardContent><ProductDropzone value={form.gallery_urls} onChange={(urls) => setForm((prev) => ({ ...prev, gallery_urls: urls, main_image_url: prev.main_image_url || urls[0] || "" }))} /><label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">Imagen principal<select value={form.main_image_url} onChange={(e) => update("main_image_url", e.target.value)} className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-xs"><option value="">Seleccionar primera imagen</option>{form.gallery_urls.map((url) => <option key={url} value={url}>{url}</option>)}</select></label></CardContent></Card>

      <Card><CardHeader><CardTitle>Variantes e inventario</CardTitle></CardHeader><CardContent><VariantMatrix sizes={deps.sizes} variants={variants} onChange={setVariants} /><p className="text-xs text-brand-muted">Colores configurados: {colors.length || 0}. Cada SKU debe ser único.</p></CardContent></Card>

      <Card><CardHeader><CardTitle>Configuración</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-6"><Check label="Activo" checked={form.is_active} onChange={(v) => update("is_active", v)} /><Check label="Destacado" checked={form.is_featured} onChange={(v) => update("is_featured", v)} /><Check label="Mostrar guía de tallas" checked={form.has_size_guide} onChange={(v) => update("has_size_guide", v)} /></div></CardContent></Card>

      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => navigate("/admin/productos")}>Cancelar</Button><Button type="submit" isLoading={saving}><Save className="h-4 w-4 mr-2" /> Guardar producto</Button></div>
    </form>
  );
}

function Check({ label, checked, onChange }) { return <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border" /> {label}</label>; }
