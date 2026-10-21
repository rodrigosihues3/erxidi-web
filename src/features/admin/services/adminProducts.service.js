import { supabase } from "../../../services/supabase";

export async function listProducts({ search = "", activeOnly = false } = {}) {
  let query = supabase
    .from("products")
    .select(`
      id, category_id, material_id, brand_id, name, slug, description, price,
      main_image_url, gallery_urls, has_size_guide, is_featured,
      is_active, target_gender, created_at, updated_at,
      categories:category_id (id, name, parent_id),
      materials:material_id (id, name),
      brands:brand_id (id, name),
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
      id, category_id, material_id, brand_id, name, slug, description, price,
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
  const [categories, materials, sizes, brands] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id").eq("is_active", true).order("display_order"),
    supabase.from("materials").select("id, name").eq("is_active", true).order("name"),
    supabase.from("sizes").select("id, name, display_order").eq("is_active", true).order("display_order"),
    supabase.from("brands").select("id, name").eq("is_active", true).order("display_order"),
  ]);

  for (const result of [categories, materials, sizes, brands]) {
    if (result.error) throw result.error;
  }

  return {
    categories: categories.data ?? [],
    materials: materials.data ?? [],
    sizes: sizes.data ?? [],
    brands: brands.data ?? [],
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
    const cleanInserts = variants.map(({ id: _unusedId, ...variant }) => ({
      ...variant,
      product_id: data.id,
      is_active: true,
    }));

    const { error: variantsError } = await supabase
      .from("product_variants")
      .insert(cleanInserts);

    if (variantsError) {
      await supabase.from("products").delete().eq("id", data.id);
      throw variantsError;
    }
  }

  return getProduct(data.id);
}

export async function updateProduct(id, payload) {
  const { variants = [], ...product } = payload;
  const now = new Date().toISOString();

  // 1. Actualizar datos base del producto
  const { error: productError } = await supabase
    .from("products")
    .update({
      ...product,
      updated_at: now,
    })
    .eq("id", id);

  if (productError) throw productError;

  // 2. Obtener todas las variantes históricas del producto (activas e inactivas)
  const { data: existingVariants, error: fetchError } = await supabase
    .from("product_variants")
    .select("id, product_id, size_id, color, sku, is_active")
    .eq("product_id", id);

  if (fetchError) throw fetchError;

  const makeCompositeKey = (sizeId, color) =>
    `${Number(sizeId)}-${String(color).trim().toLowerCase()}`;

  const existingById = new Map();
  const existingByComposite = new Map();

  for (const existing of existingVariants || []) {
    existingById.set(String(existing.id), existing);
    existingByComposite.set(
      makeCompositeKey(existing.size_id, existing.color),
      existing
    );
  }

  const retainedIds = new Set();

  // 3. Reconciliar variantes (Actualizar por ID o por clave compuesta; insertar solo si es genuinamente nueva)
  for (const variant of variants) {
    const { id: variantId, ...variantData } = variant;
    const compositeKey = makeCompositeKey(variantData.size_id, variantData.color);

    const matchedExisting =
      (variantId && existingById.get(String(variantId))) ||
      existingByComposite.get(compositeKey);

    if (matchedExisting) {
      if (String(matchedExisting.product_id) !== String(id)) {
        throw new Error("Inconsistencia de integridad: la variante no pertenece a este producto.");
      }

      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          size_id: Number(variantData.size_id),
          color: variantData.color.trim(),
          color_hex: variantData.color_hex || "#000000",
          stock: Math.max(0, Number(variantData.stock) || 0),
          sku: variantData.sku.trim(),
          is_active: true,
          updated_at: now,
        })
        .eq("id", matchedExisting.id)
        .eq("product_id", id);

      if (updateError) throw updateError;

      retainedIds.add(String(matchedExisting.id));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("product_variants")
        .insert({
          product_id: Number(id),
          size_id: Number(variantData.size_id),
          color: variantData.color.trim(),
          color_hex: variantData.color_hex || "#000000",
          stock: Math.max(0, Number(variantData.stock) || 0),
          sku: variantData.sku.trim(),
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      retainedIds.add(String(inserted.id));
    }
  }

  // 4. Borrado lógico en lote para variantes retiradas (preserva FK con order_items y anula stock)
  const idsToDeactivate = (existingVariants || [])
    .filter((variant) => !retainedIds.has(String(variant.id)) && variant.is_active !== false)
    .map((variant) => variant.id);

  if (idsToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from("product_variants")
      .update({
        is_active: false,
        stock: 0,
        updated_at: now,
      })
      .in("id", idsToDeactivate)
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