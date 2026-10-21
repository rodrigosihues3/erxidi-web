import { useEffect, useState } from "react";
import { supabase } from "../../../services/supabase";
import { listOrders } from "../services/adminOrders.service";

export function useAdminOrders(filters) {
  const [state, setState] = useState({ data: [], count: 0, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await listOrders(filters);
        if (!cancelled) setState({ ...result, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ data: [], count: 0, loading: false, error });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
        try {
          const result = await listOrders(filters);
          setState({ ...result, loading: false, error: null });
        } catch (error) {
          setState((prev) => ({ ...prev, loading: false, error }));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [filters]);

  return state;
}
