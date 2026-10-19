import { supabase } from "../../../services/supabase";

// ==========================================
// CATEGORÍAS (Con soporte de subcategorías)
// ==========================================

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_url, parent_id, is_active, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCategory(payload) {
  const { data, error } = await supabase
    .from("categories")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id, payload) {
  const { data, error } = await supabase
    .from("categories")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setCategoryActive(id, isActive) {
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// MARCAS (brands)
// ==========================================

export async function listBrands() {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, is_active, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBrand(payload) {
  const { data, error } = await supabase
    .from("brands")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBrand(id, payload) {
  const { data, error } = await supabase
    .from("brands")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setBrandActive(id, isActive) {
  const { error } = await supabase
    .from("brands")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// MATERIALES (materials)
// ==========================================

export async function listMaterials() {
  const { data, error } = await supabase
    .from("materials")
    .select("id, name, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createMaterial(payload) {
  const { data, error } = await supabase
    .from("materials")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMaterial(id, payload) {
  const { data, error } = await supabase
    .from("materials")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setMaterialActive(id, isActive) {
  const { error } = await supabase
    .from("materials")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}