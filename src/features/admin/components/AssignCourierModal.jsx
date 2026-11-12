import { useEffect, useMemo, useState } from "react";
import { PauseCircle, UserCheck, X, Truck } from "lucide-react";
import Button from "../../../components/ui/Button";
import {
  getDeliveryStaff,
  subscribeCouriersRealtime,
} from "../services/adminOrders.service";

export function isCourierPaused(courier) {
  if (!courier) return false;
  const opStatus = String(courier.operational_status || "").toLowerCase();
  const availStatus = String(courier.availability_status || "").toLowerCase();
  return (
    Boolean(courier.is_paused) ||
    courier.is_on_duty === false ||
    opStatus === "paused" ||
    opStatus === "en_pausa" ||
    opStatus === "offline" ||
    availStatus === "en_pausa" ||
    availStatus === "paused" ||
    availStatus === "offline"
  );
}

function cleanCourierSurname(surname = "") {
  return String(surname).replace(/\[.*?\]/g, "").trim();
}

function sortCouriersByAvailability(list) {
  return [...list].sort((a, b) => {
    const aPaused = isCourierPaused(a) ? 1 : 0;
    const bPaused = isCourierPaused(b) ? 1 : 0;
    if (aPaused !== bPaused) return aPaused - bPaused;
    const nameA = `${a.first_name || ""} ${cleanCourierSurname(a.paternal_surname)}`.trim();
    const nameB = `${b.first_name || ""} ${cleanCourierSurname(b.paternal_surname)}`.trim();
    return nameA.localeCompare(nameB, "es");
  });
}

export default function AssignCourierModal({
  isOpen,
  currentDriverId,
  orderDeliveryType,
  deliveryStaff = [],
  loading = false,
  onClose,
  onConfirm,
  onCouriersChange,
}) {
  const [couriers, setCouriers] = useState(deliveryStaff);
  const [selectedId, setSelectedId] = useState(currentDriverId || "");

  useEffect(() => {
    setCouriers(deliveryStaff || []);
  }, [deliveryStaff]);

  useEffect(() => {
    if (!isOpen) return undefined;

    setSelectedId(currentDriverId || "");

    let active = true;
    const syncStaff = () => {
      getDeliveryStaff()
        .then((freshStaff) => {
          if (!active) return;
          setCouriers(freshStaff);
          if (onCouriersChange) onCouriersChange(freshStaff);
        })
        .catch(() => {});
    };

    syncStaff();
    const intervalId = setInterval(syncStaff, 2000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncStaff();
    };
    window.addEventListener("focus", syncStaff);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener("focus", syncStaff);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isOpen, currentDriverId, onCouriersChange]);

  useEffect(() => {
    const unsubscribe = subscribeCouriersRealtime((updatedCourier) => {
      setCouriers((prev) => {
        const exists = prev.some((c) => c.id === updatedCourier.id);
        if (!exists) return prev;
        const next = prev.map((c) =>
          c.id === updatedCourier.id ? { ...c, ...updatedCourier } : c,
        );
        if (onCouriersChange) onCouriersChange(next);
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onCouriersChange]);

  const selectedCourierObj = useMemo(
    () => (couriers || []).find((c) => c.id === selectedId) || null,
    [couriers, selectedId],
  );
  const isSelectedPaused =
    Boolean(selectedId) && isCourierPaused(selectedCourierObj);

  useEffect(() => {
    if (isSelectedPaused) {
      setSelectedId("");
    }
  }, [isSelectedPaused]);

  const isExpressOrder =
    String(orderDeliveryType || "").toLowerCase() === "express";
  const orderTypeLabel = isExpressOrder ? "Express" : "Programado";
  const otherTypeLabel = isExpressOrder ? "Programado" : "Express";

  const { matchingCouriers, otherCouriers } = useMemo(() => {
    const matching = [];
    const other = [];
    (couriers || []).forEach((courier) => {
      if (courier.is_active === false) return;
      const cType = String(courier.delivery_type || "").toLowerCase();
      const isExpressCourier = cType === "express";
      if (isExpressOrder ? isExpressCourier : !isExpressCourier) {
        matching.push(courier);
      } else {
        other.push(courier);
      }
    });
    return {
      matchingCouriers: sortCouriersByAvailability(matching),
      otherCouriers: sortCouriersByAvailability(other),
    };
  }, [couriers, isExpressOrder]);

  if (!isOpen) return null;

  function renderCourierItem(staff) {
    const isPaused = isCourierPaused(staff);
    const isSelected = selectedId === staff.id && !isPaused;
    const cleanSurname = cleanCourierSurname(staff.paternal_surname);
    const opStatus = String(staff.operational_status || "").toLowerCase();
    const isOnRoute =
      opStatus === "on_route" ||
      opStatus === "in_route" ||
      opStatus === "en_ruta";

    return (
      <label
        key={staff.id}
        className={`flex items-start justify-between p-3 rounded-button border text-xs transition-colors ${
          isPaused
            ? "opacity-60 bg-slate-50 cursor-not-allowed border-border text-brand-secondary"
            : isSelected
              ? "border-brand-primary bg-surface-subtle shadow-xs cursor-pointer"
              : "border-border bg-surface-card hover:bg-surface-subtle text-brand-secondary cursor-pointer"
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <input
            type="radio"
            name="assigned_courier"
            value={staff.id}
            disabled={isPaused}
            checked={isSelected}
            onChange={() => {
              if (!isPaused) setSelectedId(staff.id);
            }}
            className="accent-brand-primary mt-0.5 disabled:cursor-not-allowed"
          />
          <div className="space-y-0.5">
            <p className="font-bold text-brand-primary">
              {staff.first_name} {cleanSurname}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-brand-muted font-mono">
              <span>DNI: {staff.dni || "—"}</span>
              <span>·</span>
              <span>Tel: {staff.phone || "Sin tel."}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isPaused ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <PauseCircle className="w-3 h-3" />
              En Pausa
            </span>
          ) : isOnRoute ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Truck className="w-3 h-3" />
              En Ruta
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Disponible
            </span>
          )}
        </div>
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-brand-primary" />
            <div>
              <h3 className="text-sm font-bold text-brand-primary">
                Asignar Repartidor al Pedido
              </h3>
              <p className="text-[11px] text-brand-secondary">
                Modalidad requerida:{" "}
                <span className="font-bold text-brand-primary">
                  {orderTypeLabel}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Opción desvincular */}
          <label
            className={`flex items-center justify-between p-3 rounded-button border text-xs cursor-pointer transition-colors ${
              selectedId === ""
                ? "border-brand-primary bg-surface-subtle font-semibold"
                : "border-border bg-surface-card hover:bg-surface-subtle text-brand-secondary"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="radio"
                name="assigned_courier"
                value=""
                checked={selectedId === ""}
                onChange={() => setSelectedId("")}
                className="accent-brand-primary"
              />
              <span className="text-brand-primary font-medium">
                Sin asignar (Mantener / Enviar a bolsa común)
              </span>
            </div>
            <span className="text-[10px] text-brand-muted font-mono">
              Bolsa de pedidos
            </span>
          </label>

          {/* Grupo 1: Recomendados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-primary">
                Repartidores Especializados ({orderTypeLabel}) — Recomendados
              </span>
              <span className="text-[10px] font-mono text-brand-muted">
                {matchingCouriers.filter((c) => !isCourierPaused(c)).length}{" "}
                disponible(s)
              </span>
            </div>

            {matchingCouriers.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-2 px-3 rounded-button bg-surface-subtle border border-border">
                No hay repartidores registrados con especialidad {orderTypeLabel}.
              </p>
            ) : (
              <div className="space-y-2">
                {matchingCouriers.map((staff) => renderCourierItem(staff))}
              </div>
            )}
          </div>

          {/* Grupo 2: Otros Repartidores */}
          {otherCouriers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-primary">
                  Otros repartidores ({otherTypeLabel})
                </span>
                <span className="text-[10px] font-mono text-brand-muted">
                  {otherCouriers.filter((c) => !isCourierPaused(c)).length}{" "}
                  disponible(s)
                </span>
              </div>

              <div className="space-y-2">
                {otherCouriers.map((staff) => renderCourierItem(staff))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0 bg-surface-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={loading}
            disabled={loading || isSelectedPaused}
            onClick={() => onConfirm(selectedId)}
          >
            Confirmar Asignación
          </Button>
        </div>
      </div>
    </div>
  );
}
