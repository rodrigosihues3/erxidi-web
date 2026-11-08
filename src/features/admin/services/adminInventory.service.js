import { supabase } from "../../../services/supabase";

/**
 * Obtiene las variantes activas de productos activos con stock crítico (< 5) o agotadas (0).
 * Esta consulta es independiente del rango de fechas comercial del Dashboard.
 */
export async function getCriticalStock() {
  const pageSize = 1000;
  let from = 0;
  let allVariants = [];

  while (true) {
    const { data, error } = await supabase
      .from("product_variants")
      .select(`
        id,
        product_id,
        size_id,
        color,
        color_hex,
        stock,
        sku,
        is_active,
        sizes:size_id (
          id,
          name
        ),
        products:product_id (
          id,
          name,
          slug,
          is_active,
          main_image_url
        )
      `)
      .eq("is_active", true)
      .order("stock", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error obteniendo stock crítico:", error);
      throw error;
    }

    const page = data || [];
    allVariants = allVariants.concat(page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return allVariants
    .filter((variant) => variant.products && variant.products.is_active !== false)
    .map((variant) => ({
      ...variant,
      stock: Number(variant.stock || 0),
      productName: variant.products?.name || "Producto sin nombre",
      productImage: variant.products?.main_image_url || null,
      sizeName: variant.sizes?.name || "-",
      colorName: variant.color || "-",
      colorHex: variant.color_hex || "#CBD5E1",
    }))
    .filter((variant) => variant.stock < 5);
}

