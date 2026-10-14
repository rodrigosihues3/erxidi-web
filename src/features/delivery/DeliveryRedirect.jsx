import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Páginas de la tienda de las que el repartidor debe salir de inmediato
const STORE_PATHS = ["/", "/login"];

// No dibuja nada: solo lleva al repartidor a su módulo.
// Como mira el estado de la sesión y no el formulario de login, funciona
// igual al iniciar sesión, al recargar la página o al volver a la tienda.
export default function DeliveryRedirect() {
  const { user, profile, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;

    // El perfil (y su rol) llega un instante después de la sesión
    if (profile?.role === "delivery" && STORE_PATHS.includes(pathname)) {
      navigate("/reparto", { replace: true });
    }
  }, [loading, user, profile, pathname, navigate]);

  return null;
}
