import { supabase } from '../supabase';

/**
 * Servicio de integración con la API de Decolecta (RENIEC / SUNAT).
 * Utiliza el proxy relativo (/api-decolecta) para evitar bloqueos de CORS tanto
 * en Vite local (server.proxy) como en Vercel (rewrites en vercel.json).
 */

const DECOLECTA_TOKEN = import.meta.env.VITE_DNI_API_TOKEN || "";
// Ruta relativa para que sea interceptada por Vite en local y por Vercel en producción
const BASE_URL = "/api-decolecta";

/**
 * Helper interno para consultar y guardar en caché.
 */
async function fetchWithCache(documentType, documentNumber, fetcherFn) {
  const cacheKey = `cache_doc_${documentNumber}`;

  // 1. Consultar en sessionStorage
  if (typeof window !== "undefined") {
    const sessionCached = sessionStorage.getItem(cacheKey);
    if (sessionCached) {
      try {
        return JSON.parse(sessionCached);
      } catch (e) {
        // Ignorar error de parseo y continuar
      }
    }
  }

  // 2. Consultar en Supabase (identity_cache)
  try {
    const { data: dbCache } = await supabase
      .from("identity_cache")
      .select("data")
      .eq("document_number", documentNumber)
      .maybeSingle();

    if (dbCache && dbCache.data) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(cacheKey, JSON.stringify(dbCache.data));
      }
      return dbCache.data;
    }
  } catch (err) {
    console.warn("Error leyendo caché de Supabase:", err);
  }

  // 3. Consultar API real
  const result = await fetcherFn();

  // 4. Guardar en caché si fue exitoso
  if (result.success) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
    }

    // Guardar en Supabase sin bloquear el flujo
    supabase
      .from("identity_cache")
      .insert([
        {
          document_type: documentType,
          document_number: documentNumber,
          data: result,
        },
      ])
      .then(({ error }) => {
        if (error) console.warn("Error guardando en caché de Supabase:", error);
      });
  }

  return result;
}

/**
 * Consulta información de persona natural por DNI (8 dígitos).
 * @param {string} dni
 */
export async function fetchDni(dni) {
  const cleanDni = String(dni || "").trim();

  if (!/^\d{8}$/.test(cleanDni)) {
    return { success: false, error: "invalid_format" };
  }

  return fetchWithCache("dni", cleanDni, async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const endpointUrl = `${BASE_URL}/reniec/dni?numero=${cleanDni}`;

      const headers = {
        "Content-Type": "application/json",
      };
      if (DECOLECTA_TOKEN) {
        headers.Authorization = DECOLECTA_TOKEN.startsWith("Bearer ")
          ? DECOLECTA_TOKEN
          : `Bearer ${DECOLECTA_TOKEN}`;
      }

      const response = await fetch(endpointUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: "manual_required" };
      }

      const json = await response.json();
      const data = json.data || json;

      const names = data.first_name || "";
      const firstLastName = data.first_last_name || "";
      const secondLastName = data.second_last_name || "";
      const fullName = `${names} ${firstLastName} ${secondLastName}`.trim();

      if (!fullName) {
        return { success: false, error: "manual_required" };
      }

      return {
        success: true,
        names,
        firstLastName,
        secondLastName,
        fullName,
      };
    } catch (err) {
      console.warn(
        "Consulta Decolecta DNI fallida, activando ingreso manual:",
        err.message,
      );
      return { success: false, error: "manual_required" };
    }
  });
}

/**
 * Consulta información de contribuyente por RUC (11 dígitos, comienza con 10 o 20).
 * @param {string} ruc
 */
export async function fetchRuc(ruc) {
  const cleanRuc = String(ruc || "").trim();

  if (!/^(10|20)\d{9}$/.test(cleanRuc)) {
    return { success: false, error: "invalid_format" };
  }

  return fetchWithCache("ruc", cleanRuc, async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const endpointUrl = `${BASE_URL}/sunat/ruc?numero=${cleanRuc}`;

      const headers = {
        "Content-Type": "application/json",
      };
      if (DECOLECTA_TOKEN) {
        headers.Authorization = DECOLECTA_TOKEN.startsWith("Bearer ")
          ? DECOLECTA_TOKEN
          : `Bearer ${DECOLECTA_TOKEN}`;
      }

      const response = await fetch(endpointUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: "manual_required" };
      }

      const json = await response.json();
      const data = json.data || json;

      const legalName =
        data.razon_social ||
        data.razonSocial ||
        data.nombre_o_razon_social ||
        data.legal_name ||
        "";
      const address =
        data.direccion ||
        data.direccion_completa ||
        data.domicilio_fiscal ||
        data.address ||
        "";
      const status =
        data.estado || data.estado_del_contribuyente || data.status || "ACTIVO";

      if (!legalName) {
        return { success: false, error: "manual_required" };
      }

      return {
        success: true,
        legalName,
        address,
        status,
      };
    } catch (err) {
      console.warn(
        "Consulta Decolecta RUC fallida, activando ingreso manual:",
        err.message,
      );
      return { success: false, error: "manual_required" };
    }
  });
}
