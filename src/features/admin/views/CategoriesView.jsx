import { useEffect, useState, useMemo } from "react";
import { Edit3, Power, Save, X, Layers, Bookmark, Sparkles, Ruler } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import {
  listCategories,
  createCategory,
  updateCategory,
  setCategoryActive,
  listBrands,
  createBrand,
  updateBrand,
  setBrandActive,
  listMaterials,
  createMaterial,
  updateMaterial,
  setMaterialActive,
  listSizes,
  createSize,
  updateSize,
  setSizeActive,
} from "../services/adminCategories.service";

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoriesView() {
  const [activeTab, setActiveTab] = useState("categories"); // 'categories' | 'brands' | 'materials' | 'sizes'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Estados de datos
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [sizes, setSizes] = useState([]);

  // Estados de formularios y edición
  const [editingId, setEditingId] = useState(null);
  const [catForm, setCatForm] = useState({
    name: "",
    slug: "",
    parent_id: "",
    display_order: 0,
    description: "",
    is_active: true,
  });
  const [brandForm, setBrandForm] = useState({
    name: "",
    slug: "",
    display_order: 0,
    is_active: true,
  });
  const [materialForm, setMaterialForm] = useState({
    name: "",
    is_active: true,
  });
  const [sizeForm, setSizeForm] = useState({
    name: "",
    display_order: 0,
    target_genders: ["hombre", "mujer"],
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [cats, brs, mats, szs] = await Promise.all([
        listCategories(),
        listBrands(),
        listMaterials(),
        listSizes(),
      ]);
      setCategories(cats);
      setBrands(brs);
      setMaterials(mats);
      setSizes(szs);
    } catch (err) {
      setError(err.message || "Error al sincronizar datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetForms = () => {
    setEditingId(null);
    setCatForm({
      name: "",
      slug: "",
      parent_id: "",
      display_order: 0,
      description: "",
      is_active: true,
    });
    setBrandForm({ name: "", slug: "", display_order: 0, is_active: true });
    setMaterialForm({ name: "", is_active: true });
    setSizeForm({
      name: "",
      display_order: 0,
      target_genders: ["hombre", "mujer"],
    });
    setError("");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetForms();
  };

  // Mapa de categorías raíz para asignar como parent_id
  const rootCategories = useMemo(() => {
    return categories.filter((c) => c.parent_id == null);
  }, [categories]);

  // Manejo de envío: Categorías
  const submitCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: catForm.name.trim(),
        slug: slugify(catForm.slug || catForm.name),
        parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
        display_order: Number(catForm.display_order) || 0,
        description: catForm.description.trim() || null,
        is_active: catForm.is_active,
      };
      if (!payload.name) throw new Error("El nombre de la prenda es obligatorio.");
      if (editingId) await updateCategory(editingId, payload);
      else await createCategory(payload);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al procesar categoría.");
    } finally {
      setSaving(false);
    }
  };

  // Manejo de envío: Marcas
  const submitBrand = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: brandForm.name.trim(),
        slug: slugify(brandForm.slug || brandForm.name),
        display_order: Number(brandForm.display_order) || 0,
        is_active: brandForm.is_active,
      };
      if (!payload.name) throw new Error("El nombre de la marca es obligatorio.");
      if (editingId) await updateBrand(editingId, payload);
      else await createBrand(payload);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al procesar marca.");
    } finally {
      setSaving(false);
    }
  };

  // Manejo de envío: Materiales
  const submitMaterial = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: materialForm.name.trim(),
        is_active: materialForm.is_active,
      };
      if (!payload.name) throw new Error("El nombre del material es obligatorio.");
      if (editingId) await updateMaterial(editingId, payload);
      else await createMaterial(payload);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al procesar material.");
    } finally {
      setSaving(false);
    }
  };

  // Manejo de envío: Tallas
  const submitSize = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!sizeForm.name.trim()) {
        throw new Error("El nombre de la talla es obligatorio.");
      }
      if (!sizeForm.target_genders || sizeForm.target_genders.length === 0) {
        throw new Error("Selecciona al menos un público.");
      }

      const payload = {
        name: sizeForm.name.trim(),
        display_order: Number(sizeForm.display_order) || 0,
        target_genders: sizeForm.target_genders,
      };

      if (editingId) await updateSize(editingId, payload);
      else await createSize(payload);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al procesar talla.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">
          Catálogo Maestro
        </p>
        <h1 className="text-2xl font-black text-brand-primary">
          Taxonomía y Atributos
        </h1>
        <p className="text-sm text-brand-secondary mt-1">
          Administra las dimensiones independientes del catálogo: prendas, marcas, composiciones textiles y tallas.
        </p>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex flex-wrap border-b border-border gap-2">
        <button
          type="button"
          onClick={() => handleTabChange("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "categories"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <Layers className="w-4 h-4" />
          Prendas y Subcategorías ({categories.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("brands")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "brands"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Marcas ({brands.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("materials")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "materials"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Materiales ({materials.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("sizes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "sizes"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-brand-secondary hover:text-brand-primary"
          }`}
        >
          <Ruler className="w-4 h-4" />
          Tallas ({sizes.length})
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-button border border-status-danger-border bg-status-danger-bg text-status-danger-text text-sm">
          {error}
        </div>
      )}

      {/* PESTAÑA 1: CATEGORÍAS */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>
                {editingId ? "Editar prenda" : "Nueva prenda o subcategoría"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCategory} className="space-y-4">
                <Input
                  label="Nombre"
                  value={catForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCatForm((prev) => ({
                      ...prev,
                      name,
                      slug: editingId ? prev.slug : slugify(name),
                    }));
                  }}
                  required
                />
                <Input
                  label="Slug"
                  value={catForm.slug}
                  onChange={(e) =>
                    setCatForm((prev) => ({
                      ...prev,
                      slug: slugify(e.target.value),
                    }))
                  }
                  required
                />
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                  Categoría Padre (Opcional)
                  <select
                    value={catForm.parent_id}
                    onChange={(e) =>
                      setCatForm((prev) => ({
                        ...prev,
                        parent_id: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full h-10 px-3 border border-border rounded-button bg-white text-sm"
                  >
                    <option value="">
                      Ninguna (Es categoría raíz / principal)
                    </option>
                    {rootCategories
                      .filter((r) => r.id !== editingId)
                      .map((root) => (
                        <option key={root.id} value={root.id}>
                          {root.name}
                        </option>
                      ))}
                  </select>
                </label>
                <Input
                  label="Orden de visualización"
                  type="number"
                  min="0"
                  value={catForm.display_order}
                  onChange={(e) =>
                    setCatForm((prev) => ({
                      ...prev,
                      display_order: e.target.value,
                    }))
                  }
                />
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                  Descripción
                  <textarea
                    rows={3}
                    value={catForm.description}
                    onChange={(e) =>
                      setCatForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full px-3 py-2 border border-border rounded-button text-sm"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? "Actualizar" : "Guardar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForms}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2 p-0 overflow-hidden">
            <CardHeader className="p-5">
              <CardTitle>Listado de prendas y subcategorías</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="p-6 text-sm text-brand-secondary">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-brand-secondary">
                    <tr>
                      <th className="p-4">Prenda / Tipo</th>
                      <th className="p-4">Jerarquía</th>
                      <th className="p-4">Slug</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((item) => {
                      const parent = categories.find(
                        (c) => c.id === item.parent_id,
                      );
                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="p-4 font-bold text-brand-primary">
                            {item.parent_id ? `— ${item.name}` : item.name}
                          </td>
                          <td className="p-4 text-xs text-brand-secondary">
                            {parent ? (
                              <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">
                                Subtipo de: {parent.name}
                              </span>
                            ) : (
                              <span className="font-semibold text-brand-primary">
                                Raíz
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-xs font-mono text-brand-muted">
                            {item.slug}
                          </td>
                          <td className="p-4 text-center">
                            <Badge
                              variant={item.is_active ? "success" : "neutral"}
                            >
                              {item.is_active ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(item.id);
                                  setCatForm({
                                    name: item.name,
                                    slug: item.slug,
                                    parent_id: item.parent_id
                                      ? String(item.parent_id)
                                      : "",
                                    display_order: item.display_order || 0,
                                    description: item.description || "",
                                    is_active: item.is_active,
                                  });
                                }}
                              >
                                <Edit3 className="h-4 w-4 mr-1" /> Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await setCategoryActive(
                                    item.id,
                                    !item.is_active,
                                  );
                                  await loadData();
                                }}
                              >
                                <Power className="h-4 w-4 mr-1" />
                                {item.is_active ? "Desactivar" : "Activar"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PESTAÑA 2: MARCAS */}
      {activeTab === "brands" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? "Editar marca" : "Nueva marca"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitBrand} className="space-y-4">
                <Input
                  label="Nombre de Marca"
                  value={brandForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBrandForm((prev) => ({
                      ...prev,
                      name,
                      slug: editingId ? prev.slug : slugify(name),
                    }));
                  }}
                  required
                />
                <Input
                  label="Slug"
                  value={brandForm.slug}
                  onChange={(e) =>
                    setBrandForm((prev) => ({
                      ...prev,
                      slug: slugify(e.target.value),
                    }))
                  }
                  required
                />
                <Input
                  label="Orden de visualización"
                  type="number"
                  min="0"
                  value={brandForm.display_order}
                  onChange={(e) =>
                    setBrandForm((prev) => ({
                      ...prev,
                      display_order: e.target.value,
                    }))
                  }
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? "Actualizar" : "Guardar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForms}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2 p-0 overflow-hidden">
            <CardHeader className="p-5">
              <CardTitle>Listado de marcas comerciales</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="p-6 text-sm text-brand-secondary">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-brand-secondary">
                    <tr>
                      <th className="p-4">Marca</th>
                      <th className="p-4">Slug</th>
                      <th className="p-4 text-center">Orden</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.id} className="border-t border-border">
                        <td className="p-4 font-bold text-brand-primary">
                          {b.name}
                        </td>
                        <td className="p-4 text-xs font-mono text-brand-muted">
                          {b.slug}
                        </td>
                        <td className="p-4 text-center font-mono">
                          {b.display_order}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={b.is_active ? "success" : "neutral"}>
                            {b.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(b.id);
                                setBrandForm({
                                  name: b.name,
                                  slug: b.slug,
                                  display_order: b.display_order || 0,
                                  is_active: b.is_active,
                                });
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await setBrandActive(b.id, !b.is_active);
                                await loadData();
                              }}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {b.is_active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PESTAÑA 3: MATERIALES */}
      {activeTab === "materials" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>
                {editingId ? "Editar material" : "Nuevo material textil"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitMaterial} className="space-y-4">
                <Input
                  label="Nombre del Material"
                  placeholder="Ej: Algodón Pima Peruano"
                  value={materialForm.name}
                  onChange={(e) =>
                    setMaterialForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  required
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? "Actualizar" : "Guardar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForms}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2 p-0 overflow-hidden">
            <CardHeader className="p-5">
              <CardTitle>Listado de materiales y tejidos</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="p-6 text-sm text-brand-secondary">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[450px] text-sm">
                  <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-brand-secondary">
                    <tr>
                      <th className="p-4">Material</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="p-4 font-bold text-brand-primary">
                          {m.name}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={m.is_active ? "success" : "neutral"}>
                            {m.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(m.id);
                                setMaterialForm({
                                  name: m.name,
                                  is_active: m.is_active,
                                });
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await setMaterialActive(m.id, !m.is_active);
                                await loadData();
                              }}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {m.is_active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PESTAÑA 4: TALLAS Y MEDIDAS */}
      {activeTab === "sizes" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>
                {editingId ? "Editar talla" : "Nueva talla"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitSize} className="space-y-4">
                <Input
                  label="Nombre de la Talla"
                  placeholder="Ej: Talla 6-9 años, S, M, L"
                  maxLength={20}
                  value={sizeForm.name}
                  onChange={(e) =>
                    setSizeForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Orden de visualización"
                  type="number"
                  min="0"
                  value={sizeForm.display_order}
                  onChange={(e) =>
                    setSizeForm((prev) => ({
                      ...prev,
                      display_order: e.target.value,
                    }))
                  }
                />
                <div>
                  <label className="block text-xs font-semibold text-brand-secondary mb-1.5">
                    Público Objetivo <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-surface-subtle border border-border rounded-button">
                    {[
                      { id: "hombre", label: "Hombre" },
                      { id: "mujer", label: "Mujer" },
                      { id: "nino", label: "Niño" },
                      { id: "nina", label: "Niña" },
                    ].map(({ id, label }) => {
                      const isChecked = sizeForm.target_genders.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 text-xs font-medium text-brand-primary cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...sizeForm.target_genders, id]
                                : sizeForm.target_genders.filter(
                                    (g) => g !== id,
                                  );
                              setSizeForm({
                                ...sizeForm,
                                target_genders: updated,
                              });
                            }}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {sizeForm.target_genders.length === 0 && (
                    <p className="text-[11px] text-red-500 mt-1">
                      Selecciona al menos un público.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? "Actualizar" : "Guardar"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForms}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2 p-0 overflow-hidden">
            <CardHeader className="p-5">
              <CardTitle>Listado de tallas y medidas</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="p-6 text-sm text-brand-secondary">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-brand-secondary">
                    <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Público</th>
                      <th className="p-4 text-center">Orden</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size) => (
                      <tr key={size.id} className="border-t border-border">
                        <td className="p-4 font-bold text-brand-primary font-mono">
                          {size.name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {size.target_genders?.map((g) => (
                              <Badge
                                className="text-[10px] px-1.5 py-0 capitalize bg-slate-100 text-slate-700 border-slate-200"
                                key={g}
                                variant="neutral"
                              >
                                {g === "nino"
                                  ? "Niño"
                                  : g === "nina"
                                    ? "Niña"
                                    : g}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono">
                          {size.display_order}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={size.is_active ? "success" : "neutral"}>
                            {size.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(size.id);
                                setSizeForm({
                                  name: size.name,
                                  display_order: size.display_order || 0,
                                  target_genders: Array.isArray(
                                    size.target_genders,
                                  )
                                    ? size.target_genders
                                    : ["hombre", "mujer"],
                                });
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await setSizeActive(size.id, !size.is_active);
                                await loadData();
                              }}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {size.is_active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
