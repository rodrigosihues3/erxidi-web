import { useEffect, useState, useCallback, useMemo } from "react";
import { listProducts } from "../services/adminProducts.service";

export function useAdminProducts(filters = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  // Serializar filtros para estabilizar la referencia en memoria
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listProducts(JSON.parse(filterKey));
      setState({ data: data ?? [], loading: false, error: null });
    } catch (error) {
      setState({ data: [], loading: false, error });
    }
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await listProducts(JSON.parse(filterKey));
        if (!cancelled) {
          setState({ data: data ?? [], loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: [], loading: false, error });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filterKey]);

  return {
    ...state,
    reload: fetchData,
    refetch: fetchData,
  };
}