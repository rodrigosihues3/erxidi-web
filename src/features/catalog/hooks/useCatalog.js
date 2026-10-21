import { useState, useEffect, useCallback } from "react";
import {
  getCategories,
  getMaterials,
  getBrands,
  getProducts,
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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