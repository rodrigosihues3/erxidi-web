import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Package,
  Ruler,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { mockProducts } from '../catalog/data/mockCatalog';
import ProductCard from '../catalog/components/ProductCard';
import SizeMatcherModal from '../catalog/components/SizeMatcherModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useCart } from '../../context/CartContext';

export default function HomeView() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [isSizeMatcherOpen, setIsSizeMatcherOpen] = useState(false);
  const [suggestedSize, setSuggestedSize] = useState(null);

  // Filter featured products
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
        (v) => (v.stock || 0) > 0 && v.is_active !== false
      ) || product.product_variants?.[0];

    if (availableVariant) {
      try {
        addItem(
          {
            variantId: availableVariant.id,
            productId: product.id,
            name: product.name,
            size: availableVariant.sizes?.name || 'M',
            color: availableVariant.color || '',
            colorHex: availableVariant.color_hex || '#111827',
            price: product.price,
            stock: availableVariant.stock,
            imageUrl: product.main_image_url,
          },
          1
        );
      } catch (err) {
        console.error('No se pudo añadir al carrito:', err.message);
      }
    }
  };

  const valueProps = [
    {
      icon: Sparkles,
      title: '100% Algodón Pima Peinado',
      description:
        'Tacto ultra suave y propiedades anti-alérgicas para máxima frescura durante todo el día.',
    },
    {
      icon: ShieldCheck,
      title: 'Corte Anatómico Anti-Rozaduras',
      description:
        'Soporte ergonómico de alta precisión sin elásticos opresivos que marquen la piel.',
    },
    {
      icon: Truck,
      title: 'Envíos Express Lima',
      description:
        'Entregas directas monitoreadas en Lima Metropolitana en 24 a 48 horas garantizadas.',
    },
    {
      icon: Package,
      title: 'Empaque Sellado de Fábrica',
      description:
        'Garantía estricta de higiene y salubridad. Tu prenda llega intacta directamente a tus manos.',
    },
  ];

  return (
    <div className="space-y-16 lg:space-y-24 pb-16">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-brand-primary text-white py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-border/20">
        {/* Subtle background glow effect */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent/15 blur-3xl pointer-events-none rounded-full"
          aria-hidden="true"
        />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-badge bg-white/10 border border-white/20 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Colección Premium &bull; Algodón Pima Peruano</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            El verdadero confort comienza{' '}
            <span className="text-accent underline decoration-accent/40 decoration-wavy">
              en tu primera capa
            </span>
            .
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Prendas íntimas masculinas confeccionadas con fibras finas de algodón
            pima peinado y patronaje ergonómico para un ajuste anatómico libre de
            marcas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/catalogo')}
              className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white shadow-md text-sm px-8"
            >
              Explorar Catálogo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsSizeMatcherOpen(true)}
              className="w-full sm:w-auto bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white text-sm px-6"
            >
              <Ruler className="w-4 h-4 mr-2 text-accent" />
              Calcular mi Talla
            </Button>
          </div>

          {suggestedSize && (
            <div className="pt-2 flex justify-center">
              <Badge variant="success" className="text-xs py-1 px-3">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Tu talla recomendada es: {suggestedSize}
              </Badge>
            </div>
          )}
        </div>
      </section>

      {/* 2. Value Props (Pilares de Marca) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-accent">
            Ingeniería &amp; Confort
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-primary">
            Diseñado para la anatomía masculina
          </h2>
          <p className="text-xs text-brand-secondary">
            Cada detalle textil responde a criterios de respirabilidad, durabilidad y soporte natural.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueProps.map((prop, idx) => {
            const Icon = prop.icon;
            return (
              <Card
                key={idx}
                className="p-6 border border-border bg-surface-card hover:border-brand-primary/40 hover:shadow-subtle transition-all duration-200 flex flex-col items-start"
              >
                <div className="w-10 h-10 rounded-button bg-surface-subtle border border-border flex items-center justify-center text-brand-primary mb-4">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-sm font-bold text-brand-primary mb-2">
                  {prop.title}
                </h3>
                <p className="text-xs text-brand-secondary leading-relaxed">
                  {prop.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 3. Prendas Destacadas (Featured Grid) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <Badge variant="neutral" className="text-[11px] mb-2">
              Edición Seleccionada
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-primary">
              Prendas Destacadas
            </h2>
            <p className="text-xs text-brand-secondary mt-1">
              Nuestros esenciales anatómicos más solicitados.
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
            onClick={() => navigate('/catalogo')}
            className="text-xs font-semibold"
          >
            Explorar todas las categorías y cortes
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </section>

      {/* 4. Banner Size Matcher */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-brand-primary rounded-card text-white p-8 sm:p-12 border border-border/20 shadow-dropdown">
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge bg-white/10 text-[11px] font-semibold text-slate-300">
              <Ruler className="w-3.5 h-3.5 text-accent" />
              <span>Algoritmo Antropométrico ERXIDI</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ¿Indeciso con la talla? Evita errores antes de comprar.
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Por razones sanitarias la ropa interior no tiene cambios. Ingresa tu
              estatura, peso y preferencia de calce; nuestro algoritmo
              determinará tu talla exacta en segundos.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsSizeMatcherOpen(true)}
                className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-6"
              >
                Probar Calculador de Talla
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <span className="text-[11px] text-slate-400">
                100% privado y sin registros
              </span>
            </div>
          </div>

          {/* Decorative outline badge icon */}
          <div
            className="hidden md:block absolute -right-6 -bottom-10 opacity-10 text-white pointer-events-none"
            aria-hidden="true"
          >
            <Ruler className="w-64 h-64 stroke-1" />
          </div>
        </div>
      </section>

      {/* Size Matcher Modal */}
      <SizeMatcherModal
        isOpen={isSizeMatcherOpen}
        onClose={() => setIsSizeMatcherOpen(false)}
        onSizeSelected={(sizeName) => setSuggestedSize(sizeName)}
      />
    </div>
  );
}
