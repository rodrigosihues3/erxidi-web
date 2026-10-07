import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider, useCart } from "./context/CartContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DesignSystemShowcase from "./features/dev/DesignSystemShowcase";
import LoginView from "./features/auth/LoginView";
import MainLayout from "./components/layout/MainLayout";

// Home & Catálogo
import HomeView from "./features/home/HomeView";
import CatalogView from "./features/catalog/CatalogView";
import ProductDetailView from "./features/catalog/ProductDetailView";
import { mockProducts } from "./features/catalog/data/mockCatalog";

// Contenedor que resuelve el producto según el slug de la URL
function ProductDetailRouteWrapper() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  // Resolución desde datos mock (temporal)
  const product = mockProducts.find((p) => p.slug === slug) || mockProducts[0];

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
          quantity
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
              {/* Rutas Públicas */}
              <Route path="/" element={<HomeView />} />
              <Route path="/catalogo" element={<CatalogView />} />
              <Route
                path="/producto/:slug"
                element={<ProductDetailRouteWrapper />}
              />
              <Route path="/ui" element={<DesignSystemShowcase />} />
              <Route path="/login" element={<LoginView />} />

              {/* Rutas Protegidas de Cliente */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["customer", "owner"]} />
                }
              >
                <Route
                  path="/checkout"
                  element={
                    <div className="p-8">Vista Checkout (En desarrollo)</div>
                  }
                />
                <Route
                  path="/mis-pedidos"
                  element={
                    <div className="p-8">
                      Historial de Pedidos (En desarrollo)
                    </div>
                  }
                />
              </Route>

              {/* Rutas Protegidas de Administración (Dueña) */}
              <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
                <Route
                  path="/admin/*"
                  element={
                    <div className="p-8">
                      Panel de Administración (En desarrollo)
                    </div>
                  }
                />
              </Route>

              {/* Rutas Protegidas de Logística (Repartidor) */}
              <Route element={<ProtectedRoute allowedRoles={["delivery"]} />}>
                <Route
                  path="/reparto"
                  element={
                    <div className="p-8">
                      Bandeja de Reparto (En desarrollo)
                    </div>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
