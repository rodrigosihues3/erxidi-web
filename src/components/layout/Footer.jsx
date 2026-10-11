import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Ruler,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Lock,
  Truck,
  CheckCircle2,
} from "lucide-react";
import SizeMatcherModal from "../../features/catalog/components/SizeMatcherModal";

export default function Footer({ onOpenSizeMatcher }) {
  const [internalSizeMatcherOpen, setInternalSizeMatcherOpen] = useState(false);

  const handleOpenSizeMatcher = (e) => {
    e.preventDefault();
    if (onOpenSizeMatcher) {
      onOpenSizeMatcher();
    } else {
      setInternalSizeMatcherOpen(true);
    }
  };

  return (
    <footer className="bg-brand-primary text-white border-t border-border/20 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Columna 1: Taller & Atención */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <span className="font-extrabold tracking-tight text-xl text-white">
                ERXIDI
              </span>
            </Link>
            <p className="text-xs text-brand-muted leading-relaxed">
              Taller de confección textil especializado en ropa interior
              masculina. Algodón pima peinado, costuras planas y corte anatómico
              para máximo confort diario.
            </p>
            <div className="space-y-2 pt-1 text-xs text-brand-muted">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>
                  Taller Central: Av. Carlos Izaguirre, Los Olivos, Lima
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>Atención y pedidos: +51 987 654 321</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>pedidos@erxidi.pe</span>
              </div>
            </div>
          </div>

          {/* Columna 2: Navegación de Compra */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Servicios al Cliente
            </h4>
            <ul className="space-y-2.5 text-xs text-brand-muted">
              <li>
                <Link
                  to="/catalogo"
                  className="hover:text-white transition-colors block"
                >
                  Catálogo de Prendas
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleOpenSizeMatcher}
                  className="hover:text-accent transition-colors flex items-center gap-1.5 text-left focus:outline-none"
                >
                  <Ruler className="w-3.5 h-3.5 text-accent" />
                  Calcular mi Talla Ergonómica
                </button>
              </li>
              <li>
                <Link
                  to="/mi-cuenta/pedidos"
                  className="hover:text-white transition-colors block"
                >
                  Mis Pedidos y Seguimiento
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="hover:text-white transition-colors block"
                >
                  Acceso a Mi Cuenta
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Cobertura Logística y Bioseguridad */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Envíos y Bioseguridad
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-medium">
                    Despacho en Lima:
                  </strong>
                  <span>
                    Envío Express (45 a 90 min) y Programado dentro de la zona
                    de cobertura.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-medium">
                    Recojo en Taller:
                  </strong>
                  <span>
                    Sin costo adicional previa coordinación comercial.
                  </span>
                </div>
              </li>
            </ul>

            <div className="p-3 rounded-card bg-white/5 border border-white/10 text-xs text-brand-muted space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Aviso de Protección Sanitaria</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Por estricta normativa de higiene y salubridad textil, las
                prendas de uso íntimo no están sujetas a cambios ni devoluciones
                una vez entregadas.
              </p>
            </div>
          </div>

          {/* Columna 4: Facturación y Métodos de Pago */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Pagos y Facturación
            </h4>
            <div className="space-y-3 text-xs text-brand-muted">
              <div>
                <span className="font-semibold text-white/90 block">
                  Emisión Electrónica:
                </span>
                <span>Boleta de Venta y Factura con RUC para empresas.</span>
                <span className="block font-mono text-[11px] text-brand-muted mt-0.5">
                  RUC: 20612345678 &bull; ERXIDI S.A.C.
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="font-semibold text-white/90 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-accent" />
                  Métodos Aceptados:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-purple-200 font-bold text-[10px]">
                    YAPE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-200 font-bold text-[10px]">
                    PLIN
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px]">
                    Tarjetas (Culqi)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px]">
                    Contra Entrega
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-card bg-white/5 border border-white/10 text-[11px] text-white hover:bg-white/10 transition-colors select-none">
                  <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Libro de Reclamaciones
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      Conforme al Código de Protección al Consumidor
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Inferior */}
        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-brand-muted">
          <div>
            &copy; {new Date().getFullYear()} ERXIDI. Taller y Comercializadora
            Textil. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>
              Pagos seguros procesados mediante pasarela cifrada Culqi
            </span>
          </div>
        </div>
      </div>

      <SizeMatcherModal
        isOpen={internalSizeMatcherOpen}
        onClose={() => setInternalSizeMatcherOpen(false)}
        onSizeSelected={() => setInternalSizeMatcherOpen(false)}
      />
    </footer>
  );
}
