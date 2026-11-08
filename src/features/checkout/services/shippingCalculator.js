/**
 * Servicio de Cálculo de Tarifas de Despacho Escalonadas Hiperlocales
 * Sigue la regla matemática de 3 tramos (Propuesta 1A):
 * 1. Hiperlocal / Peatonal (distancia <= distancia_hiperlocal)
 * 2. Cobertura Base en Moto (distancia <= distancia_base)
 * 3. Kilómetros Excedentes (distancia > distancia_base)
 */

export const DEFAULT_SHIPPING_CONFIG = {
  hyperlocalEnabled: true,
  hyperlocalDistanceKm: 0.80,
  hyperlocalFee: 3.50,
  baseDistanceKm: 3.00,
  baseFee: 7.00,
  extraKmFee: 1.00,
};

/**
 * Calcula el costo de envío y el tramo correspondiente según la distancia en kilómetros.
 *
 * @param {number|string} distanceKm - Distancia en kilómetros calculada desde el taller
 * @param {Object} [config] - Configuración de tarifas (opcional, fallback a parámetros por defecto)
 * @returns {{ fee: number, tier: 'Hiperlocal' | 'Base' | 'Excedente' | 'No aplicable' }}
 */
export function calculateDeliveryFee(distanceKm, config = {}) {
  const km = Number(distanceKm);
  if (isNaN(km) || km < 0) {
    return { fee: 0, tier: "No aplicable" };
  }

  const hyperlocalEnabled =
    config.hyperlocalEnabled !== undefined
      ? Boolean(config.hyperlocalEnabled)
      : config.delivery_hyperlocal_enabled !== undefined
        ? Boolean(config.delivery_hyperlocal_enabled)
        : DEFAULT_SHIPPING_CONFIG.hyperlocalEnabled;

  const hyperlocalDistanceKm = Number(
    config.hyperlocalDistanceKm ??
      config.delivery_hyperlocal_distance_km ??
      DEFAULT_SHIPPING_CONFIG.hyperlocalDistanceKm
  );

  const hyperlocalFee = Number(
    config.hyperlocalFee ??
      config.delivery_hyperlocal_fee ??
      DEFAULT_SHIPPING_CONFIG.hyperlocalFee
  );

  const baseDistanceKm = Number(
    config.baseDistanceKm ??
      config.delivery_base_distance_km ??
      config.baseKm ??
      DEFAULT_SHIPPING_CONFIG.baseDistanceKm
  );

  const baseFee = Number(
    config.baseFee ??
      config.delivery_base_fee ??
      DEFAULT_SHIPPING_CONFIG.baseFee
  );

  const extraKmFee = Number(
    config.extraKmFee ??
      config.delivery_extra_km_fee ??
      config.pricePerExtraKm ??
      DEFAULT_SHIPPING_CONFIG.extraKmFee
  );

  // Tramo 1: Hiperlocal (si está habilitado y distancia <= radio hiperlocal)
  if (hyperlocalEnabled && km <= hyperlocalDistanceKm) {
    return {
      fee: Number(hyperlocalFee.toFixed(2)),
      tier: "Hiperlocal",
    };
  }

  // Tramo 2: Tarifa Base
  if (km <= baseDistanceKm) {
    return {
      fee: Number(baseFee.toFixed(2)),
      tier: "Base",
    };
  }

  // Tramo 3: Excedente por kilómetro adicional
  const extraDistance = km - baseDistanceKm;
  const totalCalculated = baseFee + extraDistance * extraKmFee;

  return {
    fee: Number(totalCalculated.toFixed(2)),
    tier: "Excedente",
  };
}

