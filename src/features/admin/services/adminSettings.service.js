import { supabase } from "../../../services/supabase";

// ============================================================================
// 1. FUNCIONES PARA ZONA DE COBERTURA Y POLÍGONO (CoverageSettingsView.jsx)
// ============================================================================

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
      name: "Base ERXIDI Central",
      address: "Lima, Perú",
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

// ============================================================================
// 2. FUNCIONES PARA AJUSTES DEL NEGOCIO (SettingsView.jsx)
// ============================================================================

export async function getAllStoreSettings() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("key, value");

  if (error) throw error;

  const settings = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  return {
    identity: settings.business_identity || {
      ruc: "",
      legal_name: "",
      commercial_name: "ERXIDI",
      support_phone: "",
    },
    paymentMethods: settings.payment_methods || {
      bank_accounts: [],
      digital_wallets: { yape_number: "", plin_number: "", holder_name: "" },
    },
    businessHours: settings.business_hours || {
      "1": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "2": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "3": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "4": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "5": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "6": { enabled: true, open: "09:00", close: "18:00", express_cutoff: "17:00" },
      "0": { enabled: false, open: "09:00", close: "14:00", express_cutoff: "13:00" },
    },
    emergencyFlags: settings.emergency_flags || {
      close_store_today: false,
      pause_express_only: false,
      pause_reason: "",
    },
    fleetConfig: settings.fleet_config || {
      max_items_per_trip: 30,
    },
  };
}

export async function updateStoreSetting(key, value) {
  const { error } = await supabase.from("store_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
  return true;
}

export async function queryRucDecolecta(ruc) {
  const cleanRuc = ruc.trim();
  if (cleanRuc.length !== 11) {
    throw new Error("El RUC debe tener exactamente 11 dígitos numéricos.");
  }

  try {
    const response = await fetch(`https://api.decolecta.com/v1/ruc/${cleanRuc}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("No se encontró el RUC en el padrón.");
    }

    const data = await response.json();
    return {
      success: true,
      legal_name: data.razon_social || data.nombre_o_razon_social || "",
    };
  } catch {
    return {
      success: false,
      message: "No se pudo autocompletar desde Decolecta. Ingresa la Razón Social manualmente.",
    };
  }
}