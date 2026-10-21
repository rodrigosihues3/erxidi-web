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
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else if (typeof window !== "undefined") {
        const cachedUnconfirmed = sessionStorage.getItem("erxidi_unconfirmed_user");
        if (cachedUnconfirmed) {
          try {
            const parsed = JSON.parse(cachedUnconfirmed);
            setUser(parsed);
            await fetchProfile(parsed.id);
          } catch (e) {
            // Ignorar error de parseo
          }
        }
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
        const cachedUnconfirmed =
          typeof window !== "undefined"
            ? sessionStorage.getItem("erxidi_unconfirmed_user")
            : null;
        if (!cachedUnconfirmed) {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Métodos de autenticación desacoplados
  const signIn = async (email, password) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error && res.error.message?.toLowerCase().includes("email not confirmed")) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        const unconfirmedUser = {
          id: prof?.id || `unconfirmed-${email}`,
          email,
          email_confirmed_at: null,
          user_metadata: {
            first_name: prof?.first_name || email.split("@")[0],
          },
        };
        setUser(unconfirmedUser);
        if (prof) setProfile(prof);
        else if (unconfirmedUser.id) fetchProfile(unconfirmedUser.id);

        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "erxidi_unconfirmed_user",
            JSON.stringify(unconfirmedUser)
          );
        }

        return { data: { user: unconfirmedUser, session: null }, error: null };
      } catch (e) {
        console.warn("Error resolviendo usuario no verificado:", e);
      }
    }
    return res;
  };

  const signUp = async (email, password, metadata = {}) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // Se mapea en el trigger handle_new_user()
      },
    });

    // Si se crea el usuario pero queda pendiente de confirmación, mantenerlo en sesión permisiva
    if (res.data?.user && !res.data?.session) {
      const unconfirmedUser = {
        ...res.data.user,
        email_confirmed_at: null,
      };
      setUser(unconfirmedUser);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "erxidi_unconfirmed_user",
          JSON.stringify(unconfirmedUser)
        );
      }
    }

    return res;
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("erxidi_unconfirmed_user");
      sessionStorage.removeItem("erxidi_user_role");
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
