import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables de entorno no detectadas: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.local de la raíz.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
