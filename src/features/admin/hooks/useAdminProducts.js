import { useEffect, useState } from "react";
import { listProducts } from "../services/adminProducts.service";

export function useAdminProducts(filters = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await listProducts(filters);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ data: [], loading: false, error });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filters]);

  return state;
}
