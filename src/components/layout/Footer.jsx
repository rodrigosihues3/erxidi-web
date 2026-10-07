import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Ruler,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Lock,
} from 'lucide-react';
import SizeMatcherModal from '../../features/catalog/components/SizeMatcherModal';

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
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Column 1: Marca & Propuesta de Valor */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <span className="font-extrabold tracking-tight text-xl text-white">
                ERXIDI
              </span>
            </Link>
            <p className="text-xs text-brand-muted leading-relaxed">
              Prendas íntimas masculinas elaboradas con algodón pima peinado y
              corte anatómico. Máximo confort diario sin opresión ni rozaduras.
            </p>
            <div className="space-y-2 pt-2 text-xs text-brand-muted">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>Atención: +51 987 654 321</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>contacto@erxidi.pe</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>Lima Metropolitana, Perú</span>
              </div>
            </div>
          </div>

          {/* Column 2: Navegación Rápida */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Navegación
            </h4>
            <ul className="space-y-2.5 text-xs text-brand-muted">
              <li>
                <Link
                  to="/"
                  className="hover:text-white transition-colors block"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  to="/catalogo"
                  className="hover:text-white transition-colors block"
                >
                  Catálogo Completo
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleOpenSizeMatcher}
                  className="hover:text-accent transition-colors flex items-center gap-1.5 text-left focus:outline-none"
                >
                  <Ruler className="w-3.5 h-3.5 text-accent" />
                  Calculador de Tallas
                </button>
              </li>
              <li>
                <Link
                  to="/login"
                  className="hover:text-white transition-colors block"
                >
                  Acceso a Clientes / Mi Cuenta
                </Link>
              </li>
              <li>
                <Link
                  to="/ui"
                  className="hover:text-white transition-colors block"
                >
                  Sistema de Diseño (/ui)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Políticas y Cobertura */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Políticas y Cobertura
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li>
                <span className="block font-semibold text-white/80">
                  Zonas de Cobertura:
                </span>
                <span>Envíos express y regulares en toda Lima Metropolitana.</span>
              </li>
              <li>
                <span className="block font-semibold text-white/80">
                  Términos de Envío:
                </span>
                <span>Entregas de 24 a 48 horas en distritos centrales.</span>
              </li>
            </ul>

            {/* Strict Hygiene Warning Box */}
            <div className="p-3 rounded-card bg-white/5 border border-white/10 text-xs text-brand-muted space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Aviso Sanitario Estricto</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Por motivos de higiene y protección sanitaria, la ropa interior
                no admite cambios ni devoluciones.
              </p>
            </div>
          </div>

          {/* Column 4: Cumplimiento y Pagos */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/90">
              Cumplimiento y Pagos
            </h4>
            <div className="space-y-3 text-xs text-brand-muted">
              <div>
                <span className="font-semibold text-white/80 block">
                  Razón Social:
                </span>
                <span>ERXIDI TEXTIL S.A.C.</span>
                <span className="block font-mono text-[11px] text-brand-muted mt-0.5">
                  RUC: 20612345678
                </span>
              </div>

              {/* Métodos de Pago */}
              <div className="space-y-1.5 pt-1">
                <span className="font-semibold text-white/80 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-accent" />
                  Transferencias Inmediatas:
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-purple-200 font-bold text-[10px]">
                    YAPE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-200 font-bold text-[10px]">
                    PLIN
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">
                    BCP / BBVA
                  </span>
                </div>
              </div>

              {/* Libro de Reclamaciones */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-card bg-white/5 border border-white/10 text-[11px] text-white hover:bg-white/10 transition-colors cursor-pointer select-none">
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

        {/* Bottom Sub-bar */}
        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-brand-muted">
          <div>
            &copy; {new Date().getFullYear()} ERXIDI. Todos los derechos
            reservados.
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Arquitectura segura y transacciones cifradas end-to-end</span>
          </div>
        </div>
      </div>

      {/* Internal Size Matcher modal fallback if opened from footer */}
      <SizeMatcherModal
        isOpen={internalSizeMatcherOpen}
        onClose={() => setInternalSizeMatcherOpen(false)}
        onSizeSelected={() => setInternalSizeMatcherOpen(false)}
      />
    </footer>
  );
}
