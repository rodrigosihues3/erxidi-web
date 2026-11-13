import React from "react";
import LegalPageShell from "./LegalPageShell";

export default function PrivacyPolicyView() {
  return (
    <LegalPageShell title="Política de Privacidad" lastUpdated="2026-01">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          1. Marco Legal y Responsable del Tratamiento
        </h2>
        <p>
          En cumplimiento de la <strong>Ley N° 29733</strong> (Ley de Protección
          de Datos Personales del Perú) y su Reglamento (D.S. N° 003-2013-JUS),{" "}
          <strong>YANQUI GUTIERREZ SONIA</strong> (
          <span className="font-mono">RUC: 10408393367</span>), titular del
          nombre comercial <strong>ERXIDI</strong>, garantiza la
          confidencialidad y protección de los datos personales proporcionados
          por sus clientes a través de esta plataforma.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          2. Finalidad del Tratamiento de Datos
        </h2>
        <p>
          Los datos recopilados durante el registro, checkout o atención al
          cliente (nombres, apellidos, DNI/RUC, teléfono celular, correo
          electrónico y dirección de entrega) se utilizan exclusivamente para:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Validación de identidad del comprador y prevención de fraude.</li>
          <li>Emisión de comprobantes electrónicos (Boleta o Factura).</li>
          <li>Gestión logística de despacho, entrega y recojo en taller.</li>
          <li>
            Envío de notificaciones transaccionales sobre el estado del pedido.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          3. Seguridad de Pagos (Estándar PCI-DSS)
        </h2>
        <p>
          ERXIDI{" "}
          <strong>
            no almacena ni tiene acceso a los números completos de tarjeta ni a
            los códigos de seguridad (CVV)
          </strong>
          . Toda la tokenización y el procesamiento de pagos con tarjeta se
          realizan directamente bajo estándares de seguridad{" "}
          <strong>PCI-DSS</strong> mediante la pasarela de pagos{" "}
          <strong>Culqi</strong>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-brand-primary">
          4. Ejercicio de Derechos ARCO
        </h2>
        <p>
          El titular de los datos personales puede ejercer en cualquier momento
          sus derechos de Acceso, Rectificación, Cancelación y Oposición
          (Derechos ARCO) enviando una solicitud al correo{" "}
          <span className="font-mono font-semibold text-brand-primary">
            pedidos@erxidi.pe
          </span>{" "}
          indicando su nombre completo, número de documento de identidad y el
          detalle de su requerimiento.
        </p>
      </section>
    </LegalPageShell>
  );
}

