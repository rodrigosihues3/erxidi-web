import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useParams,
  useNavigate,
} from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider, useCart } from "./context/CartContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DesignSystemShowcase from "./features/dev/DesignSystemShowcase";
import LoginView from "./features/auth/LoginView";
import MainLayout from "./components/layout/MainLayout";
import Button from "./components/ui/Button";

//admin
import AdminLayout from "./features/admin/components/AdminLayout";
import AdminProtectedRoute from "./features/admin/components/ProtectedRoute";
import DashboardView from "./features/admin/views/DashboardView";
import OrdersListView from "./features/admin/views/OrdersListView";
import OrderDetailView from "./features/admin/views/OrderDetailView";
import ProductsListView from "./features/admin/views/ProductsListView";
import ProductFormView from "./features/admin/views/ProductFormView";
import CategoriesView from "./features/admin/views/CategoriesView";
import DeliveryUsersView from "./features/admin/views/DeliveryUsersView";
import CoverageSettingsView from "./features/admin/views/CoverageSettingsView";

// Home & Catálogo
import HomeView from "./features/home/HomeView";
import CatalogView from "./features/catalog/CatalogView";
import ProductDetailView from "./features/catalog/ProductDetailView";
import CheckoutView from "./features/checkout/CheckoutView";
import OrderConfirmationView from "./features/checkout/OrderConfirmationView";
import OrderTrackingView from "./features/tracking/OrderTrackingView";
import ProfileView from "./features/account/ProfileView";
import OrdersHistoryView from "./features/account/OrdersHistoryView";
import UpdatePasswordView from "./features/auth/UpdatePasswordView";
import { getProductBySlug } from "./services/api/catalogService";
import { DeliveryOnlyRoute, ShopCustomerRoute } from "./components/RoleRoute";
import DeliveryDashboard from "./features/delivery/DeliveryDashboard";

// Contenedor que resuelve el producto dinámicamente desde Supabase
function ProductDetailRouteWrapper() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getProductBySlug(slug)
      .then((data) => {
        if (isMounted) {
          if (!data) {
            setError("La prenda solicitada no se encuentra disponible.");
          } else {
            setProduct(data);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Error al conectar con la base de datos.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs font-semibold text-brand-secondary">
          Cargando prenda...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 text-center bg-surface-card border border-border rounded-card space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-brand-primary">
            Prenda no encontrada
          </h2>
          <p className="text-xs text-brand-secondary">
            {error ||
              "El producto que buscas no está disponible en nuestro catálogo."}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate("/catalogo")}
        >
          Volver al Catálogo
        </Button>
      </div>
    );
  }

  return (
    <ProductDetailView
      product={product}
      onBack={() => navigate("/catalogo")}
      onAddToCart={(variant, quantity) => {
        addItem?.(
          {
            variantId: variant.id,
            productId: product.id,
            name: product.name,
            size: variant.sizes?.name || "M",
            color: variant.color || "",
            colorHex: variant.color_hex || "#111827",
            price: product.price,
            stock: variant.stock,
            imageUrl: product.main_image_url,
          },
          quantity,
        );
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Layout Global con Navbar y Footer */}
            <Route element={<MainLayout />}>
              {/* Rutas Comerciales: Bloqueadas para el rol delivery */}
              <Route
                element={
                  <ShopCustomerRoute>
                    {/* Outlet implícito o render directo si ShopCustomerRoute devuelve children */}
                    <Outlet />
                  </ShopCustomerRoute>
                }
              >
                <Route path="/" element={<HomeView />} />
                <Route path="/catalogo" element={<CatalogView />} />
                <Route
                  path="/producto/:slug"
                  element={<ProductDetailRouteWrapper />}
                />
                <Route path="/checkout" element={<CheckoutView />} />
                <Route
                  path="/checkout/confirmacion/:orderNumber"
                  element={<OrderConfirmationView />}
                />
              </Route>

              {/* Rutas Públicas Operativas (Accesibles por todos) */}
              <Route
                path="/seguimiento/:orderNumber"
                element={<OrderTrackingView />}
              />
              <Route path="/ui" element={<DesignSystemShowcase />} />
              <Route path="/login" element={<LoginView />} />
              <Route
                path="/actualizar-password"
                element={<UpdatePasswordView />}
              />

              {/* Rutas Protegidas de Cliente */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["customer", "owner"]} />
                }
              >
                <Route path="/mi-cuenta" element={<ProfileView />} />
                <Route path="/perfil" element={<ProfileView />} />
                <Route
                  path="/mi-cuenta/pedidos"
                  element={<OrdersHistoryView />}
                />
                <Route path="/mis-pedidos" element={<OrdersHistoryView />} />
              </Route>

              {/* Ruta exclusiva de repartidor: Con Navbar mediante MainLayout */}
              <Route element={<ProtectedRoute allowedRoles={["delivery"]} />}>
                <Route
                  path="/reparto"
                  element={
                    <DeliveryOnlyRoute>
                      <DeliveryDashboard />
                    </DeliveryOnlyRoute>
                  }
                />
              </Route>
            </Route>

            {/* Backoffice: solo owner/admin. El esquema actual permite owner como rol administrativo. */}
            <Route element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<DashboardView />} />
                <Route path="/admin/pedidos" element={<OrdersListView />} />
                <Route path="/admin/pedidos/:orderNumber" element={<OrderDetailView />} />
                <Route path="/admin/productos" element={<ProductsListView />} />
                <Route path="/admin/productos/nuevo" element={<ProductFormView />} />
                <Route path="/admin/productos/:id/editar" element={<ProductFormView />} />
                <Route path="/admin/categorias" element={<CategoriesView />} />
                <Route path="/admin/repartidores" element={<DeliveryUsersView />} />
                <Route path="/admin/cobertura" element={<CoverageSettingsView />} />
              </Route>
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
