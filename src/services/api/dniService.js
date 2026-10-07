import { fetchDni } from './decolectaService';

export async function lookupDni(dni) {
  return fetchDni(dni);
}
