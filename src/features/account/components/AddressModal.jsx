import React, { useState, useEffect } from "react";
import { MapPin, X, AlertCircle, Search } from "lucide-react";
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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");

  const handleMapLocationChange = async ({ lat, lng }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));

    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.address) {
        // 1. Resolver calle y número
        const road =
          data.address.road ||
          data.address.pedestrian ||
          data.address.footway ||
          data.address.street ||
          "";
        const houseNumber = data.address.house_number || "";
        const fullStreet = [road, houseNumber].filter(Boolean).join(" ");

        // 2. Resolver distrito en segundo plano contra deliveryZones
        const detectedDistrict =
          data.address.suburb ||
          data.address.city_district ||
          data.address.neighbourhood ||
          data.address.town ||
          data.address.city ||
          "";

        let matchedZoneId = null;
        if (detectedDistrict && deliveryZones?.length > 0) {
          const matched = deliveryZones.find(
            (z) =>
              z.district_name &&
              (detectedDistrict
                .toLowerCase()
                .includes(z.district_name.toLowerCase()) ||
                z.district_name
                  .toLowerCase()
                  .includes(detectedDistrict.toLowerCase()))
          );
          if (matched) matchedZoneId = matched.id;
        }

        // Si no coincide, asignar el primer ID de zona disponible o null
        if (!matchedZoneId && deliveryZones?.length > 0) {
          matchedZoneId = deliveryZones[0].id;
        }

        setFormData((prev) => ({
          ...prev,
          street_address:
            fullStreet ||
            (data.display_name
              ? data.display_name.split(",").slice(0, 2).join(",")
              : prev.street_address),
          zone_id: matchedZoneId
            ? String(matchedZoneId)
            : prev.zone_id ||
              (deliveryZones?.[0]?.id ? String(deliveryZones[0].id) : null),
        }));
      }
    } catch (err) {
      console.warn("Error en reverse geocoding:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCenterMapFromInput = (e) => {
    if (e) e.preventDefault();
    const street = (formData.street_address || "").trim();
    if (!street || street.length < 3) return;
    setMapSearchQuery((prev) => (prev === street ? `${street} ` : street));
  };

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

    if (!formData.street_address || formData.street_address.trim().length < 4) {
      setFormError("Ingresa una dirección válida (mínimo 4 caracteres).");
      return;
    }
    if (
      formData.latitude == null ||
      formData.longitude == null ||
      isNaN(formData.latitude) ||
      isNaN(formData.longitude)
    ) {
      setFormError("Debes ubicar y fijar el pin de tu entrega en el mapa.");
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

      const defaultFullName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        : user?.user_metadata?.full_name || "Cliente";
      const defaultPhone =
        profile?.phone || user?.user_metadata?.phone || "999999999";

      const fallbackZoneId =
        deliveryZones?.length > 0 ? deliveryZones[0].id : null;
      const resolvedZoneId = formData.zone_id
        ? Number(formData.zone_id)
        : fallbackZoneId
        ? Number(fallbackZoneId)
        : null;

      const payload = {
        user_id: user.id,
        alias: (formData.alias || "").trim() || "Casa",
        zone_id: resolvedZoneId,
        street_address: formData.street_address.trim(),
        reference: (formData.reference || "").trim(),
        receiver_name:
          (formData.receiver_name || "").trim() || defaultFullName || "Cliente",
        receiver_phone: formData.receiver_phone
          ? formData.receiver_phone.replace(/\D/g, "").slice(0, 9)
          : defaultPhone,
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

          {/* Paso A: Alias de la Dirección */}
          <div>
            <Input
              label="Alias de la Dirección"
              id="addr-alias"
              placeholder="Ej. Casa, Oficina, Depa"
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

          {/* Paso B: Ubicación en el Mapa */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5">
              Ubicación en el Mapa <span className="text-red-500">*</span>
            </label>
            <LocationPickerMap
              latitude={formData.latitude}
              longitude={formData.longitude}
              searchQuery={mapSearchQuery}
              onChange={handleMapLocationChange}
              height="h-56"
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              Mueve el pin o pulsa «Usar mi ubicación actual» para rellenar automáticamente tu dirección.
            </p>
          </div>

          {/* Paso C: Dirección Exacta */}
          <div>
            <label
              htmlFor="addr-street"
              className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
            >
              Dirección Exacta <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Input
                  id="addr-street"
                  placeholder="Calle / Av., Número, Interior o Departamento"
                  value={formData.street_address}
                  onChange={(e) =>
                    setFormData({ ...formData, street_address: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCenterMapFromInput(e);
                    }
                  }}
                  required
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCenterMapFromInput}
                title="Centrar en el mapa según la dirección"
                aria-label="Centrar en el mapa"
                className="shrink-0 h-10 px-3.5"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-brand-muted">
              Se autocompleta desde el mapa. Si prefieres tipear, presiona la lupa para centrar el pin.
            </p>
          </div>

          {/* Paso D: Referencia de Llegada (Opcional) */}
          <div>
            <Input
              label="Referencia de Llegada (Opcional)"
              id="addr-reference"
              placeholder="Ej. Frente al parque, rejas blancas, timbre 2B"
              value={formData.reference}
              onChange={(e) =>
                setFormData({ ...formData, reference: e.target.value })
              }
              helperText="Información complementaria no bloqueante para facilitar la entrega."
            />
          </div>

          {/* Paso E: Checkbox Dirección Principal */}
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

          {/* Paso F: Botones Cancelar y Guardar Dirección */}
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
