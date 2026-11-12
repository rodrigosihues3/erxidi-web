import React, { useState, useMemo } from "react";
import {
  Ruler,
  Edit3,
  Trash2,
  CheckCircle2,
  Info,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import SizeMatcherModal from "../../catalog/components/SizeMatcherModal";
import {
  getBottomSize,
  getTopSize,
  getSockSize,
  getQuickSize,
} from "../../catalog/utils/sizeRanges";
import { calculateShoeSize } from "../../catalog/services/sizeMatcherService";

export default function SizePreferencesTab() {
  const { user, profile, refreshProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Extraer datos corporales
  const measurements = useMemo(() => {
    if (!profile) return null;
    const bm = profile.body_measurements || {};
    const hasHeightWeight = Boolean(profile.height_cm && profile.weight_kg);
    const hasAnatomic = Boolean(
      bm.waist != null ||
      bm.hip != null ||
      bm.bust != null ||
      bm.under_bust != null ||
      bm.underbust != null ||
      bm.foot_length != null ||
      bm.footLength != null
    );

    if (!hasHeightWeight && !hasAnatomic) return null;

    const safeHeight = profile.height_cm ? Number(profile.height_cm) : null;
    const safeWeight = profile.weight_kg ? Number(profile.weight_kg) : null;
    const fitLabel =
      profile.fit_preference === "tight"
        ? "Ajustado"
        : profile.fit_preference === "loose"
        ? "Holgado"
        : "Regular";

    const waist = bm.waist != null ? Number(bm.waist) : null;
    const hip = bm.hip != null ? Number(bm.hip) : null;
    const underbust =
      bm.under_bust != null
        ? Number(bm.under_bust)
        : bm.underbust != null
        ? Number(bm.underbust)
        : null;
    const bust = bm.bust != null ? Number(bm.bust) : null;
    const footLength =
      bm.foot_length != null
        ? Number(bm.foot_length)
        : bm.footLength != null
        ? Number(bm.footLength)
        : null;

    // Inferencia de tallas
    let imc = null;
    let quickSize = null;
    if (safeHeight && safeWeight) {
      const hM = safeHeight / 100;
      imc = (safeWeight / (hM * hM)).toFixed(1);
      quickSize = getQuickSize(Number(imc), fitLabel);
    }

    const bottomSize = getBottomSize(waist, hip) || quickSize || "—";
    const topSize = getTopSize(bust, underbust) || quickSize || "—";
    const sockSize = getSockSize(footLength) || quickSize || "—";
    const shoeRange = footLength ? calculateShoeSize(footLength) : null;

    return {
      hasHeightWeight,
      hasAnatomic,
      height: safeHeight,
      weight: safeWeight,
      fitLabel,
      imc,
      waist,
      hip,
      underbust,
      bust,
      footLength,
      shoeRange,
      bottomSize,
      topSize,
      sockSize,
    };
  }, [profile]);

  // Borrado de medidas
  const handleDeleteMeasurements = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          height_cm: null,
          weight_kg: null,
          fit_preference: "regular",
          body_measurements: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      localStorage.removeItem("erxidi_size_preferences");
      localStorage.removeItem("erxidi_user_profile_measurements");
      await refreshProfile();
      setShowConfirmDelete(false);
    } catch (err) {
      console.error("Error al borrar medidas del perfil:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ESTADO A: SIN MEDIDAS REGISTRADAS */}
      {!measurements ? (
        <div className="p-10 text-center bg-surface-card border border-border rounded-card space-y-4 shadow-subtle">
          <div className="w-14 h-14 rounded-full bg-surface-subtle border border-border text-brand-muted flex items-center justify-center mx-auto">
            <Ruler className="w-7 h-7 text-accent" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-bold text-brand-primary">
              No tienes medidas corporales registradas
            </h2>
            <p className="text-xs text-brand-secondary leading-relaxed">
              Configura tu estatura, peso o medidas con cinta métrica. Nuestro
              sistema seleccionará automáticamente tu talla recomendada en todo el catálogo.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsModalOpen(true)}
              className="bg-accent hover:bg-accent-hover text-white text-xs px-6"
            >
              <Ruler className="w-4 h-4 mr-2" />
              Configurar Mis Medidas
            </Button>
          </div>
        </div>
      ) : (
        /* ESTADO B: FICHA RESUMEN MINIMALISTA */
        <div className="space-y-6">
          {/* Cabecera y Tallas Asignadas */}
          <div className="bg-surface-card border border-border rounded-card p-6 shadow-subtle space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-brand-primary flex items-center gap-2">
                    Perfil Antropométrico Activo
                    <Badge variant="success" className="text-[10px]">
                      Sincronizado
                    </Badge>
                  </h2>
                  <p className="text-xs text-brand-secondary">
                    Tallas calibradas según la norma técnica NTP-ISO 8559-2 y tus preferencias de calce.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-accent" />
                  Modificar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-xs text-status-danger-text hover:bg-rose-50 hover:border-status-danger-border gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Borrar
                </Button>
              </div>
            </div>

            {/* Grid de Tallas Recomendadas ERXIDI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-brand-secondary">
                    Ropa Interior
                  </span>
                  <span className="block text-[11px] text-brand-muted">
                    Bóxers, Calzones y Slips
                  </span>
                </div>
                <div className="w-11 h-11 rounded-card bg-brand-primary text-white font-mono text-xl font-black flex items-center justify-center shadow-xs">
                  {measurements.bottomSize}
                </div>
              </div>

              <div className="p-3.5 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-brand-secondary">
                    Prendas Superiores
                  </span>
                  <span className="block text-[11px] text-brand-muted">
                    Brasieres, Tops y Polos
                  </span>
                </div>
                <div className="w-11 h-11 rounded-card bg-brand-primary text-white font-mono text-xl font-black flex items-center justify-center shadow-xs">
                  {measurements.topSize}
                </div>
              </div>

              <div className="p-3.5 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-brand-secondary">
                    Calcetería
                  </span>
                  <span className="block text-[11px] text-brand-muted">
                    {measurements.shoeRange ? `Calzado ${measurements.shoeRange}` : "Medias de algodón"}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-card bg-brand-primary text-white font-mono text-xl font-black flex items-center justify-center shadow-xs">
                  {measurements.sockSize}
                </div>
              </div>
            </div>

            {/* Desglose de Medidas Registradas */}
            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-secondary">
                Tus Parámetros Físicos Registrados
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {measurements.height && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Estatura</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.height} cm
                    </span>
                  </div>
                )}
                {measurements.weight && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Peso</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.weight} kg
                    </span>
                  </div>
                )}
                {measurements.imc && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">IMC Calculado</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.imc}
                    </span>
                  </div>
                )}
                <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                  <span className="text-brand-muted block text-[11px]">Preferencia de Calce</span>
                  <span className="font-bold text-brand-primary text-sm">
                    {measurements.fitLabel}
                  </span>
                </div>
                {measurements.waist && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Contorno de Cintura</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.waist} cm
                    </span>
                  </div>
                )}
                {measurements.hip && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Contorno de Cadera</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.hip} cm
                    </span>
                  </div>
                )}
                {measurements.underbust && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Bajo Busto / Tórax</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.underbust} cm
                    </span>
                  </div>
                )}
                {measurements.bust && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Contorno de Pecho</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.bust} cm
                    </span>
                  </div>
                )}
                {measurements.footLength && (
                  <div className="p-2.5 rounded-card bg-surface-subtle border border-border/60">
                    <span className="text-brand-muted block text-[11px]">Largo de Pie</span>
                    <span className="font-mono font-bold text-brand-primary text-sm">
                      {measurements.footLength} cm
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reutilizado de Medición y Ajuste */}
      <SizeMatcherModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          refreshProfile();
        }}
        onSizeSelected={() => {
          refreshProfile();
        }}
      />

      {/* Micro-Modal Flotante de Confirmación para Borrado */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-surface-card border border-border rounded-card p-5 space-y-4 shadow-dropdown">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-brand-primary">
                ¿Eliminar medidas del perfil?
              </h3>
              <p className="text-xs text-brand-secondary leading-relaxed">
                Tus datos corporales serán eliminados y las prendas del catálogo
                dejarán de sugerirte tallas automáticas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowConfirmDelete(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteMeasurements}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4"
              >
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
