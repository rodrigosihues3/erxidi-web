import React from "react";
import { ShieldAlert } from "lucide-react";
import LegalPageShell from "./LegalPageShell";

export default function ReturnsPolicyView() {
  return (
    <LegalPageShell
      title="Política de Cambios y Devoluciones"
      lastUpdated="2026-01"
    >
      <div className="p-4 rounded-card bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm">
          <p className="font-bold">Excepción Sanitaria Obligatoria</p>
          <p className="leading-relaxed">
            Conforme al Código de Protección y Defensa del Consumidor y normas
            de salubridad textil,{" "}
            <strong>
              las prendas de uso íntimo (bóxers, calzoncillos, trusas, brasiers
              y tops íntimos) no admiten cambios ni devoluciones
            </strong>{" "}
            una vez abiertas o entregadas, por estrictas razones de higiene.
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          1. Garantía por Falla de Fábrica o Error de Despacho
        </h2>
        <p>
          Se aceptan cambios únicamente dentro de los{" "}
          <strong>7 días calendario</strong> posteriores a la recepción del
          pedido cuando la prenda presente defectos de costura, falla de
          fábrica o error en el despacho (talla o modelo distinto al
          solicitado).
        </p>
        <p>Para que proceda la garantía, el producto deberá conservar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Etiquetas originales intactas y adheridas a la prenda.</li>
          <li>Empaque original en buen estado.</li>
          <li>Ausencia total de señales de uso, lavado o manipulación.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          2. Procedimiento de Atención
        </h2>
        <p>
          Para solicitar una revisión por falla de fábrica o error de envío,
          comunícate con nuestro equipo a través de:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Correo oficial:{" "}
            <span className="font-mono font-semibold text-brand-primary">
              pedidos@erxidi.pe
            </span>
          </li>
          <li>
            Teléfono de atención:{" "}
            <span className="font-mono font-semibold text-brand-primary">
              +51 987 654 321
            </span>
          </li>
        </ul>
        <p>
          Indica tu número de orden (ejemplo:{" "}
          <span className="font-mono font-semibold text-brand-primary">
            ERX-000123
          </span>
          ) y adjunta evidencia fotográfica clara del empaque y del defecto o
          diferencia detectada. Nuestro equipo validará el caso y coordinará el
          cambio correspondiente sin costo adicional para el cliente.
        </p>
      </section>
    </LegalPageShell>
  );
}

