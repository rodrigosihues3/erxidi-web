import { useEffect, useState } from "react";
import { Edit3, Power, Save, X } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import { createCategory, listCategories, setCategoryActive, updateCategory } from "../services/adminCategories.service";

const blank = { name: "", slug: "", description: "", image_url: "", display_order: 0, is_active: true };
function slugify(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function CategoriesView() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listCategories();
        if (!cancelled) setCategories(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudieron cargar las categorías.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  async function load() { setLoading(true); setError(""); try { setCategories(await listCategories()); } catch (err) { setError(err.message || "No se pudieron cargar las categorías."); } finally { setLoading(false); } }

  function edit(item) { setEditingId(item.id); setForm({ name: item.name, slug: item.slug, description: item.description || "", image_url: item.image_url || "", display_order: item.display_order || 0, is_active: item.is_active }); }
  function reset() { setEditingId(null); setForm(blank); }
  function update(field, value) { setForm((prev) => ({ ...prev, [field]: value })); }

  async function submit(e) { e.preventDefault(); setSaving(true); setError(""); try { const payload = { ...form, name: form.name.trim(), slug: slugify(form.slug || form.name), display_order: Number(form.display_order) || 0 }; if (!payload.name) throw new Error("El nombre es obligatorio."); if (editingId) await updateCategory(editingId, payload); else await createCategory(payload); window.alert(`Categoría ${editingId ? "actualizada" : "creada"} correctamente.`); reset(); await load(); } catch (err) { setError(err.message || "No se pudo guardar la categoría."); } finally { setSaving(false); } }

  async function toggle(item) { try { await setCategoryActive(item.id, !item.is_active); window.alert(`Categoría ${item.is_active ? "desactivada" : "activada"} correctamente.`); await load(); } catch (err) { window.alert(err.message || "No se pudo actualizar la categoría."); } }

  return (
    <div className="space-y-6">
      <div><p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Catálogo</p><h1 className="text-2xl font-black">Categorías</h1><p className="text-sm text-brand-secondary mt-1">Administra las colecciones visibles del catálogo.</p></div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1"><CardHeader><CardTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input label="Nombre" value={form.name} onChange={(e) => { const name = e.target.value; setForm((prev) => ({ ...prev, name, slug: editingId ? prev.slug : slugify(name) })); }} required /><Input label="Slug" value={form.slug} onChange={(e) => update("slug", slugify(e.target.value))} required /><Input label="Imagen URL" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} /><Input label="Orden" type="number" min="0" value={form.display_order} onChange={(e) => update("display_order", e.target.value)} /><label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">Descripción<textarea rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} className="mt-1.5 w-full px-3 py-2 border border-border rounded-button text-sm" /></label>{error && <p className="text-xs text-status-danger-text">{error}</p>}<div className="flex gap-2"><Button type="submit" isLoading={saving}><Save className="h-4 w-4 mr-2" /> {editingId ? "Actualizar" : "Crear"}</Button>{editingId && <Button type="button" variant="outline" onClick={reset}><X className="h-4 w-4 mr-1" /> Cancelar</Button>}</div></form></CardContent></Card>
        <Card className="xl:col-span-2 p-0 overflow-hidden"><CardHeader className="p-5"><CardTitle>Listado</CardTitle></CardHeader>{loading ? <div className="p-6 text-sm text-brand-secondary">Cargando categorías...</div> : categories.length === 0 ? <div className="p-10 text-center text-sm text-brand-secondary">No hay categorías.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-surface-subtle"><tr><th className="text-left p-4">Categoría</th><th className="text-left p-4">Slug</th><th className="text-left p-4">Orden</th><th className="text-left p-4">Estado</th><th className="p-4" /></tr></thead><tbody>{categories.map((item) => <tr key={item.id} className="border-t border-border"><td className="p-4 font-bold">{item.name}</td><td className="p-4 text-brand-secondary">{item.slug}</td><td className="p-4">{item.display_order}</td><td className="p-4"><Badge variant={item.is_active ? "success" : "neutral"}>{item.is_active ? "Activa" : "Inactiva"}</Badge></td><td className="p-4 text-right"><Button variant="ghost" size="sm" onClick={() => edit(item)}><Edit3 className="h-4 w-4 mr-1" /> Editar</Button><Button variant="ghost" size="sm" onClick={() => toggle(item)}><Power className="h-4 w-4 mr-1" /> {item.is_active ? "Desactivar" : "Activar"}</Button></td></tr>)}</tbody></table></div>}</Card>
      </div>
    </div>
  );
}
