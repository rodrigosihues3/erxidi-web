import { supabase } from "../../../services/supabase";

// ============================================================================
// 1. FUNCIONES PARA ZONA DE COBERTURA Y POLÍGONO (CoverageSettingsView.jsx)
// ============================================================================

export async function getStoreDeliverySettings() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("key, value, delivery_hyperlocal_enabled, delivery_hyperlocal_distance_km, delivery_hyperlocal_fee")
    .in("key", ["express_coverage_polygon", "store_location", "delivery_pricing"]);

  if (error) throw error;

  const settings = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  const pricingRow = data?.find((row) => row.key === "delivery_pricing") || {};
  const rawPricing = settings.delivery_pricing || {};

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
    pricing: {
      hyperlocalEnabled:
        pricingRow.delivery_hyperlocal_enabled !== undefined && pricingRow.delivery_hyperlocal_enabled !== null
          ? Boolean(pricingRow.delivery_hyperlocal_enabled)
          : Boolean(rawPricing.hyperlocalEnabled ?? rawPricing.delivery_hyperlocal_enabled ?? true),
      hyperlocalDistanceKm: Number(
        pricingRow.delivery_hyperlocal_distance_km ??
          rawPricing.hyperlocalDistanceKm ??
          rawPricing.delivery_hyperlocal_distance_km ??
          0.8
      ),
      hyperlocalFee: Number(
        pricingRow.delivery_hyperlocal_fee ??
          rawPricing.hyperlocalFee ??
          rawPricing.delivery_hyperlocal_fee ??
          3.5
      ),
      baseFee: Number(rawPricing.baseFee ?? rawPricing.delivery_base_fee ?? 7.0),
      baseKm: Number(rawPricing.baseKm ?? rawPricing.delivery_base_distance_km ?? 3.0),
      pricePerExtraKm: Number(
        rawPricing.pricePerExtraKm ?? rawPricing.delivery_extra_km_fee ?? 1.0
      ),
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
    const isHyperlocalEnabled =
      pricing.hyperlocalEnabled !== undefined
        ? Boolean(pricing.hyperlocalEnabled)
        : Boolean(pricing.delivery_hyperlocal_enabled ?? true);
    const hyperlocalKm = Number(
      pricing.hyperlocalDistanceKm ?? pricing.delivery_hyperlocal_distance_km ?? 0.8
    );
    const hyperlocalFee = Number(
      pricing.hyperlocalFee ?? pricing.delivery_hyperlocal_fee ?? 3.5
    );

    updates.push({
      key: "delivery_pricing",
      value: {
        ...pricing,
        hyperlocalEnabled: isHyperlocalEnabled,
        hyperlocalDistanceKm: hyperlocalKm,
        hyperlocalFee: hyperlocalFee,
        baseFee: Number(pricing.baseFee ?? 7.0),
        baseKm: Number(pricing.baseKm ?? 3.0),
        pricePerExtraKm: Number(pricing.pricePerExtraKm ?? 1.0),
      },
      delivery_hyperlocal_enabled: isHyperlocalEnabled,
      delivery_hyperlocal_distance_km: hyperlocalKm,
      delivery_hyperlocal_fee: hyperlocalFee,
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
    .select(
      "key, value, yape_enabled, plin_enabled, yape_qr_url, yape_phone, yape_holder_name, plin_qr_url, plin_phone, plin_holder_name, store_closed, pause_express, pause_scheduled, pause_pickup, delivery_hyperlocal_enabled, delivery_hyperlocal_distance_km, delivery_hyperlocal_fee"
    );

  if (error) throw error;

  const settings = {};
  data?.forEach((row) => {
    settings[row.key] = row.value;
  });

  const paymentRow =
    data?.find((row) => row.key === "payment_methods") ||
    data?.find((row) => row.yape_qr_url || row.yape_phone || row.plin_qr_url) ||
    {};

  const emergencyRow =
    data?.find((row) => row.key === "emergency_flags") ||
    data?.find(
      (row) =>
        row.store_closed !== undefined &&
        row.store_closed !== null
    ) ||
    {};

  const pricingRow =
    data?.find((row) => row.key === "delivery_pricing") ||
    {};

  return {
    identity: settings.business_identity || {
      ruc: "",
      legal_name: "",
      commercial_name: "ERXIDI",
      support_phone: "",
    },
    paymentMethods: {
      bank_accounts: settings.payment_methods?.bank_accounts || [],
      digital_wallets: settings.payment_methods?.digital_wallets || { yape_number: "", plin_number: "", holder_name: "" },
      yape_enabled: paymentRow.yape_enabled !== undefined && paymentRow.yape_enabled !== null
        ? paymentRow.yape_enabled
        : (settings.payment_methods?.yape_enabled ?? true),
      plin_enabled: paymentRow.plin_enabled !== undefined && paymentRow.plin_enabled !== null
        ? paymentRow.plin_enabled
        : (settings.payment_methods?.plin_enabled ?? false),
      yape_qr_url: paymentRow.yape_qr_url || settings.payment_methods?.yape_qr_url || null,
      yape_phone: paymentRow.yape_phone || settings.payment_methods?.digital_wallets?.yape_number || "",
      yape_holder_name: paymentRow.yape_holder_name || settings.payment_methods?.digital_wallets?.holder_name || "",
      plin_qr_url: paymentRow.plin_qr_url || settings.payment_methods?.plin_qr_url || null,
      plin_phone: paymentRow.plin_phone || settings.payment_methods?.digital_wallets?.plin_number || "",
      plin_holder_name: paymentRow.plin_holder_name || settings.payment_methods?.digital_wallets?.holder_name || "",
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
    emergencyFlags: {
      store_closed:
        emergencyRow.store_closed !== undefined && emergencyRow.store_closed !== null
          ? Boolean(emergencyRow.store_closed)
          : Boolean(settings.emergency_flags?.store_closed ?? settings.emergency_flags?.close_store_today ?? false),
      pause_express:
        emergencyRow.pause_express !== undefined && emergencyRow.pause_express !== null
          ? Boolean(emergencyRow.pause_express)
          : Boolean(settings.emergency_flags?.pause_express ?? settings.emergency_flags?.pause_express_only ?? false),
      pause_scheduled:
        emergencyRow.pause_scheduled !== undefined && emergencyRow.pause_scheduled !== null
          ? Boolean(emergencyRow.pause_scheduled)
          : Boolean(settings.emergency_flags?.pause_scheduled ?? false),
      pause_pickup:
        emergencyRow.pause_pickup !== undefined && emergencyRow.pause_pickup !== null
          ? Boolean(emergencyRow.pause_pickup)
          : Boolean(settings.emergency_flags?.pause_pickup ?? false),
      // Campos de compatibilidad con verify_checkout_preflight
      close_store_today:
        emergencyRow.store_closed !== undefined && emergencyRow.store_closed !== null
          ? Boolean(emergencyRow.store_closed)
          : Boolean(settings.emergency_flags?.store_closed ?? settings.emergency_flags?.close_store_today ?? false),
      pause_express_only:
        emergencyRow.pause_express !== undefined && emergencyRow.pause_express !== null
          ? Boolean(emergencyRow.pause_express)
          : Boolean(settings.emergency_flags?.pause_express ?? settings.emergency_flags?.pause_express_only ?? false),
      pause_reason: settings.emergency_flags?.pause_reason || "",
    },
    deliveryPricing: {
      hyperlocalEnabled:
        pricingRow.delivery_hyperlocal_enabled !== undefined && pricingRow.delivery_hyperlocal_enabled !== null
          ? Boolean(pricingRow.delivery_hyperlocal_enabled)
          : Boolean(settings.delivery_pricing?.hyperlocalEnabled ?? true),
      hyperlocalDistanceKm: Number(
        pricingRow.delivery_hyperlocal_distance_km ??
          settings.delivery_pricing?.hyperlocalDistanceKm ??
          0.8
      ),
      hyperlocalFee: Number(
        pricingRow.delivery_hyperlocal_fee ??
          settings.delivery_pricing?.hyperlocalFee ??
          3.5
      ),
      baseFee: Number(settings.delivery_pricing?.baseFee ?? 7.0),
      baseKm: Number(settings.delivery_pricing?.baseKm ?? 3.0),
      pricePerExtraKm: Number(settings.delivery_pricing?.pricePerExtraKm ?? 1.0),
    },
    fleetConfig: settings.fleet_config || {
      max_items_per_trip: 30,
    },
    seasonalSnowEnabled: settings.seasonal_snow?.enabled ?? true,
  };
}

/**
 * Persiste únicamente la matriz de interruptores de emergencia en store_settings.
 * No sobrescribe ni altera los horarios semanales.
 */
export async function updateEmergencySettings({
  store_closed,
  pause_express,
  pause_scheduled,
  pause_pickup,
  pause_reason = "",
}) {
  const isClosed = Boolean(store_closed);
  const isExpressPaused = Boolean(pause_express);
  const isScheduledPaused = Boolean(pause_scheduled);
  const isPickupPaused = Boolean(pause_pickup);

  const flags = {
    store_closed: isClosed,
    pause_express: isExpressPaused,
    pause_scheduled: isScheduledPaused,
    pause_pickup: isPickupPaused,
    close_store_today: isClosed,
    pause_express_only: isExpressPaused,
    pause_reason: pause_reason || "",
  };

  const updateFields = {
    value: flags,
    store_closed: isClosed,
    pause_express: isExpressPaused,
    pause_scheduled: isScheduledPaused,
    pause_pickup: isPickupPaused,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("store_settings")
    .update(updateFields)
    .eq("key", "emergency_flags")
    .select();

  if (error) throw error;

  if (!data || data.length === 0) {
    const { error: upsertError } = await supabase.from("store_settings").upsert({
      key: "emergency_flags",
      ...updateFields,
    });
    if (upsertError) throw upsertError;
  }

  return true;
}

/**
 * Persiste únicamente la configuración de horarios semanales en store_settings.
 * No altera ni envía los interruptores de emergencia.
 */
export async function updateBusinessHours(businessHours) {
  const { error } = await supabase.from("store_settings").upsert({
    key: "business_hours",
    value: businessHours,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
  return true;
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

/**
 * Sube una imagen de código QR procesada a Supabase Storage en el bucket payment-assets.
 * @param {Blob} fileBlob - Archivo binario recortado en PNG
 * @param {'yape' | 'plin'} provider - Nombre de la billetera digital
 * @returns {Promise<string>} URL pública del QR
 */
export async function uploadPaymentQr(fileBlob, provider = "yape") {
  const filePath = `qrs/${provider}_qr_${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("payment-assets")
    .upload(filePath, fileBlob, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("payment-assets")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

/**
 * Persiste los parámetros de pago y billeteras digitales en la tabla store_settings.
 * @param {Object} payload - Columnas y estructura de métodos de pago
 * @returns {Promise<boolean>}
 */
export async function updatePaymentSettings(payload) {
  const {
    yape_enabled,
    plin_enabled,
    yape_qr_url,
    yape_phone,
    yape_holder_name,
    plin_qr_url,
    plin_phone,
    plin_holder_name,
    bank_accounts = [],
    value,
  } = payload;

  const jsonValue = value || {
    bank_accounts: bank_accounts,
    digital_wallets: {
      yape_number: yape_phone || "",
      plin_number: plin_phone || "",
      holder_name: yape_holder_name || plin_holder_name || "",
    },
    yape_enabled: yape_enabled !== undefined ? yape_enabled : true,
    plin_enabled: plin_enabled !== undefined ? plin_enabled : false,
    yape_qr_url: yape_qr_url || null,
    plin_qr_url: plin_qr_url || null,
  };

  const updateFields = {
    value: jsonValue,
    yape_enabled: yape_enabled !== undefined ? yape_enabled : true,
    plin_enabled: plin_enabled !== undefined ? plin_enabled : false,
    yape_qr_url: yape_qr_url !== undefined ? yape_qr_url : null,
    yape_phone: yape_phone !== undefined ? yape_phone : null,
    yape_holder_name: yape_holder_name !== undefined ? yape_holder_name : null,
    plin_qr_url: plin_qr_url !== undefined ? plin_qr_url : null,
    plin_phone: plin_phone !== undefined ? plin_phone : null,
    plin_holder_name: plin_holder_name !== undefined ? plin_holder_name : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("store_settings")
    .update(updateFields)
    .eq("key", "payment_methods")
    .select();

  if (error) throw error;

  if (!data || data.length === 0) {
    const { error: upsertError } = await supabase
      .from("store_settings")
      .upsert({
        key: "payment_methods",
        ...updateFields,
      });

    if (upsertError) throw upsertError;
  }

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