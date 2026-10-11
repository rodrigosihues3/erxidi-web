import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Menu,
  X,
  User,
  LogOut,
  Ruler,
  ChevronDown,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import Button from "../ui/Button";

export default function Navbar({ onOpenSizeMatcher, onOpenCartDrawer }) {
  const { user, profile, role, isDelivery: authIsDelivery, signOut } = useAuth();
  const { totalUnits } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Cerrar menú de usuario al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  const navLinks = [
    { label: "Inicio", path: "/" },
    { label: "Catálogo", path: "/catalogo" },
    // { label: "Sistema UI", path: "/ui" },
  ];

  const displayName =
    profile?.first_name ||
    profile?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  const userInitial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    await signOut();
    navigate("/login");
  };

  // Evaluación robusta considerando auth context, profile, metadata y ruta actual
  const isDelivery =
    authIsDelivery ||
    role === "delivery" ||
    profile?.role === "delivery" ||
    user?.user_metadata?.role === "delivery" ||
    user?.app_metadata?.role === "delivery" ||
    location.pathname.startsWith("/reparto");

  // -----------------------------------------------------------------
  // 1. HEADER EXCLUSIVO PARA REPARTIDOR (Visible en Móvil y Desktop)
  // -----------------------------------------------------------------
  if (isDelivery) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface-card px-4 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/reparto"
              className="font-extrabold text-base sm:text-lg text-brand-primary tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2"
              aria-label="ERXIDI Reparto"
            >
              ERXIDI
            </Link>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-badge shrink-0">
              <Truck className="w-3.5 h-3.5" />
              Reparto
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                {userInitial}
              </span>
              <span className="text-xs font-semibold text-brand-primary hidden sm:inline truncate max-w-[150px]">
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              title="Cerrar sesión de repartidor"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  // -----------------------------------------------------------------
  // 2. HEADER GENERAL DE TIENDA Y ADMINISTRACIÓN
  // -----------------------------------------------------------------
  return (
    <header className="sticky top-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-border/20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Structure: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="font-extrabold tracking-tight text-white text-xl hover:opacity-90 transition-opacity"
            aria-label="ERXIDI Inicio"
          >
            ERXIDI
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ${
                    isActive
                      ? "text-accent"
                      : "text-brand-muted hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right Structure: Cart, Auth, and Mobile Toggle */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Size Matcher Global Trigger */}
          <button
            type="button"
            onClick={onOpenSizeMatcher}
            className="hover:bg-slate-800 rounded px-2.5 py-1.5 text-xs text-brand-muted hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
            aria-label="Calcular mi talla"
          >
            <Ruler className="w-4 h-4 text-accent" />
            <span>Calcular mi talla</span>
          </button>

          {/* Cart Interactive Button */}
          <button
            type="button"
            onClick={onOpenCartDrawer}
            className="relative p-2 rounded-button text-brand-muted hover:text-white hover:bg-white/5 transition-colors duration-150 flex items-center justify-center focus:outline-none"
            aria-label={`Ver carrito con ${totalUnits} prendas`}
          >
            <ShoppingCart className="w-5 h-5" />
            {totalUnits > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-white font-mono text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-badge flex items-center justify-center border-2 border-brand-primary">
                {totalUnits}
              </span>
            )}
          </button>

          {/* Desktop Auth Section */}
          <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-border/20">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Botón Panel Admin exclusivo para Dueña */}
                {(role === "owner" ||
                  role === "admin" ||
                  profile?.role === "owner") && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-button text-xs font-semibold text-white bg-white/10 hover:bg-accent transition-colors"
                    title="Ir al panel administrativo"
                  >
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span>Panel Admin</span>
                  </Link>
                )}

                {/* Botón Panel Reparto para Repartidores */}
                {(role === "delivery" || profile?.role === "delivery" || isDelivery) && (
                  <Link
                    to="/reparto"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-button text-xs font-semibold text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                    title="Ir al panel de reparto"
                  >
                    <Truck className="w-4 h-4 text-amber-300" />
                    <span>Panel Reparto</span>
                  </Link>
                )}

                {/* Dropdown de Usuario con Perfil y Mis Pedidos */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 p-1.5 rounded-button text-xs hover:bg-white/10 transition-colors focus:outline-none"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    aria-label="Abrir menú de usuario"
                  >
                    <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {userInitial}
                    </span>
                    <span className="font-semibold text-white max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-brand-muted transition-transform duration-150 ${
                        userMenuOpen ? "rotate-180 text-white" : ""
                      }`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-surface-card border border-border rounded-card shadow-lg py-1.5 z-50 animate-in fade-in duration-100 text-brand-primary">
                      <div className="px-3.5 py-2 border-b border-border">
                        <p className="text-xs font-bold truncate text-brand-primary">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-brand-secondary truncate">
                          {user.email}
                        </p>
                      </div>

                      <Link
                        to="/mi-cuenta"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-surface-subtle transition-colors"
                      >
                        <User className="w-4 h-4 text-accent" />
                        Mi Perfil
                      </Link>

                      <Link
                        to="/mi-cuenta/pedidos"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold hover:bg-surface-subtle transition-colors"
                      >
                        <Package className="w-4 h-4 text-accent" />
                        Mis Pedidos
                      </Link>

                      {(role === "delivery" || profile?.role === "delivery" || isDelivery) && (
                        <Link
                          to="/reparto"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                        >
                          <Truck className="w-4 h-4 text-amber-600" />
                          Panel de Reparto
                        </Link>
                      )}

                      <div className="my-1 border-t border-border" />

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login?tab=register">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 text-xs font-semibold px-3 h-8"
                  >
                    Registrarse
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-4 h-8"
                  >
                    Ingresar
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-button text-brand-muted hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Drawer/Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-brand-primary border-b border-border/20 px-4 pt-3 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-button text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-white/10 text-accent"
                      : "text-brand-muted hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile Auth Divider */}
          <div className="pt-3 border-t border-border/20">
            {user ? (
              <div className="space-y-2">
                {(role === "owner" ||
                  role === "admin" ||
                  profile?.role === "owner") && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-button text-sm font-semibold text-white bg-white/10 hover:bg-accent transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span>Panel Admin</span>
                  </Link>
                )}

                {(role === "delivery" || profile?.role === "delivery" || isDelivery) && (
                  <Link
                    to="/reparto"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-button text-sm font-semibold text-amber-300 bg-white/10 hover:bg-accent transition-colors"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Panel de Reparto</span>
                  </Link>
                )}

                <div className="flex items-center gap-2.5 px-3 py-2 bg-white/5 rounded-button">
                  <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs">
                    {userInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-brand-muted truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <Link
                    to="/mi-cuenta"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-muted hover:text-white hover:bg-white/5 rounded-button"
                  >
                    <User className="w-4 h-4 text-accent" />
                    Mi Perfil
                  </Link>

                  <Link
                    to="/mi-cuenta/pedidos"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-muted hover:text-white hover:bg-white/5 rounded-button"
                  >
                    <Package className="w-4 h-4 text-accent" />
                    Mis Pedidos
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-white/5 rounded-button text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login?tab=register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 text-xs font-semibold h-8"
                  >
                    Registrarse
                  </Button>
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block"
                >
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold h-8"
                  >
                    Ingresar
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
