import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SizeMatcherModal from "../../features/catalog/components/SizeMatcherModal";
import CartDrawer from "../../features/cart/CartDrawer";

export default function MainLayout() {
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-surface-app text-brand-primary">
      <Navbar
        onOpenSizeMatcher={() => setIsSizeMatcherOpen(true)}
        onOpenCartDrawer={() => setIsCartDrawerOpen(true)}
      />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer onOpenSizeMatcher={() => setIsSizeMatcherOpen(true)} />

      {/* Global Size Matcher Modal */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
      />

      {/* Global Cart Drawer */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
      />
    </div>
  );
}
