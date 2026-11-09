import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SizeMatcherModal from "../../features/catalog/components/SizeMatcherModal";
import CartDrawer from "../../features/cart/CartDrawer";

export default function MainLayout() {
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const { isCartOpen, openCartDrawer, closeCartDrawer } = useCart();
  const { profile, role, isDelivery: authIsDelivery } = useAuth();
  const location = useLocation();

  const isDelivery =
    authIsDelivery ||
    role === "delivery" ||
    profile?.role === "delivery" ||
    location.pathname.startsWith("/reparto");

  return (
    <div className="flex flex-col min-h-screen bg-surface-app text-brand-primary">
      {!isDelivery && (
        <Navbar
          onOpenSizeMatcher={() => setIsSizeMatcherOpen(true)}
          onOpenCartDrawer={openCartDrawer}
        />
      )}

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {!isDelivery && (
        <Footer onOpenSizeMatcher={() => setIsSizeMatcherOpen(true)} />
      )}

      {/* Global Size Matcher Modal */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
      />

      {/* Global Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={closeCartDrawer}
      />
    </div>
  );
}
