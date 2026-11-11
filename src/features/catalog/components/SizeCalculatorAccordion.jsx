import React, { useState, useEffect, useMemo, useRef } from "react";
import { HelpCircle, RotateCcw, Save, Trash2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import {
  getBottomSize,
  getTopSize,
  getSockSize,
  getQuickSize,
} from "../utils/sizeRanges";

const STORAGE_KEY = "erxidi_size_preferences";
const LEGACY_STORAGE_KEY = "erxidi_user_profile_measurements";

const FIT_OPTIONS = ["Ajustado", "Regular", "Holgado"];

const mapFitToLabel = (fit) => {
  const map = {
    ajustado: "Ajustado",
    tight: "Ajustado",
    regular: "Regular",
    holgado: "Holgado",
    loose: "Holgado",
  };
  return map[fit?.toLowerCase()] || "Regular";
};

const mapLabelToDb = (label) => {
  const map = { Ajustado: "tight", Regular: "regular", Holgado: "loose" };
  return map[label] || "regular";
};

function RangeMeasureInput({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "cm",
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value != null ? String(value) : "");
    }
  }, [value, isFocused]);

  const handleInputChange = (e) => {
    const raw = e.target.value.replace(",", ".");
    setDraft(raw);
    if (raw === "") {
      onChange(null);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    if (draft === "") {
      onChange(null);
      return;
    }
    const num = parseFloat(draft);
    if (isNaN(num)) {
      onChange(null);
      setDraft("");
    } else {
      const precision = step < 1 ? 1 : 0;
      const rounded = Number(num.toFixed(precision));
      const clamped = Math.min(max, Math.max(min, rounded));
      onChange(clamped);
      setDraft(String(clamped));
    }
  };

  const handleSliderChange = (e) => {
    const num = parseFloat(e.target.value);
    onChange(num);
    setDraft(String(num));
  };

  const isSelected = value != null && !isNaN(Number(value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-brand-secondary">
          <span className="font-medium text-brand-primary">{label}</span>
          {tooltip && (
            <div className="relative group inline-flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-brand-muted hover:text-brand-primary cursor-pointer transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 w-48 p-2 rounded bg-brand-primary text-white text-[11px] leading-tight shadow-dropdown pointer-events-none text-center">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-surface-card focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onFocus={() => setIsFocused(true)}
            onBlur={handleInputBlur}
            onChange={handleInputChange}
            placeholder="—"
            className="w-12 text-right font-mono text-xs font-bold text-brand-primary bg-transparent outline-none"
          />
          <span className="font-mono text-xs text-brand-muted">{unit}</span>
        </div>
      </div>

      <div className="space-y-0.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={isSelected ? Number(value) : min}
          onChange={handleSliderChange}
          className={`w-full h-1.5 rounded cursor-pointer transition-opacity ${
            isSelected
              ? "bg-slate-200 accent-brand-primary opacity-100"
              : "bg-slate-200 accent-slate-400 opacity-40 hover:opacity-75"
          }`}
        />
        <div className="flex justify-between text-[10px] font-mono text-brand-muted">
          <span>
            {min} {unit}
          </span>
          <span>
            {max} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SizeCalculatorAccordion({
  isOpen = false,
  garmentFamily = "bottoms",
  onSizeCalculated,
}) {
  const { user, profile, refreshProfile } = useAuth();

  // 1. Cargar estado inicial y baseline guardado
  const getInitialBaseline = () => {
    let saved = null;
    if (typeof window !== "undefined") {
      try {
        const raw =
          localStorage.getItem(STORAGE_KEY) ||
          localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch {}
    }

    const bm = profile?.body_measurements || {};

    return {
      activeTab: saved?.activeTab || "quick",
      height:
        profile?.height_cm != null
          ? Number(profile.height_cm)
          : saved?.height != null
            ? Number(saved.height)
            : null,
      weight:
        profile?.weight_kg != null
          ? Number(profile.weight_kg)
          : saved?.weight != null
            ? Number(saved.weight)
            : null,
      fit: profile?.fit_preference
        ? mapFitToLabel(profile.fit_preference)
        : saved?.fit
          ? mapFitToLabel(saved.fit)
          : "Regular",
      waist:
        bm.waist != null
          ? Number(bm.waist)
          : saved?.waist != null
            ? Number(saved.waist)
            : null,
      hip:
        bm.hip != null
          ? Number(bm.hip)
          : saved?.hip != null
            ? Number(saved.hip)
            : null,
      underbust:
        (bm.under_bust ?? bm.underbust) != null
          ? Number(bm.under_bust ?? bm.underbust)
          : (saved?.under_bust ?? saved?.underbust) != null
            ? Number(saved?.under_bust ?? saved?.underbust)
            : null,
      bust:
        bm.bust != null
          ? Number(bm.bust)
          : saved?.bust != null
            ? Number(saved.bust)
            : null,
      footLength:
        (bm.foot_length ?? bm.footLength) != null
          ? Number(bm.foot_length ?? bm.footLength)
          : (saved?.foot_length ?? saved?.footLength) != null
            ? Number(saved?.foot_length ?? saved?.footLength)
            : null,
    };
  };

  const [savedBaseline, setSavedBaseline] = useState(getInitialBaseline);

  const [activeTab, setActiveTab] = useState(savedBaseline.activeTab);
  const [height, setHeight] = useState(savedBaseline.height);
  const [weight, setWeight] = useState(savedBaseline.weight);
  const [fit, setFit] = useState(savedBaseline.fit);
  const [waist, setWaist] = useState(savedBaseline.waist);
  const [hip, setHip] = useState(savedBaseline.hip);
  const [underbust, setUnderbust] = useState(savedBaseline.underbust);
  const [bust, setBust] = useState(savedBaseline.bust);
  const [footLength, setFootLength] = useState(savedBaseline.footLength);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Sincronizar baseline si el perfil de usuario cambia
  useEffect(() => {
    const updated = getInitialBaseline();
    setSavedBaseline(updated);
  }, [profile]);

  // Detección de mutaciones frente a savedBaseline
  const hasChanges = useMemo(() => {
    return (
      height !== savedBaseline.height ||
      weight !== savedBaseline.weight ||
      fit !== savedBaseline.fit ||
      waist !== savedBaseline.waist ||
      hip !== savedBaseline.hip ||
      underbust !== savedBaseline.underbust ||
      bust !== savedBaseline.bust ||
      footLength !== savedBaseline.footLength ||
      activeTab !== savedBaseline.activeTab
    );
  }, [
    height,
    weight,
    fit,
    waist,
    hip,
    underbust,
    bust,
    footLength,
    activeTab,
    savedBaseline,
  ]);

  const hasAnyData = useMemo(() => {
    return (
      height != null ||
      weight != null ||
      waist != null ||
      hip != null ||
      underbust != null ||
      bust != null ||
      footLength != null
    );
  }, [height, weight, waist, hip, underbust, bust, footLength]);

  // Cálculo en memoria inmediato
  const currentSuggestedSize = useMemo(() => {
    if (activeTab === "quick") {
      if (height == null || weight == null) return null;
      const heightM = height / 100;
      const imc = weight / (heightM * heightM);
      return getQuickSize(imc, fit);
    }

    if (garmentFamily === "tops") {
      return getTopSize(bust, underbust);
    }
    if (garmentFamily === "socks") {
      return getSockSize(footLength);
    }
    return getBottomSize(waist, hip);
  }, [
    activeTab,
    height,
    weight,
    fit,
    garmentFamily,
    waist,
    hip,
    bust,
    underbust,
    footLength,
  ]);

  // Emisión exclusiva por interacción del usuario (evita disparo pasivo por render)
  const prevSizeRef = useRef(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevSizeRef.current = currentSuggestedSize;
      return;
    }
    if (
      currentSuggestedSize &&
      currentSuggestedSize !== prevSizeRef.current &&
      isOpen
    ) {
      prevSizeRef.current = currentSuggestedSize;
      onSizeCalculated?.(currentSuggestedSize);
    }
  }, [currentSuggestedSize, isOpen]);

  // Guardado explícito (sin debounce automático)
  const handleSave = async () => {
    setIsSaving(true);
    const newBaseline = {
      height,
      weight,
      fit,
      waist,
      hip,
      underbust,
      bust,
      footLength,
      activeTab,
    };

    if (typeof window !== "undefined") {
      try {
        const localPayload = {
          height,
          weight,
          fit,
          waist,
          hip,
          bust,
          under_bust: underbust,
          underbust,
          foot_length: footLength,
          footLength,
          activeTab,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localPayload));
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(localPayload));
      } catch (e) {
        console.warn("Error guardando en localStorage:", e);
      }
    }

    if (user?.id) {
      try {
        const supabasePayload = {
          height_cm: height != null ? Number(height) : null,
          weight_kg: weight != null ? Number(weight) : null,
          fit_preference: mapLabelToDb(fit),
          body_measurements: {
            waist: waist != null ? Number(waist) : null,
            hip: hip != null ? Number(hip) : null,
            bust: bust != null ? Number(bust) : null,
            under_bust: underbust != null ? Number(underbust) : null,
            foot_length: footLength != null ? Number(footLength) : null,
          },
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("profiles")
          .update(supabasePayload)
          .eq("id", user.id);
        if (error) throw error;
        await refreshProfile?.();
      } catch (err) {
        console.error("Error guardando en Supabase:", err);
      }
    }

    setSavedBaseline(newBaseline);
    setIsSaving(false);
  };

  // Restablecer a los valores guardados
  const handleReset = () => {
    setHeight(savedBaseline.height);
    setWeight(savedBaseline.weight);
    setFit(savedBaseline.fit);
    setWaist(savedBaseline.waist);
    setHip(savedBaseline.hip);
    setUnderbust(savedBaseline.underbust);
    setBust(savedBaseline.bust);
    setFootLength(savedBaseline.footLength);
    setActiveTab(savedBaseline.activeTab);
  };

  // Borrado definitivo
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {}
    }

    if (user?.id) {
      try {
        await supabase
          .from("profiles")
          .update({
            height_cm: null,
            weight_kg: null,
            fit_preference: "regular",
            body_measurements: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        await refreshProfile?.();
      } catch (err) {
        console.error("Error eliminando perfil de Supabase:", err);
      }
    }

    const blankBaseline = {
      height: null,
      weight: null,
      fit: "Regular",
      waist: null,
      hip: null,
      underbust: null,
      bust: null,
      footLength: null,
      activeTab: "quick",
    };

    setSavedBaseline(blankBaseline);
    setHeight(null);
    setWeight(null);
    setFit("Regular");
    setWaist(null);
    setHip(null);
    setUnderbust(null);
    setBust(null);
    setFootLength(null);
    setActiveTab("quick");

    setIsDeleting(false);
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="space-y-4 p-4 rounded-card bg-surface-subtle border border-border text-brand-primary">
      {/* 2.1 Pestañas de Cabecera Planas */}
      <div className="flex border-b border-border mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("quick")}
          className={`pb-2 px-3 text-xs font-bold transition-colors relative ${
            activeTab === "quick"
              ? "text-brand-primary border-b-2 border-brand-primary"
              : "text-brand-muted hover:text-brand-secondary"
          }`}
        >
          Rápido
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("precise")}
          className={`pb-2 px-3 text-xs font-bold transition-colors relative ${
            activeTab === "precise"
              ? "text-brand-primary border-b-2 border-brand-primary"
              : "text-brand-muted hover:text-brand-secondary"
          }`}
        >
          Preciso (con cinta métrica)
        </button>
      </div>

      {/* 2.2 Controles Modo Rápido */}
      {activeTab === "quick" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <RangeMeasureInput
            label="Estatura"
            tooltip="Estatura de pie descalzo."
            value={height}
            onChange={setHeight}
            min={120}
            max={220}
            step={1}
            unit="cm"
          />

          <RangeMeasureInput
            label="Peso"
            tooltip="Peso corporal habitual en kilogramos."
            value={weight}
            onChange={setWeight}
            min={30}
            max={150}
            step={0.1}
            unit="kg"
          />

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-brand-secondary">
              Preferencia de Calce
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-card rounded-button border border-border">
              {FIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFit(opt)}
                  className={`py-1 text-xs font-semibold rounded transition-colors ${
                    fit === opt
                      ? "bg-surface-subtle text-brand-primary shadow-subtle border border-border"
                      : "text-brand-muted hover:text-brand-secondary"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2.2 Controles Modo Preciso por Familia */}
      {activeTab === "precise" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {garmentFamily === "tops" && (
            <>
              <RangeMeasureInput
                label="Contorno de Pecho / Busto"
                tooltip="Mide la zona de mayor proyección del pecho."
                value={bust}
                onChange={setBust}
                min={60}
                max={125}
                step={0.1}
                unit="cm"
              />
              <RangeMeasureInput
                label="Contorno Bajo Busto"
                tooltip="Mide el contorno justo debajo del busto, sobre la caja torácica."
                value={underbust}
                onChange={setUnderbust}
                min={55}
                max={110}
                step={0.1}
                unit="cm"
              />
            </>
          )}

          {garmentFamily === "socks" && (
            <RangeMeasureInput
              label="Longitud del Pie"
              tooltip="Distancia del talón al dedo más largo en cm."
              value={footLength}
              onChange={setFootLength}
              min={18}
              max={32}
              step={0.5}
              unit="cm"
            />
          )}

          {garmentFamily !== "tops" && garmentFamily !== "socks" && (
            <>
              <RangeMeasureInput
                label="Contorno de Cintura"
                tooltip="Mide el contorno a la altura del ombligo, relajando el abdomen."
                value={waist}
                onChange={setWaist}
                min={50}
                max={120}
                step={0.1}
                unit="cm"
              />
              <RangeMeasureInput
                label="Contorno de Cadera"
                tooltip="Mide la parte más ancha de los glúteos."
                value={hip}
                onChange={setHip}
                min={60}
                max={130}
                step={0.1}
                unit="cm"
              />
            </>
          )}
        </div>
      )}

      {/* 2.4 Botonera Inferior Derecha y Persistencia Explícita */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
        {hasChanges && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold text-brand-secondary hover:text-brand-primary hover:bg-surface-card transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer valores guardados</span>
          </button>
        )}

        {hasChanges && hasAnyData && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {user
              ? "Guardar medidas en mi perfil"
              : "Guardar medidas en este dispositivo"}
          </Button>
        )}

        {!hasChanges && hasAnyData && (
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-button transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar medidas</span>
          </button>
        )}
      </div>

      {/* 2.5 Micro-Modal Flotante de Confirmación de Borrado */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-card bg-surface-card border border-border p-5 shadow-dropdown space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-brand-primary">
                ¿Eliminar medidas guardadas?
              </h3>
              <p className="text-xs text-brand-secondary leading-relaxed">
                Tus medidas corporales se eliminarán de tu cuenta y el
                recomendador volverá a estar en blanco.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-button text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                {isDeleting ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
