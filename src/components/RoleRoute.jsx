import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protege vistas de clientes evitando el ingreso del rol delivery,
 * y protege /reparto evitando el ingreso de clientes comunes.
 */
export function DeliveryOnlyRoute({ children }) {
  const { user, profile, role, isDelivery, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "delivery" && profile?.role !== "delivery" && !isDelivery) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function ShopCustomerRoute({ children }) {
  const { profile, role, isDelivery, loading } = useAuth();

  if (loading) return null;
  // Si el usuario autenticado es delivery, no puede ver el catálogo ni comprar
  if (role === "delivery" || profile?.role === "delivery" || isDelivery) {
    return <Navigate to="/reparto" replace />;
  }

  return children;
}
