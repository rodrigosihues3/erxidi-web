import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const SEASONAL_SNOW_KEY = "seasonal_snow";

export function useSeasonalSnow() {
  const [isSnowEnabled, setIsSnowEnabled] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchSnowSetting() {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select("value")
          .eq("key", SEASONAL_SNOW_KEY)
          .maybeSingle();

        if (!active || error) return;
        if (data?.value && typeof data.value.enabled === "boolean") {
          setIsSnowEnabled(data.value.enabled);
        }
      } catch {
        // Fallback silencioso: mantener valor por defecto si no hay conexión
      }
    }

    fetchSnowSetting();

    const channel = supabase
      .channel("store-settings-seasonal-snow")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_settings",
          filter: `key=eq.${SEASONAL_SNOW_KEY}`,
        },
        (payload) => {
          const nextEnabled = payload.new?.value?.enabled;
          if (typeof nextEnabled === "boolean") {
            setIsSnowEnabled(nextEnabled);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return isSnowEnabled;
}
