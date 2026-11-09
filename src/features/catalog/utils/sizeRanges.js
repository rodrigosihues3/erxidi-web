// Rangos de referencia ERXIDI para el calculador de tallas.
// Los valores son de referencia del equipo; no provienen de la norma NTP-ISO 8559.
export const SIZES = ["S", "M", "L", "XL"];
export const HIP_FROM_WAIST_OFFSET_CM = 16;
export const BUST_FROM_UNDERBUST_OFFSET_CM = 15;

export const BOTTOM_LIMITS = [
  { size: "S", waist: 76, hip: 95 },
  { size: "M", waist: 84, hip: 101 },
  { size: "L", waist: 92, hip: 108 },
];
export const TOP_LIMITS = [
  { size: "S", bust: 86 },
  { size: "M", bust: 92 },
  { size: "L", bust: 98 },
];
export const SOCK_LIMITS = [
  { size: "S", foot: 24.5, inclusive: false },
  { size: "M", foot: 26.5, inclusive: true },
  { size: "L", foot: 29.5, inclusive: true },
];
export const IMC_LIMITS = [20, 25, 30];

export function getBottomSize(waist, hip) {
  if (waist == null && hip == null) return null;
  const w = waist != null ? waist : hip - HIP_FROM_WAIST_OFFSET_CM;
  const h = hip != null ? hip : waist + HIP_FROM_WAIST_OFFSET_CM;
  for (const l of BOTTOM_LIMITS) {
    if (w <= l.waist && h <= l.hip) return l.size;
  }
  return "XL";
}

export function getTopSize(bust, underbust) {
  if (bust == null && underbust == null) return null;
  const b = bust != null ? bust : underbust + BUST_FROM_UNDERBUST_OFFSET_CM;
  for (const l of TOP_LIMITS) {
    if (b <= l.bust) return l.size;
  }
  return "XL";
}

export function getSockSize(foot) {
  if (foot == null) return null;
  for (const l of SOCK_LIMITS) {
    if (l.inclusive ? foot <= l.foot : foot < l.foot) return l.size;
  }
  return "XL";
}

export function getQuickSize(imc, fit) {
  let base = imc < IMC_LIMITS[0] ? 0 : imc < IMC_LIMITS[1] ? 1 : imc < IMC_LIMITS[2] ? 2 : 3;
  if (fit === "Ajustado" && base > 0) base -= 1;
  else if (fit === "Holgado" && base < SIZES.length - 1) base += 1;
  return SIZES[base];
}

