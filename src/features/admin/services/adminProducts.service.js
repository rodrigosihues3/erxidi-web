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

  // 1. Actualizar los datos generales del producto.
  const { error: productError } = await supabase
    .from("products")
    .update({
      ...product,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (productError) throw productError;

  // 2. Consultar las variantes que ya existen.
  const { data: existingVariants, error: fetchError } =
    await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id);

  if (fetchError) throw fetchError;

  const existingById = new Map(
    (existingVariants || []).map((variant) => [
      String(variant.id),
      variant,
    ])
  );

  const retainedIds = new Set();

  // 3. Actualizar las existentes o insertar las nuevas.
  for (const variant of variants) {
    const { id: variantId, ...variantData } = variant;

    if (variantId && existingById.has(String(variantId))) {
      const existing = existingById.get(String(variantId));

      if (String(existing.product_id) !== String(id)) {
        throw new Error(
          "La variante no pertenece a este producto."
        );
      }

      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          ...variantData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variantId)
        .eq("product_id", id);

      if (updateError) throw updateError;

      retainedIds.add(String(variantId));
    } else {
      // Una variante nueva se inserta sin reutilizar un ID antiguo.
      const { data: inserted, error: insertError } =
        await supabase
          .from("product_variants")
          .insert({
            ...variantData,
            product_id: id,
          })
          .select("id")
          .single();

      if (insertError) throw insertError;

      retainedIds.add(String(inserted.id));
    }
  }

  // 4. Desactivar las variantes retiradas.
  // Nunca eliminarlas: pueden estar vinculadas a pedidos anteriores.
  const removedVariants = (existingVariants || []).filter(
    (variant) => !retainedIds.has(String(variant.id))
  );

  for (const variant of removedVariants) {
    const { error: deactivateError } = await supabase
      .from("product_variants")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variant.id)
      .eq("product_id", id);

    if (deactivateError) throw deactivateError;
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
