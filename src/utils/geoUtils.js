export function isPointInPolygon(point, polygon) {
  if (!point || !polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function calculateDistanceKm(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const [lat1, lon1] = [coord1.lat || coord1[0], coord1.lng || coord1[1]];
  const [lat2, lon2] = [coord2.lat || coord2[0], coord2.lng || coord2[1]];

  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function calculateDeliveryFee(distanceKm, pricing) {
  const { baseFee = 7.0, baseKm = 3.0, pricePerExtraKm = 1.5 } = pricing || {};
  if (distanceKm <= baseKm) return baseFee;
  const extraKm = distanceKm - baseKm;
  return Number((baseFee + extraKm * pricePerExtraKm).toFixed(2));
}

