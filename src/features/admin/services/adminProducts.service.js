import { supabase } from "../../../services/supabase";

export async function listProducts({ search = "", activeOnly = false } = {}) {
  let query = supabase
    .from("products")
    .select(`
      id, category_id, material_id, name, slug, description, price,
      main_image_url, gallery_urls, has_size_guide, is_featured,
      is_active, target_gender, created_at, updated_at,
      categories:category_id (id, name),
      materials:material_id (id, name),
      product_variants (id, size_id, color, color_hex, stock, sku, is_active,
        sizes:size_id (id, name, display_order))
    `)
    .order("created_at", { ascending: false });

  if (activeOnly) query = query.eq("is_active", true);
  if (search.trim()) {
    const safe = search.trim().replace(/[%_,]/g, " ");
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, category_id, material_id, name, slug, description, price,
      main_image_url, gallery_urls, has_size_guide, is_featured,
      is_active, target_gender, created_at, updated_at,
      product_variants (id, size_id, color, color_hex, stock, sku, is_active,
        sizes:size_id (id, name, display_order)),
      size_guides (id, size_id, measurements,
        sizes:size_id (id, name, display_order))
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getProductDependencies() {
  const [categories, materials, sizes] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("display_order"),
    supabase.from("materials").select("id, name").eq("is_active", true).order("name"),
    supabase.from("sizes").select("id, name, display_order").eq("is_active", true).order("display_order"),
  ]);

  for (const result of [categories, materials, sizes]) {
    if (result.error) throw result.error;
  }

  return {
    categories: categories.data ?? [],
    materials: materials.data ?? [],
    sizes: sizes.data ?? [],
  };
}

export async function uploadProductImage(file) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  const path = `public/${Date.now()}-${crypto.randomUUID()}.${extension || "jpg"}`;

  const { error } = await supabase.storage.from("products").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("products").getPublicUrl(path);
  return { url: data.publicUrl, path, name: safeName };
}

export async function createProduct(payload) {
  const { variants = [], ...product } = payload;
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select("id")
    .single();

  if (error) throw error;

  if (variants.length) {
    const { error: variantsError } = await supabase
      .from("product_variants")
      .insert(variants.map((variant) => ({ ...variant, product_id: data.id })));

    if (variantsError) {
      await supabase.from("products").delete().eq("id", data.id);
      throw variantsError;
    }
  }

  return getProduct(data.id);
}

export async function updateProduct(id, payload) {
  const { variants = [], ...product } = payload;
  const { error } = await supabase
    .from("products")
    .update({ ...product, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", id);

  if (deleteError) throw deleteError;

  if (variants.length) {
    const { error: variantsError } = await supabase
      .from("product_variants")
      .insert(variants.map((variant) => ({ ...variant, product_id: id })));

    if (variantsError) throw variantsError;
  }

  return getProduct(id);
}

export async function setProductActive(id, isActive) {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
