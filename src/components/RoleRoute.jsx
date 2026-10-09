import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protege vistas de clientes evitando el ingreso del rol delivery,
 * y protege /reparto evitando el ingreso de clientes comunes.
 */
export function DeliveryOnlyRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== "delivery") return <Navigate to="/" replace />;

  return children;
}

export function ShopCustomerRoute({ children }) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  // Si el usuario autenticado es delivery, no puede ver el catálogo ni comprar
  if (profile?.role === "delivery") {
    return <Navigate to="/reparto" replace />;
  }

  return children;
}
