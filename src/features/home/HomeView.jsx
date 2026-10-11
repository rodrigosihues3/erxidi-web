import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Truck,
  Package,
  Ruler,
  ArrowRight,
  CheckCircle2,
  Layers,
  Scissors,
  ShieldCheck,
  Plus,
  Tag,
  Check,
} from "lucide-react";
import heroImg from "../../assets/hero.png";
import { mockProducts } from "../catalog/data/mockCatalog";
import ProductCard from "../catalog/components/ProductCard";
import SizeMatcherModal from "../catalog/components/SizeMatcherModal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useCart } from "../../context/CartContext";

export default function HomeView() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [suggestedSize, setSuggestedSize] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);

  const featuredProducts = useMemo(() => {
    const featured = mockProducts.filter((p) => p.is_featured);
    return featured.length > 0 ? featured : mockProducts.slice(0, 4);
  }, []);

  const handleProductSelect = (product) => {
    navigate(`/producto/${product.slug}`);
  };

  const handleQuickAdd = (product) => {
    const availableVariant =
      product.product_variants?.find(
        (v) => (v.stock || 0) > 0 && v.is_active !== false,
      ) || product.product_variants?.[0];

    if (availableVariant) {
      try {
        addItem(
          {
            variantId: availableVariant.id,
            productId: product.id,
            name: product.name,
            size: availableVariant.sizes?.name || "M",
            color: availableVariant.color || "",
            colorHex: availableVariant.color_hex || "#111827",
            price: product.price,
            stock: availableVariant.stock,
            imageUrl: product.main_image_url,
          },
          1,
        );
      } catch (err) {
        console.error("No se pudo añadir al carrito:", err.message);
      }
    }
  };

  // Coordenadas calibradas para la silueta del boxer
  const hotspots = [
    {
      id: "waist",
      x: "50%",
      y: "18%",
      title: "Pretina de Ajuste Firme",
      desc: "Elástico afelpado reforzado que sostiene sin estrangular ni marcar la piel.",
    },
    {
      id: "cup",
      x: "40%",
      y: "48%",
      title: "Corte Anatómico Diario",
      desc: "Soporte ergonómico con costuras redondeadas para libertad de movimiento.",
    },
    {
      id: "hem",
      x: "68%",
      y: "78%",
      title: "Terminación Antirroce",
      desc: "Basta al ras de cuatro hilos que no se enrolla ni irrita el muslo.",
    },
  ];

  // Pilares sustentables para la formalización del negocio local
  const retailSpecs = [
    {
      icon: Layers,
      title: "Confección Nacional",
      highlight: "Algodón peruano de uso diario",
      desc: "Tejido fresco y resistente al lavado frecuente, preservando color y elasticidad.",
    },
    {
      icon: Tag,
      title: "Precio Directo",
      highlight: "Sin sobreprecios de cadena",
      desc: "El valor real de confección local por unidad o pack, sin intermediarios abusivos.",
    },
    {
      icon: Truck,
      title: "Ruta Local Directa",
      highlight: "Tarifa métrica real",
      desc: "Despacho ágil en zona de cobertura y opción de recojo en taller sin costo.",
    },
    {
      icon: Package,
      title: "Prenda Protegida",
      highlight: "Empaque higiénico",
      desc: "Unidades embolsadas individualmente para garantizar cero pruebas previas.",
    },
  ];

  return (
    <div className="space-y-16 lg:space-y-24 pb-16">
      {/* 1. Hero Section con Prenda Flotante Mimetizada */}
      <section className="relative overflow-hidden bg-brand-primary text-white py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/20">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent/15 blur-3xl pointer-events-none rounded-full"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
          {/* Columna Izquierda: Mensaje y Acciones */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-badge bg-white/10 border border-white/20 text-xs font-semibold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Confección Local &bull; Venta Directa en Lima Norte</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              El verdadero confort comienza{" "}
              <span className="text-accent underline decoration-accent/40 decoration-wavy">
                en tu primera capa
              </span>
              .
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Prendas íntimas esenciales elaboradas en algodón nacional con
              calce ergonómico. Comodidad duradera y elasticidad equilibrada
              para acompañar tu jornada diaria sin molestias.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-1">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate("/catalogo")}
                className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white shadow-md text-xs sm:text-sm px-7"
              >
                Explorar Catálogo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsSizeMatcherOpen(true)}
                className="w-full sm:w-auto bg-transparent border-white/30 text-white hover:bg-white/10 text-xs sm:text-sm px-6"
              >
                <Ruler className="w-4 h-4 mr-2 text-accent" />
                Calcular mi Talla
              </Button>
            </div>

            {suggestedSize && (
              <div className="pt-2 flex justify-center lg:justify-start">
                <Badge variant="success" className="text-xs py-1 px-3">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Tu talla recomendada es: {suggestedSize}
                </Badge>
              </div>
            )}
          </div>

          {/* Columna Derecha: Showcase Flotante Sin Caja Blanca */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-md flex flex-col items-center">
              {/* Resplandor radial de fondo */}
              <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full pointer-events-none" />

              <div className="relative aspect-[4/5] w-full flex items-center justify-center select-none">
                <img
                  src={heroImg}
                  alt="Prenda ERXIDI Boxer Brief"
                  className="w-full h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
                  loading="eager"
                />

                {/* Hotspots interactivos */}
                {hotspots.map((spot) => {
                  const isActive = activeHotspot === spot.id;
                  return (
                    <div
                      key={spot.id}
                      style={{ top: spot.y, left: spot.x }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHotspot(isActive ? null : spot.id)
                        }
                        onMouseEnter={() => setActiveHotspot(spot.id)}
                        className="group relative flex items-center justify-center focus:outline-none"
                        aria-label={spot.title}
                      >
                        <span className="absolute h-6 w-6 rounded-full bg-accent/40 animate-ping" />
                        <span className="relative flex h-5 w-5 rounded-full border-2 border-white bg-accent text-white items-center justify-center shadow-lg transition-transform duration-150 group-hover:scale-110">
                          <Plus
                            className={`w-3 h-3 transition-transform duration-150 ${isActive ? "rotate-45" : ""}`}
                          />
                        </span>
                      </button>

                      {/* Micro-etiqueta flotante */}
                      {isActive && (
                        <div className="absolute top-7 left-1/2 -translate-x-1/2 w-48 bg-slate-950/95 border border-white/20 text-white rounded-lg p-2.5 shadow-2xl z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <strong className="block text-[11px] font-bold text-accent leading-tight">
                            {spot.title}
                          </strong>
                          <span className="block text-[10px] text-slate-300 mt-0.5 leading-snug">
                            {spot.desc}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Indicador inferior sutil */}
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>Toca los puntos (+) para inspeccionar acabados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Sección de Propuesta de Valor con Encabezado Completo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-accent">
            Formalización &bull; Cadena Textil Local
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-primary">
            Ropa interior esencial directa de taller
          </h2>
          <p className="text-xs text-brand-secondary">
            Conectamos la confección nacional con el cliente final sin
            sobrecostos de intermediarios ni promesas falsas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {retailSpecs.map((spec, idx) => {
            const Icon = spec.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-surface-card hover:border-brand-primary/40 hover:shadow-subtle transition-all duration-150 flex items-start gap-3.5"
              >
                <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0 text-brand-primary mt-0.5">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-brand-primary truncate">
                    {spec.title}
                  </h3>
                  <span className="block text-[10px] font-semibold text-accent uppercase tracking-wider">
                    {spec.highlight}
                  </span>
                  <p className="text-[11px] text-brand-secondary mt-1 leading-snug">
                    {spec.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Prendas Destacadas */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <Badge variant="neutral" className="text-[11px] mb-2">
              Línea Base Esencial
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-primary">
              Prendas Destacadas
            </h2>
            <p className="text-xs text-brand-secondary mt-1">
              Esenciales anatómicos confeccionados en corte boxer brief.
            </p>
          </div>

          <Link
            to="/catalogo"
            className="inline-flex items-center text-xs font-bold text-accent hover:text-accent-hover hover:underline transition-colors"
          >
            Ver todo el catálogo
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={handleProductSelect}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>

        <div className="text-center pt-4">
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate("/catalogo")}
            className="text-xs font-semibold"
          >
            Explorar todas las categorías y cortes
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </section>

      {/* 4. Banner de Calce Antropométrico */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-brand-primary rounded-card text-white p-8 sm:p-12 border border-border/20 shadow-dropdown">
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge bg-white/10 text-[11px] font-semibold text-slate-300">
              <Ruler className="w-3.5 h-3.5 text-accent" />
              <span>Calce Sin Errores ERXIDI</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Garantiza tu talla a la primera. Cero margen de error.
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Por razones sanitarias la ropa interior no admite cambios tras ser
              entregada. Ingresa tu estatura, peso y complexión para obtener tu
              recomendación anatómica exacta antes de ordenar.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsSizeMatcherOpen(true)}
                className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-6"
              >
                Calcular mi Talla Ahora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <span className="text-[11px] text-slate-400">
                100% privado y sin registros
              </span>
            </div>
          </div>

          <div
            className="hidden md:block absolute -right-6 -bottom-10 opacity-10 text-white pointer-events-none"
            aria-hidden="true"
          >
            <Ruler className="w-64 h-64 stroke-1" />
          </div>
        </div>
      </section>

      {/* Modal de Tallas */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
        onSizeSelected={(sizeName) => setSuggestedSize(sizeName)}
      />
    </div>
  );
}
