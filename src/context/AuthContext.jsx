import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { ADMIN_LAST_ROUTE_KEY } from "../features/admin/components/AdminLayout";

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
      if (data?.role && typeof window !== "undefined") {
        sessionStorage.setItem("erxidi_user_role", data.role);
      }
    } catch (err) {
      console.error("Error al resolver perfil de usuario:", err.message);
      setProfile(null);
    }
  }

  useEffect(() => {
    // 1. Obtener la sesión activa al montar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Limpieza de residuos de la antigua sesión permisiva (sin verificar).
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("erxidi_unconfirmed_user");
      }
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // 2. Escuchar cambios de estado (LOGIN, LOGOUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile(currentUser.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getEmailRedirectUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/catalogo`
      : "https://erxidi-web.vercel.app/catalogo";

  // Métodos de autenticación desacoplados
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password, metadata = {}) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Se mapea en el trigger handle_new_user()
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });

  // Reenvío del enlace nativo de confirmación de correo electrónico
  const resendConfirmationEmail = (email) =>
    supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });

  const signOut = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("erxidi_unconfirmed_user");
      sessionStorage.removeItem("erxidi_user_role");
      localStorage.removeItem(ADMIN_LAST_ROUTE_KEY);
    }
    setUser(null);
    setProfile(null);
    return supabase.auth.signOut();
  };

  const cachedRole =
    typeof window !== "undefined"
      ? sessionStorage.getItem("erxidi_user_role")
      : null;
  const resolvedRole =
    profile?.role ?? user?.user_metadata?.role ?? cachedRole ?? "customer";

  const value = {
    user,
    profile,
    role: resolvedRole,
    isOwner: resolvedRole === "owner",
    isDelivery: resolvedRole === "delivery",
    loading,
    signIn,
    signUp,
    resendConfirmationEmail,
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
