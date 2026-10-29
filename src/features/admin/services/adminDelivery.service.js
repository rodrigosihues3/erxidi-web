import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../services/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _authAdminClient = null;

function getAuthAdminClient() {
  if (!_authAdminClient) {
    _authAdminClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: "sb-erxidi-delivery-signup-token",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _authAdminClient;
}

/**
 * Obtener todos los repartidores
 */
export async function listDeliveryUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      dni,
      first_name,
      paternal_surname,
      maternal_surname,
      email,
      phone,
      role,
      created_at,
      updated_at
    `)
    .eq("role", "delivery")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Obtener un repartidor
 */
export async function getDeliveryUser(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      dni,
      first_name,
      paternal_surname,
      maternal_surname,
      email,
      phone,
      role,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("role", "delivery")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Actualizar información del repartidor
 */
export async function updateDeliveryStaff(id, payload) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: payload.first_name,
      paternal_surname: payload.paternal_surname,
      maternal_surname: payload.maternal_surname,
      phone: payload.phone,
      dni: payload.dni,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualizar información del repartidor (alias heredado)
 */
export async function updateDeliveryUser(id, values) {
  return updateDeliveryStaff(id, values);
}

/**
 * Creación de cuenta operativa de repartidor
 */
export async function createDeliveryStaff(payload) {
  // 1. Registro en Auth con cliente aislado (no toca localStorage)
  const authClient = getAuthAdminClient();
  const { data: authData, error: authError } = await authClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        first_name: payload.first_name,
        paternal_surname: payload.paternal_surname,
        maternal_surname: payload.maternal_surname,
        role: "delivery",
      },
    },
  });

  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) return authData;

  // 2. Si el registro devolvió sesión en el cliente aislado, actualizamos con ese token,
  // de lo contrario usamos el cliente principal con la sesión de owner
  const clientToUse = authData.session ? authClient : supabase;

  // Breve espera de 300ms para permitir la ejecución del trigger de perfiles en BD
  await new Promise((resolve) => setTimeout(resolve, 300));

  const profileData = {
    first_name: payload.first_name,
    paternal_surname: payload.paternal_surname,
    maternal_surname: payload.maternal_surname,
    phone: payload.phone || null,
    dni: payload.dni || null,
    role: "delivery",
    updated_at: new Date().toISOString(),
  };

  const { data: updatedProfile, error: updateError } = await clientToUse
    .from("profiles")
    .update(profileData)
    .eq("id", userId)
    .select()
    .maybeSingle();

  if (updateError || !updatedProfile) {
    // Si no existía fila previa, intentar inserción con id explícito
    const { data: insertedProfile, error: insertError } = await clientToUse
      .from("profiles")
      .upsert({ id: userId, ...profileData })
      .select()
      .single();

    if (insertError) throw insertError;
    return insertedProfile;
  }

  return updatedProfile;
}

/**
 * Creación de cuenta operativa (alias heredado)
 */
export async function createDeliveryUser(payload) {
  return createDeliveryStaff(payload);
}

/**
 * Eliminación segura con desvinculación foránea
 */
export async function deleteDeliveryStaff(staffId) {
  // A. Pedidos en ruta/incidencia vuelven a la bolsa común; el resto de pedidos no finalizados solo se desvincula
  const FINAL_STATUSES = '("entregado","delivered","cancelado","cancelled")';

  await supabase
    .from("orders")
    .update({
      assigned_delivery_id: null,
      status: "por_asignar_repartidor",
      incident_reason: null,
      incident_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq("assigned_delivery_id", staffId)
    .in("status", ["en_camino", "cerca", "dispatched", "nearby", "incidencia_transporte"]);

  await supabase
    .from("orders")
    .update({ assigned_delivery_id: null })
    .eq("assigned_delivery_id", staffId)
    .not("status", "in", FINAL_STATUSES);

  // B. Eliminar el perfil en la tabla profiles
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", staffId);

  if (error) throw error;
  return true;
}

/**
 * Eliminación segura de repartidor (alias heredado)
 */
export async function deleteDeliveryUser(staffId) {
  return deleteDeliveryStaff(staffId);
}