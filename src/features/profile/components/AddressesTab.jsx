import React, { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  Star,
  Phone,
  User,
  Navigation,
  X,
  Loader2,
  Home,
  Building,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../../components/ui/Card";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import { defaultDeliveryZones } from "../../checkout/data/mockDeliveryZones";

const INITIAL_FORM = {
  alias: "Casa",
  zone_id: "",
  street_address: "",
  reference: "",
  receiver_name: "",
  receiver_phone: "",
  is_default: false,
};

export default function AddressesTab() {
  const { user, profile } = useAuth();

  const [addresses, setAddresses] = useState([]);
  const [deliveryZones, setDeliveryZones] = useState(defaultDeliveryZones);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Modal de agregar/editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(null);

  // Cargar zonas de despacho activas
  const loadDeliveryZones = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("district_name");

      if (!error && data && data.length > 0) {
        setDeliveryZones(data);
      } else {
        setDeliveryZones(defaultDeliveryZones);
      }
    } catch {
      setDeliveryZones(defaultDeliveryZones);
    }
  }, []);

  // Cargar direcciones del usuario
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*, delivery_zones(district_name, delivery_cost)")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      console.error("Error al cargar direcciones:", err);
      setFeedback({
        type: "error",
        message: err.message || "No se pudieron cargar tus direcciones guardadas.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDeliveryZones();
    loadAddresses();
  }, [loadDeliveryZones, loadAddresses]);

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setEditingAddressId(null);
    setFormError(null);
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
      is_default: addresses.length === 0,
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (addr) => {
    setEditingAddressId(addr.id);
    setFormError(null);
    setFormData({
      alias: addr.alias || "Casa",
      zone_id: String(addr.zone_id || ""),
      street_address: addr.street_address || "",
      reference: addr.reference || "",
      receiver_name: addr.receiver_name || "",
      receiver_phone: addr.receiver_phone || "",
      is_default: Boolean(addr.is_default),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAddressId(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
  };

  // Guardar dirección (creación o edición)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Validaciones
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
      const willBeDefault = formData.is_default || addresses.length === 0;

      // Si se marca como default, desmarcar las demás previamente
      if (willBeDefault) {
        const { error: resetError } = await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);

        if (resetError) {
          console.warn("Aviso al actualizar defaults:", resetError);
        }
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
        updated_at: new Date().toISOString(),
      };

      if (editingAddressId) {
        const { error: updateError } = await supabase
          .from("addresses")
          .update(payload)
          .eq("id", editingAddressId);

        if (updateError) throw updateError;
        setFeedback({
          type: "success",
          message: "Dirección actualizada correctamente.",
        });
      } else {
        const { error: insertError } = await supabase
          .from("addresses")
          .insert([payload]);

        if (insertError) throw insertError;
        setFeedback({
          type: "success",
          message: "Nueva dirección agregada exitosamente.",
        });
      }

      handleCloseModal();
      await loadAddresses();
    } catch (err) {
      console.error("Error al guardar dirección:", err);
      setFormError(err.message || "Error al procesar la dirección en el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // Marcar como dirección principal con un clic
  const handleSetDefault = async (addressId) => {
    if (!user) return;
    setIsLoading(true);
    setFeedback(null);

    try {
      // 1. Quitar default a todas
      const { error: resetError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);

      if (resetError) throw resetError;

      // 2. Asignar default a la seleccionada
      const { error: updateError } = await supabase
        .from("addresses")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", addressId);

      if (updateError) throw updateError;

      setFeedback({
        type: "success",
        message: "Dirección principal actualizada.",
      });
      await loadAddresses();
    } catch (err) {
      console.error("Error al establecer dirección principal:", err);
      setFeedback({
        type: "error",
        message: err.message || "No se pudo actualizar la dirección principal.",
      });
      setIsLoading(false);
    }
  };

  // Eliminar dirección
  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("¿Confirmas que deseas eliminar esta dirección guardada?")) {
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const target = addresses.find((a) => a.id === addressId);
      const wasDefault = target?.is_default;

      const { error: deleteError } = await supabase
        .from("addresses")
        .delete()
        .eq("id", addressId);

      if (deleteError) throw deleteError;

      // Si la eliminada era la principal y quedan más, promover la primera
      const remaining = addresses.filter((a) => a.id !== addressId);
      if (wasDefault && remaining.length > 0) {
        await supabase
          .from("addresses")
          .update({ is_default: true })
          .eq("id", remaining[0].id);
      }

      setFeedback({
        type: "success",
        message: "Dirección eliminada correctamente.",
      });
      await loadAddresses();
    } catch (err) {
      console.error("Error al eliminar dirección:", err);
      setFeedback({
        type: "error",
        message: err.message || "No se pudo eliminar la dirección.",
      });
      setIsLoading(false);
    }
  };

  // Helper para nombre y flete del distrito
  const getZoneInfo = (addr) => {
    if (addr.delivery_zones?.district_name) {
      return {
        name: addr.delivery_zones.district_name,
        cost: addr.delivery_zones.delivery_cost,
      };
    }
    const match = deliveryZones.find((z) => Number(z.id) === Number(addr.zone_id));
    if (match) {
      return {
        name: match.district_name,
        cost: match.delivery_cost,
      };
    }
    return { name: "Lima Metropolitana", cost: 10.0 };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-card border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-status-danger-border text-status-danger-text"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Encabezado de la pestaña */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />
                Mis Direcciones de Entrega
              </CardTitle>
              <CardDescription>
                Gestiona tus lugares de entrega frecuentes para agilizar tus compras en el checkout.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              className="gap-1.5 self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              Agregar Nueva Dirección
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-brand-muted text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span>Cargando tus direcciones...</span>
            </div>
          ) : addresses.length === 0 ? (
            <div className="py-12 border border-dashed border-border rounded-card text-center p-6 bg-surface-subtle/50 space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-card border border-border flex items-center justify-center mx-auto text-brand-muted">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-primary">
                  Aún no tienes direcciones registradas
                </h4>
                <p className="text-xs text-brand-secondary mt-1 max-w-sm mx-auto">
                  Agrega una dirección para tenerla lista y preseleccionada en tu próximo pedido.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenCreateModal}
                className="gap-1.5 mt-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                Registrar Mi Primera Dirección
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => {
                const zoneInfo = getZoneInfo(addr);
                return (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-card border transition-all flex flex-col justify-between ${
                      addr.is_default
                        ? "border-brand-primary bg-surface-card ring-1 ring-brand-primary/20 shadow-subtle"
                        : "border-border bg-surface-card hover:border-border-strong"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Cabecera de la card con Alias y Badge Principal */}
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          {addr.alias?.toLowerCase().includes("oficina") ? (
                            <Building className="w-4 h-4 text-accent flex-shrink-0" />
                          ) : (
                            <Home className="w-4 h-4 text-accent flex-shrink-0" />
                          )}
                          <span className="font-bold text-sm text-brand-primary">
                            {addr.alias || "Dirección"}
                          </span>
                        </div>
                        {addr.is_default && (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Principal
                          </Badge>
                        )}
                      </div>

                      {/* Datos de dirección */}
                      <div className="space-y-1.5 text-xs">
                        <p className="font-semibold text-brand-primary leading-snug">
                          {addr.street_address}
                        </p>
                        <div className="flex items-center gap-1.5 text-brand-secondary">
                          <Navigation className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                          <span>
                            {zoneInfo.name} &bull; Flete:{" "}
                            <span className="font-mono font-medium text-brand-primary">
                              S/ {Number(zoneInfo.cost || 0).toFixed(2)}
                            </span>
                          </span>
                        </div>
                        <p className="text-brand-muted text-[11px] italic bg-surface-subtle p-2 rounded border border-border">
                          Ref: {addr.reference}
                        </p>
                      </div>

                      {/* Datos del receptor */}
                      <div className="pt-2 border-t border-border/60 text-[11px] text-brand-secondary space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
                          <span>Recibe: {addr.receiver_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
                          <span>Contacto: {addr.receiver_phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones de la card */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                      <div>
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-xs text-accent hover:text-accent-hover font-semibold hover:underline flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Hacer principal
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(addr)}
                          className="h-8 px-2.5 text-xs gap-1"
                          title="Editar dirección"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="h-8 px-2 text-xs text-status-danger-text hover:bg-rose-50"
                          title="Eliminar dirección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================= */}
      {/* MODAL / DRAWER: AGREGAR O EDITAR DIRECCIÓN */}
      {/* ========================================================= */}
      {isModalOpen && (
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
                  {editingAddressId ? "Editar Dirección" : "Agregar Nueva Dirección"}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="p-1 rounded text-brand-muted hover:text-brand-primary hover:bg-surface-subtle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-4 sm:p-5 space-y-4">
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
                  onClick={handleCloseModal}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  isLoading={isSaving}
                  className="bg-accent hover:bg-accent-hover text-white px-5"
                >
                  {editingAddressId ? "Guardar Cambios" : "Guardar Dirección"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
