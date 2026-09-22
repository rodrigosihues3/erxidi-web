import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Consulta el perfil asociado al UID de autenticación
  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error al resolver perfil de usuario:", err.message);
      setProfile(null);
    }
  }

  useEffect(() => {
    // 1. Obtener la sesión activa al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // 2. Escuchar cambios de estado (LOGIN, LOGOUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Métodos de autenticación desacoplados
  const signIn = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = (email, password, metadata = {}) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Se mapea en el trigger handle_new_user()
      },
    });
  };

  const signOut = () => {
    return supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    role: profile?.role ?? "customer",
    isOwner: profile?.role === "owner",
    isDelivery: profile?.role === "delivery",
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  }
  return context;
}
