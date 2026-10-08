import { supabase } from '../../../services/supabase';

const SIZES = ['S', 'M', 'L', 'XL'];

/**
 * Calcula la talla referencial de calzado según los centímetros del pie.
 * Cubre el nicho infantil (14 cm) hasta adulto (31 cm).
 * @param {number|null} footCm
 * @returns {string} - Ej: "38 - 40"
 */
export function calculateShoeSize(footCm) {
  if (footCm == null || footCm === '' || isNaN(footCm)) return '—';
  const cm = Number(footCm);
  if (cm < 16) return '22 - 24';
  if (cm < 18) return '25 - 27';
  if (cm < 20) return '28 - 30';
  if (cm < 22) return '31 - 33';
  if (cm < 24) return '34 - 36';
  if (cm < 25.5) return '36 - 38';
  if (cm < 27.5) return '38 - 40';
  if (cm < 29.5) return '41 - 43';
  return '44 - 46';
}

export const calcularCalzado = calculateShoeSize;

/**
 * Consulta en Supabase las guías de tallas asociadas a un producto.
 * @param {string} productId
 * @returns {Promise<Array>}
 */
export async function fetchProductSizeGuides(productId) {
  if (!productId) return [];
  try {
    const { data: guides, error } = await supabase
      .from('size_guides')
      .select('measurements, sizes(name)')
      .eq('product_id', productId);

    if (error) {
      console.warn('Advertencia al consultar size_guides de Supabase:', error.message);
      return [];
    }
    return guides || [];
  } catch (err) {
    console.warn('Error en fetchProductSizeGuides:', err);
    return [];
  }
}

/**
 * Matriz de patronaje estándar (Prioridad 2: Fallback).
 * Utiliza IMC, contextura y medidas corporales disponibles.
 */
export function calculateStandardPatternSize(userMeasurements = {}) {
  const {
    height_cm = 175,
    weight_kg = 70,
    fit_preference = 'regular',
    waist,
    hip,
    bust,
  } = userMeasurements;

  // Si tiene medidas anatómicas específicas, evaluar primero patronaje textil anatómico
  if (waist != null && waist !== '') {
    const w = Number(waist);
    if (w <= 76) return 'S';
    if (w <= 84) return 'M';
    if (w <= 92) return 'L';
    return 'XL';
  }

  if (bust != null && bust !== '') {
    const b = Number(bust);
    if (b <= 86) return 'S';
    if (b <= 92) return 'M';
    if (b <= 98) return 'L';
    return 'XL';
  }

  // Fallback por IMC y Calce
  const heightM = (Number(height_cm) || 175) / 100;
  const weight = Number(weight_kg) || 70;
  const imc = weight / (heightM * heightM);

  let baseIndex = 1; // Default 'M'
  if (imc < 20) baseIndex = 0; // 'S'
  else if (imc < 25) baseIndex = 1; // 'M'
  else if (imc < 30) baseIndex = 2; // 'L'
  else baseIndex = 3; // 'XL'

  let finalIndex = baseIndex;
  const fit = String(fit_preference || 'regular').toLowerCase();
  if (fit.includes('ajustad') && finalIndex > 0) {
    finalIndex -= 1;
  } else if (fit.includes('holgad') && finalIndex < SIZES.length - 1) {
    finalIndex += 1;
  }

  return SIZES[finalIndex];
}

/**
 * Jerarquía de inferencia de tallas:
 * 1. Prioridad 1 (Base de Datos): Evaluación contra tabla real size_guides.
 * 2. Prioridad 2 (Fallback Estándar): Matriz estándar de patronaje textil.
 * @param {Object} options
 * @param {Object} options.userMeasurements - Medidas del usuario.
 * @param {Array} [options.sizeGuides=[]] - Registros de size_guides.
 * @returns {string} - Nombre de la talla recomendada (ej. 'M').
 */
export function inferSizeForProduct({ userMeasurements = {}, sizeGuides = [] }) {
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
        if (uBust == null || uBust === '') {
          matchesAllRules = false;
        } else {
          if (m.bust_min != null && Number(uBust) < m.bust_min) matchesAllRules = false;
          if (m.bust_max != null && Number(uBust) > m.bust_max) matchesAllRules = false;
        }
      }

      // 2. Regla de Cintura
      if (m.waist_min != null || m.waist_max != null) {
        hasRule = true;
        const uWaist = userMeasurements.waist;
        if (uWaist == null || uWaist === '') {
          matchesAllRules = false;
        } else {
          if (m.waist_min != null && Number(uWaist) < m.waist_min) matchesAllRules = false;
          if (m.waist_max != null && Number(uWaist) > m.waist_max) matchesAllRules = false;
        }
      }

      // 3. Regla de Cadera
      if (m.hip_min != null || m.hip_max != null) {
        hasRule = true;
        const uHip = userMeasurements.hip;
        if (uHip == null || uHip === '') {
          matchesAllRules = false;
        } else {
          if (m.hip_min != null && Number(uHip) < m.hip_min) matchesAllRules = false;
          if (m.hip_max != null && Number(uHip) > m.hip_max) matchesAllRules = false;
        }
      }

      // 4. Regla de Longitud de Pie (Medias / Calcetería)
      if (m.foot_cm_min != null || m.foot_cm_max != null) {
        hasRule = true;
        const uFoot = userMeasurements.foot_length ?? userMeasurements.footLength;
        if (uFoot == null || uFoot === '') {
          matchesAllRules = false;
        } else {
          if (m.foot_cm_min != null && Number(uFoot) < m.foot_cm_min) matchesAllRules = false;
          if (m.foot_cm_max != null && Number(uFoot) > m.foot_cm_max) matchesAllRules = false;
        }
      }

      if (hasRule && matchesAllRules) {
        return sizeName;
      }
    }
  }

  // PRIORIDAD 2: Fallback estándar de patronaje textil
  return calculateStandardPatternSize(userMeasurements);
}
