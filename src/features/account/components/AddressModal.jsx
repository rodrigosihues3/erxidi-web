import React, { useState, useEffect } from "react";
import { MapPin, X, AlertCircle } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import LocationPickerMap from "../../../components/ui/LocationPickerMap";
import { supabase } from "../../../services/supabase";

const INITIAL_FORM = {
  alias: "Casa",
  zone_id: "",
  street_address: "",
  reference: "",
  receiver_name: "",
  receiver_phone: "",
  is_default: false,
  latitude: null,
  longitude: null,
};

export default function AddressModal({
  isOpen,
  onClose,
  onSaved,
  addressToEdit = null,
  deliveryZones = [],
  user = null,
  profile = null,
  addressesCount = 0,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (addressToEdit) {
      setFormData({
        alias: addressToEdit.alias || "Casa",
        zone_id: String(addressToEdit.zone_id || ""),
        street_address: addressToEdit.street_address || "",
        reference: addressToEdit.reference || "",
        receiver_name: addressToEdit.receiver_name || "",
        receiver_phone: addressToEdit.receiver_phone || "",
        is_default: Boolean(addressToEdit.is_default),
        latitude:
          addressToEdit.latitude != null ? Number(addressToEdit.latitude) : null,
        longitude:
          addressToEdit.longitude != null ? Number(addressToEdit.longitude) : null,
      });
    } else {
      const defaultZone = deliveryZones[0]?.id ? String(deliveryZones[0].id) : "";
      const fullName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        : "";

      setFormData({
        alias: "Casa",
        zone_id: defaultZone,
        street_address: "",
        reference: "",
        receiver_name: fullName,
        receiver_phone: profile?.phone || "",
        is_default: addressesCount === 0,
        latitude: null,
        longitude: null,
      });
    }
    setFormError(null);
  }, [isOpen, addressToEdit, deliveryZones, profile, addressesCount]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.alias.trim()) {
      setFormError("Por favor ingresa un alias para la dirección (ej. Casa, Oficina).");
      return;
    }
    if (!formData.zone_id) {
      setFormError("Debes seleccionar un distrito de entrega.");
      return;
    }
    if (formData.street_address.trim().length < 4) {
      setFormError("Ingresa una dirección válida (calle, número o departamento).");
      return;
    }
    if (!formData.reference.trim()) {
      setFormError("La referencia de llegada es obligatoria para el repartidor.");
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      setFormError("Debes ubicar y fijar el pin de tu entrega en el mapa.");
      return;
    }
    if (!formData.receiver_name.trim()) {
      setFormError("Ingresa el nombre de la persona que recibe.");
      return;
    }
    if (!/^\d{9}$/.test(formData.receiver_phone.replace(/\D/g, ""))) {
      setFormError("El celular de quien recibe debe tener 9 dígitos.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const willBeDefault = formData.is_default || addressesCount === 0;

      if (willBeDefault) {
        await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      const payload = {
        user_id: user.id,
        alias: formData.alias.trim(),
        zone_id: Number(formData.zone_id),
        street_address: formData.street_address.trim(),
        reference: formData.reference.trim(),
        receiver_name: formData.receiver_name.trim(),
        receiver_phone: formData.receiver_phone.replace(/\D/g, "").slice(0, 9),
        is_default: willBeDefault,
        latitude: formData.latitude,
        longitude: formData.longitude,
        updated_at: new Date().toISOString(),
      };

      if (addressToEdit?.id) {
        const { error: updateError } = await supabase
          .from("addresses")
          .update(payload)
          .eq("id", addressToEdit.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("addresses")
          .insert([payload]);

        if (insertError) throw insertError;
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Error al guardar dirección:", err);
      setFormError(err.message || "Error al procesar la dirección en el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="bg-surface-card border border-border rounded-card w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-150 overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-brand-primary">
              {addressToEdit ? "Editar Dirección" : "Agregar Nueva Dirección"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded text-brand-muted hover:text-brand-primary hover:bg-surface-subtle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 border border-status-danger-border rounded text-xs text-status-danger-text flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Alias y Distrito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Alias de la Dirección"
                id="addr-alias"
                placeholder="Ej. Casa, Oficina, Taller"
                value={formData.alias}
                onChange={(e) =>
                  setFormData({ ...formData, alias: e.target.value })
                }
                required
              />
              <div className="flex gap-1.5 mt-1">
                {["Casa", "Oficina", "Depa"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFormData({ ...formData, alias: tag })}
                    className="text-[10px] px-2 py-0.5 rounded bg-surface-subtle border border-border text-brand-secondary hover:text-brand-primary"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="addr-zone"
                className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
              >
                Distrito de Lima
              </label>
              <select
                id="addr-zone"
                value={formData.zone_id}
                onChange={(e) =>
                  setFormData({ ...formData, zone_id: e.target.value })
                }
                className="w-full h-10 px-3 bg-surface-card border border-border rounded-button text-sm text-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                required
              >
                <option value="" disabled>
                  Selecciona un distrito
                </option>
                {deliveryZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.district_name} (Flete: S/{" "}
                    {Number(zone.delivery_cost).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calle / Número */}
          <Input
            label="Dirección Exacta"
            id="addr-street"
            placeholder="Calle / Av., Número, Interior o Departamento"
            value={formData.street_address}
            onChange={(e) =>
              setFormData({ ...formData, street_address: e.target.value })
            }
            helperText="Incluye número exterior, interior o piso."
            required
          />

          {/* Referencia obligatoria */}
          <div>
            <Input
              label="Referencia de Llegada (Obligatoria)"
              id="addr-reference"
              placeholder="Ej. Frente al parque, rejas blancas, timbre 2B"
              value={formData.reference}
              onChange={(e) =>
                setFormData({ ...formData, reference: e.target.value })
              }
              required
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              Indispensable para que el despachador ubique el inmueble con precisión.
            </p>
          </div>

          {/* Georreferenciación con Leaflet */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5">
              Ubicación en el Mapa (Pin de Entrega Obligatorio) <span className="text-red-500">*</span>
            </label>
            <LocationPickerMap
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={({ lat, lng }) =>
                setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
              }
              height="h-56"
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              Haz clic en el mapa o arrastra el marcador para fijar el punto de entrega.
            </p>
          </div>

          {/* Receptor: Nombre y Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <Input
              label="Persona que Recibe"
              id="addr-receiver-name"
              placeholder="Nombres y Apellidos"
              value={formData.receiver_name}
              onChange={(e) =>
                setFormData({ ...formData, receiver_name: e.target.value })
              }
              required
            />

            <Input
              label="Teléfono Celular"
              id="addr-receiver-phone"
              type="tel"
              placeholder="9XXXXXXXX"
              maxLength={9}
              value={formData.receiver_phone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  receiver_phone: e.target.value.replace(/\D/g, "").slice(0, 9),
                })
              }
              required
            />
          </div>

          {/* Checkbox: Dirección Principal */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-brand-primary select-none">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="w-4 h-4 text-accent border-border rounded focus:ring-accent"
              />
              <span>Establecer como dirección principal</span>
            </label>
            <p className="text-[11px] text-brand-muted ml-6.5 mt-0.5">
              Esta dirección se seleccionará automáticamente en tus próximos pedidos.
            </p>
          </div>

          {/* Botones del Modal */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
            >
              {addressToEdit ? "Guardar Cambios" : "Guardar Dirección"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
