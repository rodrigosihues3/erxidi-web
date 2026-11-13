import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Clock,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

const INITIAL_FORM = {
  fullName: "",
  docType: "DNI",
  docNumber: "",
  address: "",
  phone: "",
  email: "",
  isMinor: false,
  guardianName: "",
  guardianDoc: "",
  itemType: "Producto",
  orderNumber: "",
  claimedAmount: "",
  itemDescription: "",
  claimType: "Reclamo",
  detail: "",
  request: "",
  acceptedTerms: false,
};

export default function ComplaintsBookView() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submittedRecord, setSubmittedRecord] = useState(null);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (form.fullName.trim().length < 3) {
      nextErrors.fullName = "Ingresa tus nombres y apellidos completos.";
    }

    const cleanDoc = form.docNumber.trim();
    if (form.docType === "DNI") {
      if (!/^\d{8}$/.test(cleanDoc)) {
        nextErrors.docNumber = "El DNI debe tener exactamente 8 dígitos.";
      }
    } else if (cleanDoc.length < 6) {
      nextErrors.docNumber = "Ingresa un número de documento válido.";
    }

    if (form.address.trim().length < 5) {
      nextErrors.address = "Ingresa tu domicilio completo.";
    }

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 9) {
      nextErrors.phone = "Ingresa un número celular de 9 dígitos.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Ingresa un correo electrónico válido.";
    }

    if (form.isMinor) {
      if (form.guardianName.trim().length < 3) {
        nextErrors.guardianName =
          "Ingresa el nombre completo del padre, madre o apoderado.";
      }
      if (form.guardianDoc.trim().length < 6) {
        nextErrors.guardianDoc =
          "Ingresa el documento del padre, madre o apoderado.";
      }
    }

    if (
      form.claimedAmount !== "" &&
      (Number.isNaN(Number(form.claimedAmount)) || Number(form.claimedAmount) < 0)
    ) {
      nextErrors.claimedAmount = "Ingresa un monto válido en soles.";
    }

    if (form.itemDescription.trim().length < 5) {
      nextErrors.itemDescription =
        "Describe brevemente el producto o servicio contratado.";
    }

    if (form.detail.trim().length < 10) {
      nextErrors.detail =
        "Describe el detalle del hecho (mínimo 10 caracteres).";
    }

    if (form.request.trim().length < 5) {
      nextErrors.request = "Indica tu pedido concreto ante esta reclamación.";
    }

    if (!form.acceptedTerms) {
      nextErrors.acceptedTerms =
        "Debes aceptar la declaración jurada y la Política de Privacidad.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date();
    const code = `LR-2026-${Date.now().toString().slice(-6)}`;

    setSubmittedRecord({
      code,
      registeredAt: now.toLocaleString("es-PE", {
        dateStyle: "long",
        timeStyle: "medium",
      }),
      ...form,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="bg-surface-subtle min-h-[75vh]">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-secondary hover:text-brand-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la tienda
          </Link>
        </div>

        {/* Encabezado Legal Obligatorio */}
        <header className="bg-surface-card border border-border rounded-card p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-brand-primary">
                Libro de Reclamaciones Virtual
              </h1>
              <p className="text-xs text-brand-secondary font-medium">
                Libro de Reclamaciones Virtual —{" "}
                <strong>YANQUI GUTIERREZ SONIA</strong> ·{" "}
                <span className="font-mono">RUC: 10408393367</span> · Dirección:
                Av. Carlos Izaguirre, Los Olivos, Lima
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-card bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Conforme a lo establecido en el Código de Protección y Defensa del
              Consumidor (<strong>Ley N° 29571</strong> y{" "}
              <strong>Ley N° 31435</strong>), el proveedor deberá dar respuesta
              al reclamo o queja en un plazo no mayor a{" "}
              <strong>quince (15) días hábiles improrrogables</strong>.
            </p>
          </div>
        </header>

        {submittedRecord ? (
          <section className="bg-surface-card border border-border rounded-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Hoja de Reclamación Registrada
                  </p>
                  <h2 className="font-mono text-xl font-extrabold text-brand-primary">
                    {submittedRecord.code}
                  </h2>
                </div>
              </div>
              <div className="text-xs text-brand-secondary sm:text-right">
                <span className="block font-semibold text-brand-primary">
                  Fecha y hora de registro
                </span>
                <span className="font-mono">
                  {submittedRecord.registeredAt}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-md bg-surface-subtle border border-border space-y-1">
                <p className="font-bold text-brand-primary uppercase tracking-wider text-[11px]">
                  Consumidor
                </p>
                <p className="text-brand-primary font-semibold">
                  {submittedRecord.fullName}
                </p>
                <p className="text-brand-secondary font-mono">
                  {submittedRecord.docType}: {submittedRecord.docNumber}
                </p>
                <p className="text-brand-secondary">
                  {submittedRecord.email} · {submittedRecord.phone}
                </p>
                <p className="text-brand-secondary">
                  {submittedRecord.address}
                </p>
              </div>

              <div className="p-3.5 rounded-md bg-surface-subtle border border-border space-y-1">
                <p className="font-bold text-brand-primary uppercase tracking-wider text-[11px]">
                  Bien Contratado y Tipo
                </p>
                <p className="text-brand-primary font-semibold">
                  {submittedRecord.claimType} — {submittedRecord.itemType}
                </p>
                {submittedRecord.orderNumber && (
                  <p className="text-brand-secondary font-mono">
                    Pedido: {submittedRecord.orderNumber}
                  </p>
                )}
                {submittedRecord.claimedAmount !== "" && (
                  <p className="text-brand-secondary font-mono">
                    Monto reclamado: S/{" "}
                    {Number(submittedRecord.claimedAmount).toFixed(2)}
                  </p>
                )}
                <p className="text-brand-secondary">
                  {submittedRecord.itemDescription}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-md bg-surface-subtle border border-border space-y-1">
                <p className="font-bold text-brand-primary">
                  Detalle del Reclamo / Queja
                </p>
                <p className="text-brand-secondary whitespace-pre-line">
                  {submittedRecord.detail}
                </p>
              </div>
              <div className="p-3.5 rounded-md bg-surface-subtle border border-border space-y-1">
                <p className="font-bold text-brand-primary">
                  Pedido del Consumidor
                </p>
                <p className="text-brand-secondary whitespace-pre-line">
                  {submittedRecord.request}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-brand-muted leading-relaxed">
              La formulación del reclamo no impide acudir a otras vías de
              solución de controversias ni es requisito previo para interponer
              una denuncia ante el INDECOPI. El proveedor dará respuesta en un
              plazo máximo de 15 días hábiles al correo electrónico registrado.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 print:hidden">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir / Guardar Constancia
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setSubmittedRecord(null);
                  setForm(INITIAL_FORM);
                  setErrors({});
                }}
              >
                Registrar otra hoja
              </Button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-surface-card border border-border rounded-card p-6 sm:p-8 space-y-8"
          >
            {/* 1. Identificación del Consumidor */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-primary border-b border-border pb-2">
                1. Identificación del Consumidor Reclamante
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Nombres y Apellidos completos *"
                    placeholder="Ej. María Pérez Quispe"
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    error={errors.fullName}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-primary mb-1.5">
                    Tipo de documento *
                  </label>
                  <select
                    value={form.docType}
                    onChange={(e) => updateField("docType", e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="DNI">DNI</option>
                    <option value="CE">Carnet de Extranjería (CE)</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>

                <Input
                  label="Número de documento *"
                  placeholder={form.docType === "DNI" ? "8 dígitos" : "Documento"}
                  value={form.docNumber}
                  onChange={(e) => updateField("docNumber", e.target.value)}
                  error={errors.docNumber}
                />

                <div className="sm:col-span-2">
                  <Input
                    label="Domicilio *"
                    placeholder="Av. / Jr. / Calle, número, distrito"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    error={errors.address}
                  />
                </div>

                <Input
                  label="Teléfono celular *"
                  placeholder="987654321"
                  value={form.phone}
                  onChange={(e) =>
                    updateField(
                      "phone",
                      e.target.value.replace(/\D/g, "").slice(0, 9)
                    )
                  }
                  error={errors.phone}
                />

                <Input
                  label="Correo electrónico *"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  error={errors.email}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-brand-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isMinor}
                  onChange={(e) => updateField("isMinor", e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span>Soy menor de edad</span>
              </label>

              {form.isMinor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-md bg-surface-subtle border border-border">
                  <Input
                    label="Nombre del padre, madre o apoderado *"
                    value={form.guardianName}
                    onChange={(e) =>
                      updateField("guardianName", e.target.value)
                    }
                    error={errors.guardianName}
                  />
                  <Input
                    label="DNI / CE del padre, madre o apoderado *"
                    value={form.guardianDoc}
                    onChange={(e) => updateField("guardianDoc", e.target.value)}
                    error={errors.guardianDoc}
                  />
                </div>
              )}
            </section>

            {/* 2. Identificación del Bien Contratado */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-primary border-b border-border pb-2">
                2. Identificación del Bien Contratado
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-primary mb-1.5">
                    Tipo de bien *
                  </label>
                  <div className="flex gap-3 pt-1">
                    {["Producto", "Servicio"].map((type) => (
                      <label
                        key={type}
                        className="inline-flex items-center gap-1.5 text-xs text-brand-primary cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="itemType"
                          checked={form.itemType === type}
                          onChange={() => updateField("itemType", type)}
                          className="text-accent focus:ring-accent"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Input
                  label="Número de Pedido (Opcional)"
                  placeholder="Ej. ERX-000123"
                  value={form.orderNumber}
                  onChange={(e) => updateField("orderNumber", e.target.value)}
                />

                <Input
                  label="Monto reclamado (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.claimedAmount}
                  onChange={(e) => updateField("claimedAmount", e.target.value)}
                  error={errors.claimedAmount}
                />
              </div>

              <Input
                label="Descripción del producto o servicio *"
                placeholder="Ej. Pack de bóxers algodón talla M / Servicio de envío"
                value={form.itemDescription}
                onChange={(e) => updateField("itemDescription", e.target.value)}
                error={errors.itemDescription}
              />
            </section>

            {/* 3. Detalle de la Reclamación */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-primary border-b border-border pb-2">
                3. Detalle de la Reclamación y Pedido del Consumidor
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-md border cursor-pointer transition-colors ${
                    form.claimType === "Reclamo"
                      ? "border-accent bg-amber-50/40"
                      : "border-border bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="claimType"
                      checked={form.claimType === "Reclamo"}
                      onChange={() => updateField("claimType", "Reclamo")}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-bold text-brand-primary">
                      Reclamo
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-secondary mt-1 pl-5">
                    Disconformidad relacionada a los productos o servicios.
                  </p>
                </label>

                <label
                  className={`p-3.5 rounded-md border cursor-pointer transition-colors ${
                    form.claimType === "Queja"
                      ? "border-accent bg-amber-50/40"
                      : "border-border bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="claimType"
                      checked={form.claimType === "Queja"}
                      onChange={() => updateField("claimType", "Queja")}
                      className="text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-bold text-brand-primary">
                      Queja
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-secondary mt-1 pl-5">
                    Malestar o descontento respecto a la atención al público.
                  </p>
                </label>
              </div>

              <div>
                <label
                  htmlFor="complaint-detail"
                  className="block text-xs font-semibold text-brand-primary mb-1.5"
                >
                  Detalle del hecho *
                </label>
                <textarea
                  id="complaint-detail"
                  rows={4}
                  placeholder="Describe lo sucedido con fechas y detalles relevantes..."
                  value={form.detail}
                  onChange={(e) => updateField("detail", e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-surface-card border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${
                    errors.detail ? "border-rose-500" : "border-border"
                  }`}
                />
                {errors.detail && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.detail}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="complaint-request"
                  className="block text-xs font-semibold text-brand-primary mb-1.5"
                >
                  Pedido concreto del consumidor *
                </label>
                <textarea
                  id="complaint-request"
                  rows={2}
                  placeholder="Indica qué solución solicitas (ej. cambio por falla de fábrica, reembolso, aclaración)..."
                  value={form.request}
                  onChange={(e) => updateField("request", e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-surface-card border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${
                    errors.request ? "border-rose-500" : "border-border"
                  }`}
                />
                {errors.request && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.request}
                  </p>
                )}
              </div>
            </section>

            {/* Conformidad */}
            <section className="space-y-3 pt-2 border-t border-border">
              <label className="flex items-start gap-2.5 text-xs text-brand-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acceptedTerms}
                  onChange={(e) =>
                    updateField("acceptedTerms", e.target.checked)
                  }
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                />
                <span>
                  Declaro bajo juramento que los datos consignados son verídicos
                  y acepto el tratamiento de mis datos conforme a la{" "}
                  <Link
                    to="/politica-privacidad"
                    className="text-accent font-semibold hover:underline"
                  >
                    Política de Privacidad
                  </Link>
                  .
                </span>
              </label>
              {errors.acceptedTerms && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.acceptedTerms}
                </p>
              )}

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md">
                  Enviar Hoja de Reclamación
                </Button>
              </div>
            </section>
          </form>
        )}
      </div>
    </div>
  );
}

