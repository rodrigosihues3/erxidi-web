import { supabase } from "../../../services/supabase";

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
export async function updateDeliveryUser(id, values) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      dni: values.dni,
      first_name: values.first_name,
      paternal_surname: values.paternal_surname,
      maternal_surname: values.maternal_surname,
      phone: values.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("role", "delivery")
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}