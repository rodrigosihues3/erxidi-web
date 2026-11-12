import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../../services/supabase";
import {
  getCategories,
  getMaterials,
  getBrands,
  getProducts,
  CATALOG_INVALIDATE_EVENT,
} from "../../../services/api/catalogService";

/**
 * Custom Hook que centraliza la carga y el estado reactivo del catálogo.
 * Soporta dimensiones facetadas: categorías, materiales, marcas y productos.
 */
export function useCatalog(filterOptions = {}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [categoriesData, materialsData, brandsData, productsData] =
        await Promise.all([
          getCategories(),
          getMaterials(),
          getBrands(),
          getProducts(filterOptions),
        ]);

      setCategories(categoriesData);
      setMaterials(materialsData);
      setBrands(brandsData);
      setProducts(productsData);
    } catch (err) {
      console.error("Error al cargar datos del catálogo:", err);
      setError(err.message || "Error al conectar con el catálogo de productos.");
    } finally {
      setLoading(false);
    }
  }, [filterOptions.categorySlug, filterOptions.targetGender]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();

    function handleInvalidate() {
      fetchData();
    }

    if (typeof window !== "undefined") {
      window.addEventListener(CATALOG_INVALIDATE_EVENT, handleInvalidate);
      return () => {
        window.removeEventListener(CATALOG_INVALIDATE_EVENT, handleInvalidate);
      };
    }
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("catalog-products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchDataRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants" },
        () => {
          fetchDataRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_color_images" },
        () => {
          fetchDataRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    products,
    categories,
    materials,
    brands,
    loading,
    error,
    refetch: fetchData,
  };
}
