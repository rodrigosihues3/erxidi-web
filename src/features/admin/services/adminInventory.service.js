
import { supabase } from "../../../services/supabase";

/**
 * Obtiene el stock actual de todas las variantes activas.
 * Esta consulta NO depende del rango de fechas del Dashboard.
 *
 * Stock:
 * 0       => agotado
 * 1 a 5   => stock bajo
 * > 5     => stock suficiente
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
    .map((variant) => ({
      ...variant,
      stock: Number(variant.stock || 0),
      productName: variant.products?.name || "Producto sin nombre",
      sizeName: variant.sizes?.name || "Talla no definida",
      colorName: variant.color || "Color no definido",
    }))
    .filter((variant) => variant.stock <= 5);
}
