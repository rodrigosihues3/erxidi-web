import { supabase } from '../supabase';

const PRODUCT_RELATIONAL_FIELDS = `
  id, name, slug, description, price, main_image_url, gallery_urls, target_gender, is_featured, is_active,
  categories!inner(id, name, slug),
  materials(id, name),
  product_variants(id, color, color_hex, stock, sku, is_active, sizes(id, name, display_order)),
  size_guides(id, measurements, sizes(id, name))
`
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Consulta la tabla categories ordenados por display_order ascendente.
 */
export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error al obtener categorías:', error.message || error);
    throw error;
  }
}

/**
 * Consulta la tabla materials ordenados por name ascendente.
 */
export async function getMaterials() {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error al obtener materiales:', error.message || error);
    throw error;
  }
}

/**
 * Realiza una consulta relacional sobre products filtrando is_active = true.
 * Permite filtrar opcionalmente por categorySlug y targetGender.
 */
export async function getProducts({ categorySlug, targetGender } = {}) {
  try {
    let query = supabase
      .from('products')
      .select(PRODUCT_RELATIONAL_FIELDS)
      .eq('is_active', true);

    if (categorySlug) {
      query = query.eq('categories.slug', categorySlug);
    }

    if (targetGender) {
      query = query.eq('target_gender', targetGender);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error al obtener productos:', error.message || error);
    throw error;
  }
}

/**
 * Consulta relacional idéntica a getProducts filtrando por slug único.
 */
export async function getProductBySlug(slug) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_RELATIONAL_FIELDS)
      .eq('is_active', true)
      .eq('slug', slug)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error al obtener producto con slug "${slug}":`, error.message || error);
    throw error;
  }
}
