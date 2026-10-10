import { supabase } from "../../../services/supabase";

export async function getStoreDeliverySettings() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("key, value")
    .in("key", ["express_coverage_polygon", "store_location", "delivery_pricing"]);

  if (error) throw error;

  const settings = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  return {
    polygon: settings.express_coverage_polygon || [
      [-12.09, -77.05],
      [-12.085, -77.02],
      [-12.12, -77.01],
      [-12.15, -77.025],
      [-12.135, -77.045],
    ],
    storeLocation: settings.store_location || {
      lat: -12.1215,
      lng: -77.0298,
      name: "Taller ERXIDI Central",
      address: "Miraflores, Lima",
    },
    pricing: settings.delivery_pricing || {
      baseFee: 7.0,
      baseKm: 3.0,
      pricePerExtraKm: 1.5,
    },
  };
}

export async function saveStoreDeliverySettings(polygon, storeLocation, pricing) {
  const updates = [
    {
      key: "express_coverage_polygon",
      value: polygon,
      updated_at: new Date().toISOString(),
    },
    {
      key: "store_location",
      value: storeLocation,
      updated_at: new Date().toISOString(),
    },
  ];

  if (pricing) {
    updates.push({
      key: "delivery_pricing",
      value: pricing,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase.from("store_settings").upsert(updates);
  if (error) throw error;
  return true;
}

