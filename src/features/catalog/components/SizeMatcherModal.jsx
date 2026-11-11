import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  AlertTriangle,
  Ruler,
  Save,
  RotateCcw,
  Info,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import { calculateShoeSize } from "../services/sizeMatcherService";
import {
  getBottomSize,
  getTopSize,
  getSockSize,
  getQuickSize,
  BOTTOM_LIMITS,
  TOP_LIMITS,
  SOCK_LIMITS,
  HIP_FROM_WAIST_OFFSET_CM,
  BUST_FROM_UNDERBUST_OFFSET_CM,
} from "../utils/sizeRanges";
import useDialogA11y from "../hooks/useDialogA11y";

const STORAGE_KEY = "erxidi_size_preferences";
const LEGACY_STORAGE_KEY = "erxidi_user_profile_measurements";
const FIT_OPTIONS = [
  { id: "Ajustado", desc: "Ceñido" },
  { id: "Regular", desc: "Estándar" },
  { id: "Holgado", desc: "Suelto" },
];

const mapFitToLabel = (fit) => {
  const map = { ajustado: "Ajustado", tight: "Ajustado", regular: "Regular", holgado: "Holgado", loose: "Holgado" };
  return map[fit?.toLowerCase()] || "Regular";
};
const mapLabelToFit = (label) => {
  const map = { Ajustado: "tight", Regular: "regular", Holgado: "loose" };
  return map[label] || "regular";
};

function clampNumber(val, min, max) {
  const num = Number(val);
  if (isNaN(num)) return min;
  return Math.min(max, Math.max(min, Number(num.toFixed(1))));
}

function isWithinRange(val, min, max) {
  if (val == null || val === "") return false;
  const num = Number(val);
  return !isNaN(num) && num >= min && num <= max;
}

function getSavedMeasurements() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    return null;
  }
  return null;
}

/**
 * Control minimalista con estado "en blanco" (slider gris en el mínimo cuando value === null)
 * y botones [-] [+] siempre visibles gracias a min-w-0 en el input.
 */
function RangeMeasureInput({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "cm",
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(value != null ? String(value) : "");
  }, [value, isEditing]);

  const isSelected = value != null && value !== "" && !isNaN(Number(value));
  const numericValid = isSelected ? clampNumber(value, min, max) : null;

  const handleSliderChange = (e) => {
    const next = clampNumber(e.target.value, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.currentTarget.blur(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = !isSelected
        ? min
        : clampNumber(Number(numericValid) + (e.shiftKey ? 0.1 : step) * (e.key === "ArrowUp" ? 1 : -1), min, max);
      setDraft(String(next));
      onChange(next);
    }
  };

  const handleTextChange = (e) => {
    const raw = e.target.value.replace(",", ".");
    if (raw === "") {
      setDraft("");
      onChange(null);
      return;
    }
    if (!/^\d{0,3}(\.\d?)?$/.test(raw)) return;
    setDraft(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= min && parsed <= max && !raw.endsWith(".")) {
      onChange(Number(parsed.toFixed(1)));
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (draft === "" || isNaN(Number(draft))) {
      setDraft("");
      onChange(null);
      return;
    }
    const clamped = clampNumber(draft, min, max);
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block text-xs font-bold text-brand-primary truncate"
          >
            {label}
          </label>
          {hint && (
            <span className="block text-xs text-brand-secondary truncate">
              {hint}
            </span>
          )}
        </div>
        <div className="flex h-8 items-center gap-1 rounded-button border border-border bg-surface-subtle px-2 transition-colors hover:border-border-strong focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={handleTextChange}
            onFocus={(e) => { setIsEditing(true); e.target.select(); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="—"
            className="w-14 bg-transparent text-right font-mono text-sm font-semibold text-brand-primary outline-none placeholder:font-normal placeholder:text-brand-muted"
          />
          <span className="text-xs text-brand-secondary" aria-hidden="true">{unit}</span>
        </div>
      </div>

      {/* Slider: tenue y en el extremo izquierdo si está en blanco */}
      <div className="space-y-1 pt-0.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValid != null ? numericValid : min}
          onChange={handleSliderChange}
          className={
            "w-full cursor-pointer h-1.5 rounded-lg transition-opacity " +
            (isSelected
              ? "accent-brand-primary bg-border opacity-100"
              : "accent-brand-muted bg-border opacity-40 hover:opacity-75")
          }
        />
        <div className="flex justify-between text-xs font-mono text-brand-secondary">
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

export default function SizeMatcherModal({
  isOpen,
  onClose,
  onSizeSelected,
  garmentFamily = null,
}) {
  const { user, profile, refreshProfile } = useAuth();
  const saved = useMemo(() => getSavedMeasurements() || {}, []);

  const [activeTab, setActiveTab] = useState(saved.activeTab || "quick");

  // Si no hay datos guardados previamente, inician en null (en blanco)
  const [height, setHeight] = useState(
    isWithinRange(saved.height, 120, 220) ? Number(saved.height) : null
  );
  const [weight, setWeight] = useState(
    isWithinRange(saved.weight, 30, 160) ? Number(saved.weight) : null
  );
  const [fit, setFit] = useState(saved.fit ? mapFitToLabel(saved.fit) : "Regular");

  const [waist, setWaist] = useState(
    isWithinRange(saved.waist, 45, 120) ? Number(saved.waist) : null
  );
  const [hip, setHip] = useState(
    isWithinRange(saved.hip, 50, 130) ? Number(saved.hip) : null
  );
  const [underbust, setUnderbust] = useState(
    isWithinRange(saved.under_bust ?? saved.underbust, 55, 110)
      ? Number(saved.under_bust ?? saved.underbust)
      : null
  );
  const [bust, setBust] = useState(
    isWithinRange(saved.bust, 60, 125) ? Number(saved.bust) : null
  );
  const [footLength, setFootLength] = useState(
    isWithinRange(saved.foot_length ?? saved.footLength, 14, 31)
      ? Number(saved.foot_length ?? saved.footLength)
      : null
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (user && profile) {
        setHeight(
          isWithinRange(profile.height_cm, 120, 220)
            ? Number(profile.height_cm)
            : null
        );
        setWeight(
          isWithinRange(profile.weight_kg, 30, 160)
            ? Number(profile.weight_kg)
            : null
        );
        if (profile.fit_preference) {
          setFit(mapFitToLabel(profile.fit_preference));
        }

        const bodyM = profile.body_measurements || {};
        setWaist(
          isWithinRange(bodyM.waist, 45, 120) ? Number(bodyM.waist) : null
        );
        setHip(isWithinRange(bodyM.hip, 50, 130) ? Number(bodyM.hip) : null);
        const ub = bodyM.under_bust ?? bodyM.underbust;
        setUnderbust(isWithinRange(ub, 55, 110) ? Number(ub) : null);
        setBust(isWithinRange(bodyM.bust, 60, 125) ? Number(bodyM.bust) : null);
        const fl = bodyM.foot_length ?? bodyM.footLength;
        setFootLength(isWithinRange(fl, 14, 31) ? Number(fl) : null);
      } else {
        const stored = getSavedMeasurements();
        if (stored) {
          setHeight(
            isWithinRange(stored.height, 120, 220)
              ? Number(stored.height)
              : null
          );
          setWeight(
            isWithinRange(stored.weight, 30, 160)
              ? Number(stored.weight)
              : null
          );
          if (stored.fit) setFit(mapFitToLabel(stored.fit));
          setWaist(
            isWithinRange(stored.waist, 45, 120) ? Number(stored.waist) : null
          );
          setHip(
            isWithinRange(stored.hip, 50, 130) ? Number(stored.hip) : null
          );
          const ub = stored.under_bust ?? stored.underbust;
          setUnderbust(isWithinRange(ub, 55, 110) ? Number(ub) : null);
          setBust(
            isWithinRange(stored.bust, 60, 125) ? Number(stored.bust) : null
          );
          const fl = stored.foot_length ?? stored.footLength;
          setFootLength(isWithinRange(fl, 14, 31) ? Number(fl) : null);
          if (stored.activeTab) setActiveTab(stored.activeTab);
        } else {
          setHeight(null);
          setWeight(null);
          setWaist(null);
          setHip(null);
          setUnderbust(null);
          setBust(null);
          setFootLength(null);
        }
      }
    }
  }, [isOpen, user, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const hasQuickValues =
    isWithinRange(height, 120, 220) && isWithinRange(weight, 30, 160);

  const quickResult = useMemo(() => {
    if (!hasQuickValues) {
      return { size: null, safeHeight: null, safeWeight: null, imc: null };
    }
    const safeHeight = clampNumber(height, 120, 220);
    const safeWeight = clampNumber(weight, 30, 160);
    const heightInMeters = safeHeight / 100;
    const computedImc = safeWeight / (heightInMeters * heightInMeters);
    return {
      size: getQuickSize(computedImc, fit),
      safeHeight,
      safeWeight,
      imc: computedImc.toFixed(1),
    };
  }, [hasQuickValues, height, weight, fit]);

  const preciseResult = useMemo(() => {
    const validWaist = isWithinRange(waist, 45, 120) ? Number(waist) : null;
    const validHip = isWithinRange(hip, 50, 130) ? Number(hip) : null;
    const validUnderbust = isWithinRange(underbust, 55, 110)
      ? Number(underbust)
      : null;
    const validBust = isWithinRange(bust, 60, 125) ? Number(bust) : null;
    const validFoot = isWithinRange(footLength, 14, 31)
      ? Number(footLength)
      : null;

    const bottom = getBottomSize(validWaist, validHip);
    const top = getTopSize(validBust, validUnderbust);
    const sock = getSockSize(validFoot);
    const shoeSizeRange = validFoot != null ? calculateShoeSize(validFoot) : "—";
    return {
      bottomSize: bottom,
      topSize: top,
      sockSize: sock,
      shoeSizeRange,
      estimatedBottom: (validWaist != null) !== (validHip != null),
      estimatedTop: validBust == null && validUnderbust != null,
    };
  }, [waist, hip, bust, underbust, footLength]);

  const hasPreciseValues =
    Boolean(preciseResult.bottomSize) ||
    Boolean(preciseResult.topSize) ||
    Boolean(preciseResult.sockSize);

  const applicableSelectedSize = useMemo(() => {
    if (activeTab === "quick") return quickResult.size;
    if (garmentFamily === "tops" && preciseResult.topSize)
      return preciseResult.topSize;
    if (garmentFamily === "socks" && preciseResult.sockSize)
      return preciseResult.sockSize;
    if (garmentFamily === "bottoms" && preciseResult.bottomSize)
      return preciseResult.bottomSize;
    return (
      preciseResult.bottomSize ||
      preciseResult.topSize ||
      preciseResult.sockSize ||
      quickResult.size
    );
  }, [activeTab, garmentFamily, quickResult.size, preciseResult]);

  const dialogRef = useRef(null);
  useDialogA11y(isOpen, dialogRef);

  const [showMethod, setShowMethod] = useState(false);
  useEffect(() => {
    if (!isOpen) setShowMethod(false);
  }, [isOpen]);

  const [pendingClear, setPendingClear] = useState({ quick: false, precise: false });
  const [clearHintVisible, setClearHintVisible] = useState(false);
  const clearHintTimer = useRef(null);
  useEffect(() => {
    if (!isOpen) { setPendingClear({ quick: false, precise: false }); setClearHintVisible(false); }
  }, [isOpen]);
  useEffect(() => () => clearTimeout(clearHintTimer.current), []);

  if (!isOpen) return null;

  const hasValuesInView =
    activeTab === "quick"
      ? height != null || weight != null || fit !== "Regular"
      : waist != null || hip != null || underbust != null || bust != null || footLength != null;

  const handleResetCurrentView = () => {
    setSaveError("");
    if (activeTab === "quick") { setHeight(null); setWeight(null); setFit("Regular"); }
    else { setWaist(null); setHip(null); setUnderbust(null); setBust(null); setFootLength(null); }
    setPendingClear((p) => ({ ...p, [activeTab]: true }));
    setClearHintVisible(true);
    clearTimeout(clearHintTimer.current);
    clearHintTimer.current = setTimeout(() => setClearHintVisible(false), 4500);
  };

  const handleSaveClear = async () => {
    setSaveError("");
    setIsSaving(true);
    let done = false;
    try {
      if (user) {
        const patch = activeTab === "quick"
          ? { height_cm: null, weight_kg: null, fit_preference: "regular" }
          : { body_measurements: null };
        const { error } = await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", user.id);
        if (error) throw error;
        await refreshProfile();
      }
      // Copia local (la pestaña de preferencias guarda ahí también, con sesión iniciada): limpiar ambas claves.
      const localPatch = activeTab === "quick"
        ? { height: null, weight: null, fit: "Regular" }
        : { waist: null, hip: null, under_bust: null, underbust: null, bust: null, foot_length: null, footLength: null };
      [STORAGE_KEY, LEGACY_STORAGE_KEY].forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          localStorage.setItem(key, JSON.stringify({ ...JSON.parse(raw), ...localPatch, updatedAt: new Date().toISOString() }));
        } catch { /* datos locales corruptos: ignorar */ }
      });
      done = true;
    } catch (err) {
      console.error("Error al borrar medidas guardadas:", err);
      setSaveError("No se pudieron borrar tus medidas. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
    if (done) { onSizeSelected?.(null, null); onClose?.(); }
  };

  const handleApply = async () => {
    setSaveError("");
    const safeHeight = isWithinRange(height, 120, 220)
      ? clampNumber(height, 120, 220)
      : null;
    const safeWeight = isWithinRange(weight, 30, 160)
      ? clampNumber(weight, 30, 160)
      : null;

    setIsSaving(true);
    let saved = false;
    try {
      if (activeTab === "quick") {
        if (user) {
          const { error } = await supabase
            .from("profiles")
            .update({
              height_cm: safeHeight,
              weight_kg: safeWeight,
              fit_preference: mapLabelToFit(fit),
              body_measurements: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
          if (error) throw error;
          await refreshProfile();
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              height: safeHeight,
              weight: safeWeight,
              fit,
              waist: null,
              hip: null,
              under_bust: null,
              bust: null,
              foot_length: null,
              activeTab: "quick",
              updatedAt: new Date().toISOString(),
            })
          );
        }
      } else {
        const bodyMeasurementsObj = {
          waist: isWithinRange(waist, 45, 120) ? Number(waist) : null,
          hip: isWithinRange(hip, 50, 130) ? Number(hip) : null,
          under_bust: isWithinRange(underbust, 55, 110)
            ? Number(underbust)
            : null,
          bust: isWithinRange(bust, 60, 125) ? Number(bust) : null,
          foot_length: isWithinRange(footLength, 14, 31)
            ? Number(footLength)
            : null,
        };

        if (user) {
          const { error } = await supabase
            .from("profiles")
            .update({
              height_cm: safeHeight,
              weight_kg: safeWeight,
              fit_preference: mapLabelToFit(fit),
              body_measurements: bodyMeasurementsObj,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
          if (error) throw error;
          await refreshProfile();
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              height: safeHeight,
              weight: safeWeight,
              fit,
              ...bodyMeasurementsObj,
              footLength: bodyMeasurementsObj.foot_length,
              activeTab: "precise",
              updatedAt: new Date().toISOString(),
            })
          );
        }
      }
      saved = true;
    } catch (err) {
      console.error("Error al persistir mediciones:", err);
      setSaveError("No se pudo guardar tu perfil. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
    if (saved) {
      onSizeSelected?.(applicableSelectedSize, {
        height: safeHeight,
        weight: safeWeight,
        fit,
        waist,
        hip,
        bust,
        underbust,
        foot_length: footLength,
        activeTab,
      });
      onClose?.();
    }
  };

  const canClearSave = !hasValuesInView && pendingClear[activeTab];
  const canSave =
    (activeTab === "quick" ? hasQuickValues : hasPreciseValues) || canClearSave;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-xl bg-surface-card border border-border rounded-card shadow-dropdown overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-surface-card border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Ruler className="w-4 h-4 text-accent" />
            <h2 className="text-base font-bold text-brand-primary">
              Calculador de Tallas ERXIDI
            </h2>
            <button type="button" onClick={() => setShowMethod((v) => !v)} aria-expanded={showMethod} aria-controls="size-method-panel" title="¿Cómo calculamos esto?"
              className="inline-flex items-center gap-1 rounded-badge border border-border bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-brand-secondary transition-colors hover:border-border-strong hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              <span>NTP-ISO 8559-2</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-muted hover:text-brand-primary hover:bg-surface-subtle transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas: Calculador Rápido y Calculador Preciso */}
        <div className="bg-surface-card px-5 pb-1 pt-3">
          <div role="tablist" aria-label="Tipo de calculador" className="grid grid-cols-2 gap-1 rounded-card bg-surface-subtle p-1">
            {[{ key: "quick", title: "Rápido", sub: "Por estatura y peso" }, { key: "precise", title: "Preciso", sub: "Por contornos en cm" }].map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}
                className={"rounded-button px-3 py-1.5 text-left transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong " + (activeTab === tab.key ? "bg-surface-card shadow-subtle" : "hover:bg-surface-card/60")}>
                <span className={"block text-sm font-semibold " + (activeTab === tab.key ? "text-brand-primary" : "text-brand-secondary")}>{tab.title}</span>
                <span className="block text-xs text-brand-secondary">{tab.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {showMethod && (
            <section id="size-method-panel" className="space-y-3 rounded-card border border-border bg-surface-subtle p-4 text-xs text-brand-secondary">
              <h3 className="text-sm font-semibold text-brand-primary">Cómo calculamos tu talla</h3>
              <p>ERXIDI compara tus medidas corporales con rangos de talla, siguiendo el principio de la NTP-ISO 8559-2:2020: la talla se designa por las medidas del cuerpo y no por las de la prenda.</p>
              <p>Los límites numéricos de la tabla son valores de referencia definidos por ERXIDI. No provienen de la norma y pueden variar según el proveedor y el lote. La norma ISO 8559-1 define cómo medir el cuerpo; las indicaciones de este calculador son simplificadas.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 font-semibold text-brand-primary">Ropa inferior</p>
                  <ul className="space-y-0.5 font-mono">
                    {BOTTOM_LIMITS.map((l) => (<li key={l.size}>{l.size}: cintura hasta {l.waist}, cadera hasta {l.hip} cm</li>))}
                    <li>XL: por encima de L</li>
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-brand-primary">Prendas superiores</p>
                  <ul className="space-y-0.5 font-mono">
                    {TOP_LIMITS.map((l) => (<li key={l.size}>{l.size}: busto hasta {l.bust} cm</li>))}
                    <li>XL: por encima de L</li>
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-brand-primary">Calcetería</p>
                  <ul className="space-y-0.5 font-mono">
                    {SOCK_LIMITS.map((l) => (<li key={l.size}>{l.size}: pie {l.inclusive ? "hasta" : "menos de"} {l.foot} cm</li>))}
                    <li>XL: por encima de L</li>
                  </ul>
                </div>
              </div>
              <p>Se elige la menor talla cuyos límites cumplan todas tus medidas.</p>
              <p>Si ingresas solo una medida, estimamos la otra (cadera = cintura + {HIP_FROM_WAIST_OFFSET_CM} cm; cintura = cadera − {HIP_FROM_WAIST_OFFSET_CM} cm; busto = bajo busto + {BUST_FROM_UNDERBUST_OFFSET_CM} cm) y lo indicamos como "Estimado".</p>
              <p>El modo Rápido usa tu IMC (relación entre peso y estatura al cuadrado) y tu preferencia de calce. Es una orientación, no una comparación por rangos.</p>
            </section>
          )}

          {activeTab === "quick" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RangeMeasureInput
                  id="quick-height"
                  label="Estatura"
                  value={height}
                  onChange={setHeight}
                  min={120}
                  max={220}
                  step={1}
                  unit="cm"
                />

                <RangeMeasureInput
                  id="quick-weight"
                  label="Peso Corporal"
                  value={weight}
                  onChange={setWeight}
                  min={30}
                  max={160}
                  step={1}
                  unit="kg"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-brand-primary block">
                  Preferencia de calce
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {FIT_OPTIONS.map((opt) => {
                    const isSelected = fit === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFit(opt.id)}
                        className={
                          "p-2.5 rounded-card border text-left transition-all " +
                          (isSelected
                            ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                            : "border-border bg-surface-card hover:border-border-strong")
                        }
                      >
                        <span className="block text-xs font-bold text-brand-primary">
                          {opt.id}
                        </span>
                        <span className="block text-xs text-brand-secondary">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "precise" && (
            <div className="space-y-4">
              {/* Categoría: Ropa Interior Inferior */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-primary">
                    Ropa interior inferior (bóxers, trusas y calzones)
                  </span>
                  {preciseResult.bottomSize && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="success" className="text-xs font-mono">
                        Talla {preciseResult.bottomSize}
                      </Badge>
                      {preciseResult.estimatedBottom && (
                        <Badge variant="warning" className="text-xs">
                          Estimado
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <RangeMeasureInput
                    id="precise-waist"
                    label="Contorno de Cintura"
                    hint="A la altura del ombligo"
                    value={waist}
                    onChange={setWaist}
                    min={45}
                    max={120}
                    step={1}
                  />
                  <RangeMeasureInput
                    id="precise-hip"
                    label="Contorno de Cadera"
                    hint="Parte más prominente"
                    value={hip}
                    onChange={setHip}
                    min={50}
                    max={130}
                    step={1}
                  />
                </div>
              </div>

              {/* Categoría: Prendas Superiores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-primary">
                    Prendas superiores (tops, brasieres y camisetas)
                  </span>
                  {preciseResult.topSize && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="success" className="text-xs font-mono">
                        Talla {preciseResult.topSize}
                      </Badge>
                      {preciseResult.estimatedTop && (
                        <Badge variant="warning" className="text-xs">
                          Estimado
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <RangeMeasureInput
                    id="precise-underbust"
                    label="Bajo Busto / Tórax"
                    hint="Base inferior del pecho"
                    value={underbust}
                    onChange={setUnderbust}
                    min={55}
                    max={110}
                    step={1}
                  />
                  <RangeMeasureInput
                    id="precise-bust"
                    label="Contorno de Pecho"
                    hint="Zona de mayor volumen"
                    value={bust}
                    onChange={setBust}
                    min={60}
                    max={125}
                    step={1}
                  />
                </div>
              </div>

              {/* Categoría: Calcetería */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-primary">
                    Calcetería (medias)
                  </span>
                  {preciseResult.sockSize && (
                    <Badge variant="success" className="text-xs font-mono">
                      Talla {preciseResult.sockSize} ({preciseResult.shoeSizeRange})
                    </Badge>
                  )}
                </div>
                <RangeMeasureInput
                  id="precise-foot"
                  label="Longitud del Pie"
                  hint="Del talón a la punta en cm"
                  value={footLength}
                  onChange={setFootLength}
                  min={14.0}
                  max={31.0}
                  step={1}
                />
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-brand-secondary">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning-text" aria-hidden="true" />
            <span>Prendas íntimas: sin cambios ni devoluciones una vez abierto el empaque.</span>
          </p>
        </div>

        {/* Resultado fijo */}
        <div className="border-t border-border bg-surface-card px-5 py-3">
          {activeTab === "quick" && (
            <div className="p-4 rounded-card bg-brand-primary text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {quickResult.imc ? (
                    <Badge variant="neutral" className="text-xs">
                      IMC: {quickResult.imc}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-xs">
                      Sin selección
                    </Badge>
                  )}
                  <Badge variant="neutral" className="text-xs">
                    Estimación orientativa
                  </Badge>
                </div>
                <h3 className="text-sm font-bold pt-0.5">
                  Tu Talla Recomendada ERXIDI
                </h3>
                <p className="text-xs text-brand-muted">
                  {hasQuickValues
                    ? "Calibrada para " +
                    quickResult.safeHeight +
                    " cm, " +
                    quickResult.safeWeight +
                    " kg y calce " +
                    fit.toLowerCase() +
                    "."
                    : "Desliza o escribe tu estatura y peso para calcular."}
                </p>
              </div>
              <div className="w-14 h-14 rounded-card bg-surface-card text-brand-primary font-mono text-2xl font-black flex items-center justify-center shrink-0">
                {quickResult.size || "—"}
              </div>
            </div>
          )}

          {activeTab === "precise" && (
            <div className="p-4 rounded-card bg-brand-primary text-white space-y-2.5">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 bg-white/10 rounded-card border border-white/10">
                  <span className="text-xs font-bold text-brand-muted block">
                    Inferior
                  </span>
                  <span className="font-mono text-xl font-black text-white block my-0.5">
                    {preciseResult.bottomSize || "—"}
                  </span>
                  <span className="text-xs text-brand-muted block">
                    Bóxers / Trusas
                  </span>
                </div>

                <div className="p-2.5 bg-white/10 rounded-card border border-white/10">
                  <span className="text-xs font-bold text-brand-muted block">
                    Superior
                  </span>
                  <span className="font-mono text-xl font-black text-white block my-0.5">
                    {preciseResult.topSize || "—"}
                  </span>
                  <span className="text-xs text-brand-muted block">
                    Tops / Polos
                  </span>
                </div>

                <div className="p-2.5 bg-white/10 rounded-card border border-white/10">
                  <span className="text-xs font-bold text-brand-muted block">
                    Calcetería
                  </span>
                  <span className="font-mono text-xl font-black text-white block my-0.5">
                    {preciseResult.sockSize || "—"}
                  </span>
                  <span className="text-xs text-brand-muted block">
                    Calzado {preciseResult.shoeSizeRange}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {saveError && (
          <p
            role="alert"
            className="px-5 pt-3 text-xs font-medium text-status-danger-text"
          >
            {saveError}
          </p>
        )}

        <p role="status" aria-live="polite"
          className={"px-5 text-xs text-brand-secondary transition-all duration-300 ease-out motion-reduce:transition-none " +
            (clearHintVisible ? "max-h-12 py-2 opacity-100" : "max-h-0 overflow-hidden py-0 opacity-0")}>
          Medidas borradas de esta vista. Pulsa «Guardar cambios» para quitarlas también de {user ? "tu perfil" : "este dispositivo"}.
        </p>

        {/* Footer Compacto en Una Sola Fila */}
        <div className="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between gap-2">
          <button type="button" onClick={handleResetCurrentView} disabled={isSaving || !hasValuesInView}
            title="Vacía los campos de esta vista. No guarda nada hasta que pulses el botón naranja."
            className={"inline-flex shrink-0 items-center gap-1.5 rounded-button border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong " +
              (hasValuesInView
                ? "border-status-danger-border bg-status-danger-bg text-status-danger-text hover:border-status-danger-text"
                : "cursor-not-allowed border-transparent bg-transparent text-brand-muted opacity-60")}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Borrar medidas</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={canClearSave ? handleSaveClear : handleApply}
              isLoading={isSaving}
              disabled={isSaving || !canSave}
              className="bg-accent hover:bg-accent-hover text-white"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {canClearSave
                ? "Guardar cambios"
                : (applicableSelectedSize
                  ? "Aplicar Talla " + applicableSelectedSize
                  : "Guardar")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}