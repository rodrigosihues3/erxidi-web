/**
 * Servicio de integración con la API de Decolecta (RENIEC / SUNAT).
 * Permite la validación y autocompletado de documentos de identidad peruanos (DNI y RUC).
 */

const DECOLECTA_BASE_URL = 'https://api.decolecta.com/v1';
const DECOLECTA_TOKEN = import.meta.env.VITE_DNI_API_TOKEN || '';

/**
 * Consulta información de persona natural por DNI (8 dígitos).
 * @param {string} dni
 * @returns {Promise<{ success: boolean, names?: string, firstLastName?: string, secondLastName?: string, fullName?: string, error?: string }>}
 */
export async function fetchDni(dni) {
  const cleanDni = String(dni || '').trim();

  if (!/^\d{8}$/.test(cleanDni)) {
    return { success: false, error: 'invalid_format' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const endpointUrl = import.meta.env.VITE_DNI_API_URL
      ? `${import.meta.env.VITE_DNI_API_URL}${cleanDni}`
      : `${DECOLECTA_BASE_URL}/reniec/dni?numero=${cleanDni}`;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (DECOLECTA_TOKEN) {
      headers.Authorization = `Bearer ${DECOLECTA_TOKEN}`;
    }

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: 'manual_required' };
    }

    const json = await response.json();
    const data = json.data || json;

    const names = data.nombres || data.first_name || data.names || '';
    const firstLastName =
      data.apellido_paterno || data.apellidoPaterno || data.last_name || '';
    const secondLastName =
      data.apellido_materno || data.apellidoMaterno || data.second_last_name || '';
    const fullName = `${names} ${firstLastName} ${secondLastName}`.trim();

    if (!fullName) {
      return { success: false, error: 'manual_required' };
    }

    return {
      success: true,
      names,
      firstLastName,
      secondLastName,
      fullName,
    };
  } catch (err) {
    console.warn('Consulta Decolecta DNI fallida, activando ingreso manual:', err.message);
    return { success: false, error: 'manual_required' };
  }
}

/**
 * Consulta información de contribuyente por RUC (11 dígitos, comienza con 10 o 20).
 * @param {string} ruc
 * @returns {Promise<{ success: boolean, legalName?: string, address?: string, status?: string, error?: string }>}
 */
export async function fetchRuc(ruc) {
  const cleanRuc = String(ruc || '').trim();

  if (!/^(10|20)\d{9}$/.test(cleanRuc)) {
    return { success: false, error: 'invalid_format' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const endpointUrl = `${DECOLECTA_BASE_URL}/sunat/ruc?numero=${cleanRuc}`;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (DECOLECTA_TOKEN) {
      headers.Authorization = `Bearer ${DECOLECTA_TOKEN}`;
    }

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: 'manual_required' };
    }

    const json = await response.json();
    const data = json.data || json;

    const legalName =
      data.razon_social ||
      data.razonSocial ||
      data.nombre_o_razon_social ||
      data.legal_name ||
      '';
    const address =
      data.direccion ||
      data.direccion_completa ||
      data.domicilio_fiscal ||
      data.address ||
      '';
    const status =
      data.estado || data.estado_del_contribuyente || data.status || 'ACTIVO';

    if (!legalName) {
      return { success: false, error: 'manual_required' };
    }

    return {
      success: true,
      legalName,
      address,
      status,
    };
  } catch (err) {
    console.warn('Consulta Decolecta RUC fallida, activando ingreso manual:', err.message);
    return { success: false, error: 'manual_required' };
  }
}
