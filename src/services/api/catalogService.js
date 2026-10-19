import { supabase } from "../supabase";

const PRODUCT_RELATIONAL_FIELDS = [
  "id, name, slug, description, price, main_image_url, gallery_urls, target_gender, is_featured, is_active, brand_id, category_id, material_id,",
  "categories!inner(id, name, slug, parent_id, is_active),",
  "materials(id, name, is_active),",
  "brands(id, name, slug, is_active),",
  "product_variants(id, size_id, color, color_hex, stock, sku, is_active, sizes(id, name, display_order)),",
  "size_guides(id, size_id, measurements, sizes(id, name, display_order))",
].join(" ");

function sanitizeProductVariants(product) {
  if (!product) return null;
  const activeVariants = (product.product_variants || []).filter(
    (variant) => variant.is_active !== false
  );
  return {
    ...product,
    product_variants: activeVariants,
  };
}

/**
 * Consulta la tabla categories filtrando solo las activas y ordenadas por display_order.
 * Incluye parent_id para construir el árbol jerárquico de subcategorías.
 */
export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, image_url, parent_id")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error al obtener categorías:", error.message || error);
    throw error;
  }
}

/**
 * Consulta la tabla maestra brands filtrando solo las activas.
 */
export async function getBrands() {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error al obtener marcas:", error.message || error);
    throw error;
  }
}

/**
 * Consulta la tabla materials filtrando solo los activos y ordenados por nombre.
 */
export async function getMaterials() {
  try {
    const { data, error } = await supabase
      .from("materials")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error al obtener materiales:", error.message || error);
    throw error;
  }
}

/**
 * Realiza una consulta relacional sobre products filtrando is_active = true.
 */
export async function getProducts({ categorySlug, targetGender } = {}) {
  try {
    let query = supabase
      .from("products")
      .select(PRODUCT_RELATIONAL_FIELDS)
      .eq("is_active", true)
      .eq("categories.is_active", true);

    if (categorySlug) {
      query = query.eq("categories.slug", categorySlug);
    }

    if (targetGender) {
      query = query.eq("target_gender", targetGender);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return (data || []).map(sanitizeProductVariants);
  } catch (error) {
    console.error("Error al obtener productos:", error.message || error);
    throw error;
  }
}

/**
 * Consulta relacional por slug único del producto.
 */
export async function getProductBySlug(slug) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_RELATIONAL_FIELDS)
      .eq("is_active", true)
      .eq("slug", slug)
      .single();

    if (error) throw error;
    return sanitizeProductVariants(data);
  } catch (error) {
    console.error(
      'Error al obtener producto con slug "' + slug + '":',
      error.message || error
    );
    throw error;
  }
}