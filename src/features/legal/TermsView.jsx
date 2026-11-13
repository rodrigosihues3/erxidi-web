import React from "react";
import { Link } from "react-router-dom";
import LegalPageShell from "./LegalPageShell";

export default function TermsView() {
  return (
    <LegalPageShell
      title="Términos y Condiciones de Uso y Compra"
      lastUpdated="2026-01"
    >
      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          1. Objeto y Ámbito de Aplicación
        </h2>
        <p>
          Los presentes Términos y Condiciones regulan el acceso, navegación y
          las operaciones de compra electrónica realizadas a través de la tienda
          virtual <strong>ERXIDI</strong>, operada por{" "}
          <strong>YANQUI GUTIERREZ SONIA</strong> con{" "}
          <span className="font-mono">RUC: 10408393367</span> y domicilio
          comercial en Av. Carlos Izaguirre, distrito de Los Olivos, Lima, Perú.
          Al confirmar un pedido, el usuario declara haber leído y aceptado
          íntegramente estas condiciones.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          2. Precios, Moneda e Impuestos
        </h2>
        <p>
          Todos los precios exhibidos en el catálogo están expresados en Soles
          Peruanos (<span className="font-mono">S/</span> - PEN) e incluyen los
          impuestos aplicables conforme a la legislación tributaria vigente. El
          costo de envío se calcula y muestra de forma transparente antes de
          finalizar la compra según la modalidad y zona de cobertura
          seleccionada.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          3. Medios de Pago Habilitados
        </h2>
        <p>Las compras en ERXIDI pueden abonarse mediante:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Tarjetas de crédito y débito</strong> (Visa, Mastercard,
            American Express y Diners Club) procesadas a través de la pasarela
            de pagos cifrada <strong>Culqi</strong> bajo estándares PCI-DSS.
          </li>
          <li>
            <strong>Billeteras digitales</strong> (<strong>Yape / Plin</strong>)
            con validación de código de operación.
          </li>
          <li>
            <strong>Pago Contra Entrega</strong>, disponible exclusivamente en
            zonas habilitadas de Lima Metropolitana para cuentas verificadas.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          4. Despacho y Modalidades de Entrega
        </h2>
        <p>Ofrecemos tres modalidades de entrega en Lima Metropolitana:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Envío Express:</strong> Entrega rápida en ventanas de 45 a
            90 minutos dentro de las zonas habilitadas.
          </li>
          <li>
            <strong>Envío Programado:</strong> Reparto en el bloque horario
            seleccionado durante el checkout.
          </li>
          <li>
            <strong>Recojo en Taller:</strong> Retiro sin costo adicional en
            nuestro punto de Av. Carlos Izaguirre, Los Olivos, Lima, previa
            confirmación de pedido listo.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          5. Propiedad Intelectual, Cambios y Jurisdicción
        </h2>
        <p>
          Las marcas, fotografías de prendas, textos y diseño del sitio son de
          uso exclusivo de ERXIDI. Las condiciones de garantía y excepción
          sanitaria se rigen por nuestra{" "}
          <Link
            to="/cambios-y-devoluciones"
            className="text-accent font-semibold hover:underline"
          >
            Política de Cambios y Devoluciones
          </Link>
          . Toda controversia se somete a la legislación de la República del
          Perú y a la competencia de los jueces y tribunales de Lima, sin
          perjuicio del derecho del consumidor de acudir al{" "}
          <Link
            to="/libro-reclamaciones"
            className="text-accent font-semibold hover:underline"
          >
            Libro de Reclamaciones Virtual
          </Link>{" "}
          o al INDECOPI.
        </p>
      </section>
    </LegalPageShell>
  );
}

