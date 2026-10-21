/**
 * Utilidades para cálculo y recomendación de tallas de ERXIDI.
 * Soporta consulta contra tabla real size_guides y fallback antropométrico estándar.
 */

const SIZES = ['S', 'M', 'L', 'XL'];

/**
 * Lee las medidas del usuario desde el perfil (Supabase) o localStorage.
 * @param {Object|null} profile - Perfil del usuario autenticado.
 * @returns {{ hasMeasurements: boolean, measurements: Object }}
 */
export function getUserMeasurements(profile) {
  // 1. Verificar si existe perfil con datos
  if (profile) {
    const bm = profile.body_measurements || {};
    const hasHeightWeight = Boolean(profile.height_cm && profile.weight_kg);
    const hasAnatomic = Boolean(
      bm.waist != null || bm.hip != null || bm.bust != null || bm.foot_length != null || bm.footLength != null
    );

    if (hasHeightWeight || hasAnatomic) {
      return {
        hasMeasurements: true,
        measurements: {
          height_cm: profile.height_cm ? Number(profile.height_cm) : null,
          weight_kg: profile.weight_kg ? Number(profile.weight_kg) : null,
          fit_preference: profile.fit_preference || 'regular',
          waist: bm.waist != null ? Number(bm.waist) : null,
          hip: bm.hip != null ? Number(bm.hip) : null,
          bust: bm.bust != null ? Number(bm.bust) : null,
          foot_length: bm.foot_length != null ? Number(bm.foot_length) : bm.footLength != null ? Number(bm.footLength) : null,
        },
      };
    }
  }

  // 2. Verificar localStorage (invitados)
  if (typeof window !== 'undefined') {
    try {
      const raw =
        localStorage.getItem('erxidi_size_preferences') ||
        localStorage.getItem('erxidi_user_profile_measurements');
      if (raw) {
        const parsed = JSON.parse(raw);
        const hasHeightWeight = Boolean(parsed.height && parsed.weight);
        const hasAnatomic = Boolean(
          parsed.waist != null ||
          parsed.hip != null ||
          parsed.bust != null ||
          parsed.foot_length != null ||
          parsed.footLength != null
        );

        if (hasHeightWeight || hasAnatomic) {
          return {
            hasMeasurements: true,
            measurements: {
              height_cm: parsed.height ? Number(parsed.height) : null,
              weight_kg: parsed.weight ? Number(parsed.weight) : null,
              fit_preference: parsed.fit ? String(parsed.fit).toLowerCase() : 'regular',
              waist: parsed.waist != null ? Number(parsed.waist) : null,
              hip: parsed.hip != null ? Number(parsed.hip) : null,
              bust: parsed.bust != null ? Number(parsed.bust) : null,
              foot_length: parsed.foot_length != null ? Number(parsed.foot_length) : parsed.footLength != null ? Number(parsed.footLength) : null,
            },
          };
        }
      }
    } catch (e) {
      console.warn('Error leyendo medidas de localStorage:', e);
    }
  }

  return {
    hasMeasurements: false,
    measurements: {},
  };
}

/**
 * Fallback antropométrico estándar usando altura, peso y calce.
 * @param {number} heightCm
 * @param {number} weightKg
 * @param {string} fitPreference - 'ajustado' | 'regular' | 'holgado'
 * @returns {string} - 'S' | 'M' | 'L' | 'XL'
 */
export function calculateFallbackSize(heightCm, weightKg, fitPreference = 'regular') {
  const heightM = (heightCm || 175) / 100;
  const weight = weightKg || 70;
  const imc = weight / (heightM * heightM);

  let baseIndex = 1; // Default 'M'
  if (imc < 20) {
    baseIndex = 0; // 'S'
  } else if (imc < 25) {
    baseIndex = 1; // 'M'
  } else if (imc < 30) {
    baseIndex = 2; // 'L'
  } else {
    baseIndex = 3; // 'XL'
  }

  let finalIndex = baseIndex;
  const fitNorm = String(fitPreference || 'regular').toLowerCase();
  if (fitNorm.includes('ajustad') && finalIndex > 0) {
    finalIndex -= 1;
  } else if (fitNorm.includes('holgad') && finalIndex < SIZES.length - 1) {
    finalIndex += 1;
  }

  return SIZES[finalIndex];
}

/**
 * Recomienda la talla evaluando primero size_guides reales (Prioridad 1)
 * y recurriendo al cálculo antropométrico como Prioridad 2 (Fallback).
 * @param {Object} userMeasurements - Medidas del usuario.
 * @param {Array} [sizeGuides=[]] - Registros de la tabla size_guides.
 * @returns {string} - Nombre de la talla recomendada (ej. 'M').
 */
export function matchRecommendedSize(userMeasurements = {}, sizeGuides = []) {
  // PRIORIDAD 1: Evaluación contra size_guides de Supabase
  if (Array.isArray(sizeGuides) && sizeGuides.length > 0) {
    for (const guide of sizeGuides) {
      const m = guide.measurements || {};
      const sizeName = guide.sizes?.name || guide.size || null;
      if (!sizeName) continue;

      let hasRule = false;
      let matchesAllRules = true;

      // 1. Regla de Busto
      if (m.bust_min != null || m.bust_max != null) {
        hasRule = true;
        const uBust = userMeasurements.bust;
        if (uBust == null) {
          matchesAllRules = false;
        } else {
          if (m.bust_min != null && uBust < m.bust_min) matchesAllRules = false;
          if (m.bust_max != null && uBust > m.bust_max) matchesAllRules = false;
        }
      }

      // 2. Regla de Cintura
      if (m.waist_min != null || m.waist_max != null) {
        hasRule = true;
        const uWaist = userMeasurements.waist;
        if (uWaist == null) {
          matchesAllRules = false;
        } else {
          if (m.waist_min != null && uWaist < m.waist_min) matchesAllRules = false;
          if (m.waist_max != null && uWaist > m.waist_max) matchesAllRules = false;
        }
      }

      // 3. Regla de Cadera
      if (m.hip_min != null || m.hip_max != null) {
        hasRule = true;
        const uHip = userMeasurements.hip;
        if (uHip == null) {
          matchesAllRules = false;
        } else {
          if (m.hip_min != null && uHip < m.hip_min) matchesAllRules = false;
          if (m.hip_max != null && uHip > m.hip_max) matchesAllRules = false;
        }
      }

      // 4. Regla de Longitud de Pie (Medias)
      if (m.foot_cm_min != null || m.foot_cm_max != null) {
        hasRule = true;
        const uFoot = userMeasurements.foot_length;
        if (uFoot == null) {
          matchesAllRules = false;
        } else {
          if (m.foot_cm_min != null && uFoot < m.foot_cm_min) matchesAllRules = false;
          if (m.foot_cm_max != null && uFoot > m.foot_cm_max) matchesAllRules = false;
        }
      }

      if (hasRule && matchesAllRules) {
        return sizeName;
      }
    }
  }

  // PRIORIDAD 2: Fallback antropométrico estándar
  return calculateFallbackSize(
    userMeasurements.height_cm,
    userMeasurements.weight_kg,
    userMeasurements.fit_preference
  );
}
