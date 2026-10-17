import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Ruler,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  PackageCheck,
  Truck,
  Plus,
  Coins,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import heroImg from "../../assets/hero.png";
import mediaImg from "../../assets/mediasImg.png";
import trusaImg from "../../assets/trusaImg.png";
import topImg from "../../assets/topImg.png";
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [genderFilter, setGenderFilter] = useState("all");

  const featuredProducts = useMemo(() => {
    let list = mockProducts.filter((p) => p.is_featured);
    if (list.length === 0) list = mockProducts.slice(0, 4);

    if (genderFilter !== "all") {
      list = list.filter((p) => p.target_gender === genderFilter);
    }
    return list;
  }, [genderFilter]);

  const handleProductSelect = (product) => {
    navigate(`/producto/${product.slug}`);
  };

  const handleQuickAdd = (product) => {
    const availableVariant = product.product_variants?.find(
      (v) => (v.stock || 0) > 0 && v.is_active !== false
    );

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
          1
        );
      } catch (err) {
        console.error("No se pudo añadir al carrito:", err.message);
      }
    }
  };

  // Catálogo de prendas para el carrusel flotante con sus respectivos hotspots
  const carouselItems = [
    {
      id: "boxer",
      name: "Bóxer Brief Anatómico",
      category: "Línea Masculina",
      image: heroImg,
      alt: "Bóxer Anatómico ERXIDI",
      hotspots: [
        {
          id: "waist",
          x: "50%",
          y: "18%",
          title: "Pretina de Ajuste Firme",
          desc: "Elástico afelpado reforzado que sostiene sin estrangular ni marcar la piel.",
          placement: "top",
        },
        {
          id: "cup",
          x: "40%",
          y: "48%",
          title: "Corte Anatómico Diario",
          desc: "Soporte ergonómico con costuras redondeadas para libertad de movimiento.",
          placement: "bottom",
        },
        {
          id: "hem",
          x: "68%",
          y: "78%",
          title: "Terminación Antirroce",
          desc: "Basta al ras de cuatro hilos que no se enrolla ni irrita el muslo.",
          placement: "bottom",
        },
      ],
    },
    {
      id: "medias-tobilleras",
      name: "Medias Tobilleras",
      category: "Calcetería Unisex",
      image:
        mediaImg,
      alt: "Medias Tobilleras ERXIDI",
      hotspots: [
        {
          id: "cuff",
          x: "50%",
          y: "22%",
          title: "Puño Rib Antideslizante",
          desc: "Banda elástica suave que se mantiene en su sitio sin apretar el tobillo.",
          placement: "top",
        },
        {
          id: "heel",
          x: "72%",
          y: "50%",
          title: "Talón Reforzado con Grip",
          desc: "Silicona interior o refuerzo anatómico para evitar que la media se baje.",
          placement: "bottom",
        },
        {
          id: "toe",
          x: "28%",
          y: "75%",
          title: "Puntera Plana Confort",
          desc: "Unión sin costura prominente para no incomodar los dedos al usar calzado.",
          placement: "bottom",
        },
      ],
    },
    {
      id: "trusa-modal",
      name: "Trusa Clásico Invisible",
      category: "Línea Femenina",
      image:
        trusaImg,
      alt: "Trusa Invisible ERXIDI",
      hotspots: [
        {
          id: "panty-waist",
          x: "50%",
          y: "38%",
          title: "Tiro Medio Cómodo",
          desc: "Pretina plana que no saca marcas bajo pantalones o vestidos ajustados.",
          placement: "top",
        },
        {
          id: "panty-fabric",
          x: "38%",
          y: "48%",
          title: "Tejido Respirable Suave",
          desc: "Tacto sedoso de secado rápido que mantiene la frescura durante todo el día.",
          placement: "bottom",
        },
        {
          id: "panty-crotch",
          x: "64%",
          y: "52%",
          title: "Basta Invisible Antirroce",
          desc: "Corte y remalle al ras para cero irritaciones en la entrepierna.",
          placement: "bottom",
        },
      ],
    },
    {
      id: "top-confort",
      name: "Top Bralette Confort Diario",
      category: "Línea Femenina",
      image:
        topImg,
      alt: "Top Bralette Confort ERXIDI",
      hotspots: [
        {
          id: "top-straps",
          x: "30%",
          y: "28%",
          title: "Tirantes Planos Suaves",
          desc: "Distribución uniforme del peso en hombros sin cavar en la piel.",
          placement: "bottom",
        },
        {
          id: "top-cup",
          x: "65%",
          y: "54%",
          title: "Estructura Sin Aros",
          desc: "Comodidad 100% libre de varillas metálicas que causen molestia.",
          placement: "top",
        },
        {
          id: "top-band",
          x: "50%",
          y: "70%",
          title: "Banda Elástica de Soporte",
          desc: "Soporte inferior adaptable que se ajusta a la silueta con suavidad.",
          placement: "bottom",
        },
      ],
    },
  ];

  const currentItem = carouselItems[currentSlide];

  const handlePrevSlide = () => {
    setActiveHotspot(null);
    setCurrentSlide((prev) => (prev === 0 ? carouselItems.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setActiveHotspot(null);
    setCurrentSlide((prev) => (prev === carouselItems.length - 1 ? 0 : prev + 1));
  };

  // Pilares comerciales de ERXIDI
  const retailBenefits = [
    {
      icon: PackageCheck,
      title: "Stock Físico Inmediato",
      subtitle: "Almacén clasificado",
      desc: "Prendas revisadas y listas para despacho local rápido, sin esperas de importación.",
    },
    {
      icon: Coins,
      title: "Precio Minorista Justo",
      subtitle: "Venta individual y packs",
      desc: "Ahorra comprando por unidad, tríos o docenas con precios directos y accesibles.",
    },
    {
      icon: ShieldCheck,
      title: "Prenda 100% Sellada",
      subtitle: "Garantía de higiene",
      desc: "Empaque individual protegido para garantizar que nadie se la haya probado antes.",
    },
    {
      icon: Truck,
      title: "Reparto Local en tu Zona",
      subtitle: "Tarifa justa por distancia",
      desc: "Coordinación directa de entrega con mensajero local a tu domicilio o trabajo.",
    },
  ];

  return (
    <div className="space-y-14 lg:space-y-20 pb-20">
      {/* 1. Hero Principal con Carrusel de Prenda Flotante */}
      <section className="relative overflow-hidden bg-brand-primary text-white border-b border-border/20">
        <div
          className="absolute -top-32 right-1/4 w-[500px] h-[350px] bg-accent/15 blur-[120px] pointer-events-none rounded-full"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-18 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Mensaje Principal */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                El verdadero confort comienza{" "}
                <span className="text-accent underline decoration-accent/40 decoration-wavy">
                  en tu primera capa
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                Prendas íntimas y calcetería de uso diario con calce ergonómico.
                Comodidad duradera y elasticidad equilibrada para acompañar tu jornada sin molestias.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate("/catalogo")}
                  className="bg-accent hover:bg-accent-hover text-white shadow-subtle text-xs sm:text-sm font-bold px-7"
                >
                  Explorar Catálogo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsSizeMatcherOpen(true)}
                  className="bg-transparent border-white/30 text-white hover:bg-white/10 text-xs sm:text-sm font-semibold px-6"
                >
                  <Ruler className="w-4 h-4 mr-2 text-accent" />
                  Calcular mi Talla
                </Button>
              </div>

              {suggestedSize && (
                <div className="pt-1">
                  <Badge variant="success" className="text-xs py-1.5 px-3.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Talla recomendada: <span className="font-mono font-bold ml-1">{suggestedSize}</span>
                  </Badge>
                </div>
              )}

              {/* Ventajas Rápidas de Compra */}
              <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-3">
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Variedad
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5 block">
                    Hombre, Mujer y Niños
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Pagos Fáciles
                  </span>
                  <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                    Yape · Plin · Efectivo
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Higiene
                  </span>
                  <span className="text-xs font-bold text-accent mt-0.5 block">
                    100% Sin Pruebas Previas
                  </span>
                </div>
              </div>
            </div>

            {/* Showcase Flotante en Carrusel (Mantiene la estética limpia sin tarjetas) */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-lg flex flex-col items-center">
                {/* Resplandor radial de fondo */}
                <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full pointer-events-none" />

                {/* Contenedor relativo con flechas externas y margen */}
                <div className="relative w-full flex items-center justify-center">
                  {/* Flecha Anterior (con margen externo para no tapar la prenda) */}
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="absolute -left-2 sm:-left-6 md:-left-8 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-slate-900/80 hover:bg-brand-primary border border-white/20 text-white/80 hover:text-white transition-all backdrop-blur-md shadow-xl hover:scale-105"
                    aria-label="Prenda anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Prenda Flotante con padding interno protector */}
                  <div className="relative aspect-[4/5] w-full max-w-sm sm:max-w-md px-6 sm:px-8 flex items-center justify-center select-none">
                    <img
                      key={currentItem.id}
                      src={currentItem.image}
                      alt={currentItem.alt}
                      className="w-full h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] animate-in fade-in duration-300"
                      loading="eager"
                    />

                    {/* Hotspots interactivos de la prenda activa con superposición z-[60]/z-[70] y dirección calibrada */}
                    {currentItem.hotspots.map((spot) => {
                      const isActive = activeHotspot === spot.id;
                      const xVal = parseFloat(spot.x) || 50;
                      const isRightSide = xVal > 65;
                      const isLeftSide = xVal < 35;
                      const isTopPlacement = spot.placement === "top";

                      return (
                        <div
                          key={spot.id}
                          style={{ top: spot.y, left: spot.x }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 ${isActive ? "z-[60]" : "z-10"
                            }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveHotspot(isActive ? null : spot.id)}
                            onMouseEnter={() => setActiveHotspot(spot.id)}
                            className="group relative flex items-center justify-center focus:outline-none"
                            aria-label={spot.title}
                          >
                            <span className="absolute h-6 w-6 rounded-full bg-accent/40 animate-ping" />
                            <span className="relative flex h-5 w-5 rounded-full border-2 border-white bg-accent text-white items-center justify-center shadow-lg transition-transform duration-150 group-hover:scale-110">
                              <Plus
                                className={`w-3 h-3 transition-transform duration-150 ${isActive ? "rotate-45" : ""
                                  }`}
                              />
                            </span>
                          </button>

                          {/* Micro-etiqueta flotante con apertura superior/inferior por hotspot */}
                          {isActive && (
                            <div
                              className={`absolute w-52 bg-slate-950 border border-white/30 text-white rounded-lg p-3 shadow-2xl z-[70] pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${isTopPlacement ? "bottom-8" : "top-8"
                                } ${isRightSide
                                  ? "right-0 translate-x-0"
                                  : isLeftSide
                                    ? "left-0 translate-x-0"
                                    : "left-1/2 -translate-x-1/2"
                                }`}
                            >
                              <strong className="block text-xs font-bold text-accent leading-tight">
                                {spot.title}
                              </strong>
                              <span className="block text-[11px] text-slate-300 mt-1 leading-snug">
                                {spot.desc}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Flecha Siguiente (con margen externo para no tapar la prenda) */}
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="absolute -right-2 sm:-right-6 md:-right-8 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-slate-900/80 hover:bg-brand-primary border border-white/20 text-white/80 hover:text-white transition-all backdrop-blur-md shadow-xl hover:scale-105"
                    aria-label="Siguiente prenda"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Indicadores de puntos (Dots) */}
                <div className="flex items-center gap-1.5 mt-3">
                  {carouselItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveHotspot(null);
                        setCurrentSlide(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-200 ${idx === currentSlide
                        ? "w-6 bg-accent"
                        : "w-1.5 bg-white/30 hover:bg-white/60"
                        }`}
                      aria-label={`Ir a ${item.name}`}
                    />
                  ))}
                </div>

                {/* Indicador inferior sutil */}
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400">
                  <span>{currentItem.name} · Toca los puntos (+) para inspeccionar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Beneficios de Compra Minorista Directa */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {retailBenefits.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-card border border-border bg-surface-card hover:border-brand-primary/30 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-button bg-surface-subtle border border-border flex items-center justify-center text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-brand-primary">
                      {item.title}
                    </h3>
                    <span className="text-[10px] font-mono text-accent block mt-0.5">
                      {item.subtitle}
                    </span>
                    <p className="text-[11px] text-brand-secondary mt-1.5 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Catálogo Destacado con Filtro por Público */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider block mb-1">
              Existencias Físicas en Almacén
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-primary">
              Prendas Destacadas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={genderFilter === "all" ? "primary" : "outline"}
              size="sm"
              onClick={() => setGenderFilter("all")}
              className="text-xs font-semibold"
            >
              Todos
            </Button>
            <Button
              variant={genderFilter === "hombre" ? "primary" : "outline"}
              size="sm"
              onClick={() => setGenderFilter("hombre")}
              className="text-xs font-semibold"
            >
              Hombre
            </Button>
            <Button
              variant={genderFilter === "mujer" ? "primary" : "outline"}
              size="sm"
              onClick={() => setGenderFilter("mujer")}
              className="text-xs font-semibold"
            >
              Mujer
            </Button>
            <Button
              variant={genderFilter === "nino" ? "primary" : "outline"}
              size="sm"
              onClick={() => setGenderFilter("nino")}
              className="text-xs font-semibold"
            >
              Niños
            </Button>
          </div>
        </div>

        {featuredProducts.length > 0 ? (
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
        ) : (
          <div className="text-center py-12 border border-dashed border-border rounded-card bg-surface-subtle">
            <p className="text-xs text-brand-secondary">
              No hay productos destacados para este público actualmente.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenderFilter("all")}
              className="mt-3 text-xs"
            >
              Ver todas las prendas
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <p className="text-xs text-brand-secondary">
            Stock real controlado por variante de color y talla.
          </p>
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate("/catalogo")}
            className="text-xs font-semibold w-full sm:w-auto"
          >
            Ver catálogo completo por categorías
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </section>

      {/* 4. Banner de Política Sanitaria y SizeMatcher */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-brand-primary rounded-card text-white p-6 sm:p-10 border border-border/20 shadow-subtle">
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge bg-white/10 text-[11px] font-mono text-slate-300">
              <ShieldAlert className="w-3.5 h-3.5 text-accent" />
              <span>POLÍTICA SANITARIA DE PRENDAS ÍNTIMAS</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Asegura tu talla antes de pedir. Cero errores, cero dudas.
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Por normas sanitarias y de salud pública, la ropa interior no admite cambios
              ni devoluciones tras ser entregada. Para tu tranquilidad, utiliza nuestro calculador
              antropométrico con tus medidas de cintura o cadera y acierta tu talla al primer intento.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsSizeMatcherOpen(true)}
                className="bg-accent hover:bg-accent-hover text-white text-xs font-bold px-6"
              >
                <Ruler className="w-4 h-4 mr-2" />
                Abrir Calculador de Talla
              </Button>
              <span className="text-[11px] font-mono text-slate-400">
                Fácil, rápido y sin registro
              </span>
            </div>
          </div>

          <div
            className="hidden md:block absolute -right-6 -bottom-8 opacity-10 text-white pointer-events-none"
            aria-hidden="true"
          >
            <Ruler className="w-64 h-64 stroke-1" />
          </div>
        </div>
      </section>

      {/* Modal SizeMatcher */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
        onSizeSelected={(sizeName) => setSuggestedSize(sizeName)}
      />
    </div>
  );
}
