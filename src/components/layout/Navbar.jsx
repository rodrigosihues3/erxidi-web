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
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { supabase } from "../../services/supabase";
import Button from "../ui/Button";

export default function Navbar({ onOpenSizeMatcher, onOpenCartDrawer }) {
  const { user, profile, role, isDelivery: authIsDelivery, signOut } = useAuth();
  const { totalUnits } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Estados del buscador
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [matchingProducts, setMatchingProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchContainerRef = useRef(null);

  // Búsqueda en Supabase con debounce de 300ms sobre productos reales
  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || query.length < 2) {
      setMatchingProducts([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        // Criterio: Coincidencia en nombre o slug del producto activo en BD real
        const safeQuery = query.replace(/[%_,]/g, " ");
        const { data, error } = await supabase
          .from("products")
          .select("id, name, slug, price, main_image_url, target_gender, categories(name)")
          .eq("is_active", true)
          .ilike("name", `%${safeQuery}%`)
          .limit(4);

        if (!error && data) {
          setMatchingProducts(data);
        }
      } catch (err) {
        console.error("Error en búsqueda rápida de navbar:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Cerrar dropdown al hacer clic fuera o Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setIsSearchOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Cerrar menú móvil automáticamente al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchTerm.trim();
    setIsSearchOpen(false);
    if (query) {
      navigate(`/catalogo?q=${encodeURIComponent(query)}`);
    } else {
      navigate("/catalogo");
    }
  };

  const handleSelectProduct = (slug) => {
    setIsSearchOpen(false);
    setSearchTerm("");
    navigate(`/producto/${slug}`);
  };

  const navLinks = [
    { label: "Inicio", path: "/" },
    { label: "Catálogo", path: "/catalogo" },
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

  const isDelivery =
    authIsDelivery ||
    role === "delivery" ||
    profile?.role === "delivery" ||
    user?.user_metadata?.role === "delivery" ||
    user?.app_metadata?.role === "delivery" ||
    location.pathname.startsWith("/reparto");

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

  return (
    <header className="sticky top-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-border/20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logotipo y Navegación izquierda */}
        <div className="flex items-center gap-6 lg:gap-8 shrink-0">
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
                  `text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ${isActive ? "text-accent" : "text-brand-muted hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Buscador Compacto conectado a Supabase */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 sm:mx-6 min-w-0"
        >
          <form onSubmit={handleSearchSubmit} className="relative w-full" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchTerm.trim()) setIsSearchOpen(true);
              }}
              placeholder="Buscar por nombre de prenda..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 text-white placeholder:text-brand-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all duration-150"
              aria-label="Buscar prendas"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setIsSearchOpen(false);
                  setMatchingProducts([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white p-0.5 rounded-full"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Resultados Flotantes */}
          {isSearchOpen && searchTerm.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden z-50 text-brand-primary">
              <div className="px-3.5 py-2 border-b border-border bg-surface-subtle/50 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">
                  Resultados sugeridos
                </span>
                {searching && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
              </div>

              {matchingProducts.length > 0 ? (
                <div className="divide-y divide-border">
                  {matchingProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product.slug)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-surface-subtle transition-colors flex items-center gap-3 group focus:outline-none"
                    >
                      <div className="w-10 h-10 rounded border border-border bg-surface-subtle overflow-hidden shrink-0">
                        {product.main_image_url ? (
                          <img
                            src={product.main_image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-brand-muted">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-brand-primary truncate group-hover:text-accent transition-colors">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-brand-secondary truncate">
                          {product.categories?.name || "Prenda"} •{" "}
                          <span className="capitalize">{product.target_gender}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-brand-primary">
                          S/ {Number(product.price || 0).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : !searching ? (
                <div className="p-4 text-center">
                  <p className="text-xs font-medium text-brand-secondary">
                    No se encontraron prendas con &ldquo;{searchTerm}&rdquo;
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Acciones del lado derecho */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={onOpenSizeMatcher}
            className="hover:bg-slate-800 rounded px-2 sm:px-2.5 py-1.5 text-xs text-brand-muted hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
            aria-label="Calcular mi talla"
            title="Calcular mi talla"
          >
            <Ruler className="w-4 h-4 text-accent" />
            <span className="hidden sm:inline">Calcular mi talla</span>
          </button>

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

          <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-border/20">
            {user ? (
              <div className="flex items-center gap-3">
                {(role === "owner" || role === "admin" || profile?.role === "owner") && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-button text-xs font-semibold text-white bg-white/10 hover:bg-accent transition-colors"
                    title="Ir al panel administrativo"
                  >
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span>Panel Admin</span>
                  </Link>
                )}

                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 p-1.5 rounded-button text-xs hover:bg-white/10 transition-colors focus:outline-none"
                    aria-expanded={userMenuOpen}
                  >
                    <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {userInitial}
                    </span>
                    <span className="font-semibold text-white max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-brand-muted transition-transform duration-150 ${userMenuOpen ? "rotate-180 text-white" : ""
                        }`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-surface-card border border-border rounded-card shadow-lg py-1.5 z-50 text-brand-primary">
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

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-button text-brand-muted hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menú Móvil Desplegable */}
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

          {/* Divisor de Autenticación Móvil */}
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