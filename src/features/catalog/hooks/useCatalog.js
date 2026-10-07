import { useState, useEffect, useCallback } from 'react';
import {
  getCategories,
  getMaterials,
  getProducts,
} from '../../../services/api/catalogService';

/**
 * Custom Hook que centraliza la carga y el estado reactivo del catálogo.
 * @param {Object} [filterOptions] - Opciones opcionales de filtrado inicial ({ categorySlug, targetGender }).
 * @returns {{ products: Array, categories: Array, materials: Array, loading: boolean, error: string|null, refetch: Function }}
 */
export function useCatalog(filterOptions = {}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [categoriesData, materialsData, productsData] = await Promise.all([
        getCategories(),
        getMaterials(),
        getProducts(filterOptions),
      ]);

      setCategories(categoriesData);
      setMaterials(materialsData);
      setProducts(productsData);
    } catch (err) {
      console.error('Error al cargar datos del catálogo:', err);
      setError(err.message || 'Error al conectar con el catálogo de productos.');
    } finally {
      setLoading(false);
    }
  }, [filterOptions.categorySlug, filterOptions.targetGender]);

  useEffect(() => {
    let isMounted = true;

    fetchData().catch((err) => {
      if (isMounted) {
        setError(err.message || 'Error al conectar con el catálogo.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  return {
    products,
    categories,
    materials,
    loading,
    error,
    refetch: fetchData,
  };
}

export default useCatalog;
