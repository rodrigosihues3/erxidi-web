import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import Button from "../../../components/ui/Button";
import {
  createDeliveryStaff,
  updateDeliveryStaff,
} from "../services/adminDelivery.service";

export function parseStaffModality(paternalSurname) {
  if (!paternalSurname) return { surname: "", modality: "scheduled" };
  if (paternalSurname.includes("[Express]")) {
    return {
      surname: paternalSurname.replace("[Express]", "").trim(),
      modality: "express",
    };
  }
  if (paternalSurname.includes("[Programado]")) {
    return {
      surname: paternalSurname.replace("[Programado]", "").trim(),
      modality: "scheduled",
    };
  }
  return {
    surname: paternalSurname.trim(),
    modality: "scheduled",
  };
}

export function formatPaternalSurnameWithModality(cleanSurname, modality) {
  const clean = (cleanSurname || "")
    .replace(/\[(Express|Programado)\]/gi, "")
    .trim();
  const tag = modality === "express" ? "[Express]" : "[Programado]";
  return `${clean} ${tag}`.trim();
}

export function DeliveryStaffModal({ staffToEdit, onClose, onSaved }) {
  const isEditing = Boolean(staffToEdit?.id);

  const initialForm = useMemo(() => {
    if (staffToEdit) {
      const parsed = parseStaffModality(staffToEdit.paternal_surname);
      return {
        first_name: staffToEdit.first_name || "",
        paternal_surname: parsed.surname,
        maternal_surname: staffToEdit.maternal_surname || "",
        dni: staffToEdit.dni || "",
        phone: staffToEdit.phone || "",
        email: staffToEdit.email || "",
        password: "",
        modality: parsed.modality || "scheduled",
      };
    }
    return {
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      dni: "",
      phone: "",
      email: "",
      password: "",
      modality: "scheduled",
    };
  }, [staffToEdit]);

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialForm);
    setError("");
  }, [initialForm]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.first_name.trim()) {
      setError("Ingresa el nombre.");
      return;
    }

    if (!form.paternal_surname.trim()) {
      setError("Ingresa el apellido paterno.");
      return;
    }

    if (!form.email.trim()) {
      setError("Ingresa el correo electrónico.");
      return;
    }

    if (!form.modality) {
      setError("Selecciona una modalidad.");
      return;
    }

    if (!isEditing) {
      if (!form.password) {
        setError("Ingresa la contraseña.");
        return;
      }
      if (form.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
    }

    try {
      setLoading(true);

      const finalPaternalSurname = formatPaternalSurnameWithModality(
        form.paternal_surname,
        form.modality,
      );

      if (isEditing) {
        await updateDeliveryStaff(staffToEdit.id, {
          first_name: form.first_name.trim(),
          paternal_surname: finalPaternalSurname,
          maternal_surname: form.maternal_surname.trim() || null,
          phone: form.phone.trim() || null,
          dni: form.dni.trim() || null,
        });
      } else {
        await createDeliveryStaff({
          first_name: form.first_name.trim(),
          paternal_surname: finalPaternalSurname,
          maternal_surname: form.maternal_surname.trim() || null,
          dni: form.dni.trim() || null,
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
        });
      }

      onSaved();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          (isEditing
            ? "No se pudo actualizar el repartidor."
            : "No se pudo crear el repartidor."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-card shadow-xl border border-border">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-brand-primary">
              {isEditing ? "Editar repartidor" : "Nuevo repartidor"}
            </h2>

            <p className="text-xs text-brand-secondary mt-1">
              {isEditing
                ? "Actualiza los datos operativos y la modalidad del repartidor."
                : "Crea las credenciales de acceso para el personal de reparto."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-surface-subtle rounded-button text-brand-muted hover:text-brand-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Nombres"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
            />

            <Field
              label="Apellido paterno"
              name="paternal_surname"
              value={form.paternal_surname}
              onChange={handleChange}
              required
            />

            <Field
              label="Apellido materno"
              name="maternal_surname"
              value={form.maternal_surname}
              onChange={handleChange}
            />

            <Field
              label="DNI"
              name="dni"
              value={form.dni}
              onChange={handleChange}
              maxLength={8}
            />

            <Field
              label="Teléfono"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            {/* MODALIDAD DE REPARTO */}
            <div className="sm:col-span-2">
              <label className="block">
                <span className="block text-xs font-semibold text-brand-secondary mb-1.5">
                  Modalidad / Tipo de Reparto{" "}
                  <span className="text-red-500">*</span>
                </span>
                <select
                  name="modality"
                  value={form.modality}
                  onChange={handleChange}
                  required
                  className="w-full h-10 px-3 border border-border rounded-button text-sm bg-white outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="scheduled">Ruta Programada</option>
                  <option value="express">Express (Mismo día)</option>
                </select>
              </label>
            </div>

            <div className={isEditing ? "sm:col-span-2" : "col-span-1"}>
              <Field
                label="Correo electrónico"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isEditing}
                helperText={
                  isEditing
                    ? "El correo de autenticación no se puede modificar al editar perfil."
                    : undefined
                }
              />
            </div>

            {!isEditing && (
              <div className="col-span-1">
                <Field
                  label="Contraseña"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  helperText="Mínimo 6 caracteres."
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-button bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>

            <Button type="submit" disabled={loading} size="sm">
              {loading
                ? isEditing
                  ? "Guardando..."
                  : "Creando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear repartidor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeliveryStaffModal;

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  maxLength,
  minLength,
  helperText,
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-brand-secondary mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        minLength={minLength}
        className={`w-full h-10 px-3 border border-border rounded-button text-sm outline-none focus:ring-2 focus:ring-accent/20 ${
          disabled
            ? "bg-surface-subtle text-brand-muted cursor-not-allowed"
            : "bg-white text-brand-primary"
        }`}
      />

      {helperText && (
        <span className="block text-[11px] text-brand-muted mt-1">
          {helperText}
        </span>
      )}
    </label>
  );
}
