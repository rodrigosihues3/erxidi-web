import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function LegalPageShell({ title, lastUpdated, children }) {
  return (
    <div className="bg-surface-subtle min-h-[70vh]">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-secondary hover:text-brand-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la tienda
          </Link>
          {lastUpdated && (
            <span className="font-mono text-[11px] text-brand-muted">
              Actualizado: {lastUpdated}
            </span>
          )}
        </div>

        <header className="bg-surface-card border border-border rounded-card p-6 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-subtle border border-border text-[11px] font-medium text-brand-secondary">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>
              Titular: YANQUI GUTIERREZ SONIA ·{" "}
              <span className="font-mono">RUC: 10408393367</span> · Nombre
              Comercial: ERXIDI · Lima, Perú
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-primary">
            {title}
          </h1>
        </header>

        <article className="bg-surface-card border border-border rounded-card p-6 sm:p-8 space-y-6 text-sm text-brand-secondary leading-relaxed">
          {children}
        </article>
      </div>
    </div>
  );
}

