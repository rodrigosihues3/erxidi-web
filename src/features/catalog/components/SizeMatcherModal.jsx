import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Zap,
  Ruler,
  Save,
  RotateCcw,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import { calculateShoeSize } from "../services/sizeMatcherService";

const STORAGE_KEY = "erxidi_size_preferences";
const LEGACY_STORAGE_KEY = "erxidi_user_profile_measurements";
const SIZES = ["S", "M", "L", "XL"];
const FIT_OPTIONS = [
  { id: "Ajustado", desc: "Ceñido" },
  { id: "Regular", desc: "Estándar" },
  { id: "Holgado", desc: "Suelto" },
];

const mapFitToLabel = (fit) => {
  const map = { ajustado: "Ajustado", regular: "Regular", holgado: "Holgado" };
  return map[fit?.toLowerCase()] || "Regular";
};

const mapLabelToFit = (label) => {
  const map = { Ajustado: "ajustado", Regular: "regular", Holgado: "holgado" };
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
  step = 0.5,
  unit = "cm",
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  const isSelected = value != null && value !== "" && !isNaN(Number(value));
  const numericValid = isSelected ? clampNumber(value, min, max) : null;

  const handleSliderChange = (e) => {
    const next = clampNumber(e.target.value, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const handleDecrement = () => {
    const base = numericValid != null ? numericValid : min;
    const next = clampNumber(base - step, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const handleIncrement = () => {
    const base = numericValid != null ? numericValid : min;
    const next = clampNumber(base + step, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const handleTextChange = (e) => {
    const raw = e.target.value.replace(",", ".");
    if (raw === "") {
      setDraft("");
      onChange(null);
      return;
    }
    if (!/^\d*\.?\d*$/.test(raw)) return;
    setDraft(raw);

    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(Number(parsed.toFixed(1)));
    }
  };

  const handleBlur = () => {
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
    <div
      className={
        "p-3 rounded-card border transition-colors space-y-2 " +
        (isSelected
          ? "bg-white border-border"
          : "bg-surface-subtle/60 border-border/80")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block text-xs font-bold text-brand-primary truncate"
          >
            {label}
          </label>
          {hint && (
            <span className="block text-[10px] text-brand-muted truncate">
              {hint}
            </span>
          )}
        </div>
        <span
          className={
            "px-2 py-0.5 rounded font-mono text-xs font-bold shrink-0 border " +
            (isSelected
              ? "bg-brand-primary text-white border-brand-primary"
              : "bg-white border-border text-brand-muted")
          }
        >
          {numericValid != null ? numericValid + " " + unit : "—"}
        </span>
      </div>

      {/* Slider: gris y en el extremo izquierdo si está en blanco; azul activo cuando tiene valor */}
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
              ? "accent-brand-primary bg-slate-200 opacity-100"
              : "accent-slate-400 bg-slate-200 opacity-40 hover:opacity-75")
          }
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

      {/* Stepper con min-w-0 para que el botón [+] jamás se esconda */}
      <div className="flex items-center border border-border rounded-button bg-white overflow-hidden h-8 w-full focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isSelected && numericValid <= min}
          className="w-8 h-full flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-slate-100 disabled:opacity-30 font-bold border-r border-border shrink-0 select-none"
          aria-label={"Disminuir " + label}
        >
          -
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="—"
          className="min-w-0 w-full flex-1 h-full text-center font-mono font-bold text-xs text-brand-primary bg-transparent outline-none px-1 placeholder:text-brand-muted placeholder:font-normal"
        />
        <button
          type="button"
          onClick={handleIncrement}
          disabled={isSelected && numericValid >= max}
          className="w-8 h-full flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-slate-100 disabled:opacity-30 font-bold border-l border-border shrink-0 select-none"
          aria-label={"Aumentar " + label}
        >
          +
        </button>
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
  const [fit, setFit] = useState(saved.fit ?? "Regular");

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
          if (stored.fit) setFit(stored.fit);
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

    let baseIndex = 1;
    if (computedImc < 20) baseIndex = 0;
    else if (computedImc < 25) baseIndex = 1;
    else if (computedImc < 30) baseIndex = 2;
    else baseIndex = 3;

    let finalIndex = baseIndex;
    if (fit === "Ajustado" && finalIndex > 0) finalIndex -= 1;
    else if (fit === "Holgado" && finalIndex < SIZES.length - 1)
      finalIndex += 1;

    return {
      size: SIZES[finalIndex],
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

    let bottom = null;
    if (validWaist != null || validHip != null) {
      const w = validWaist != null ? validWaist : validHip - 16;
      const h = validHip != null ? validHip : validWaist + 16;
      if (w <= 76 && h <= 95) bottom = "S";
      else if (w <= 84 && h <= 101) bottom = "M";
      else if (w <= 92 && h <= 108) bottom = "L";
      else bottom = "XL";
    }

    let top = null;
    if (validBust != null || validUnderbust != null) {
      const b = validBust != null ? validBust : validUnderbust + 15;
      if (b <= 86) top = "S";
      else if (b <= 92) top = "M";
      else if (b <= 98) top = "L";
      else top = "XL";
    }

    let sock = null;
    let shoeSizeRange = "—";
    if (validFoot != null) {
      shoeSizeRange = calculateShoeSize(validFoot);
      if (validFoot < 24.5) sock = "S";
      else if (validFoot <= 26.5) sock = "M";
      else if (validFoot <= 29.5) sock = "L";
      else sock = "XL";
    }

    return {
      bottomSize: bottom,
      topSize: top,
      sockSize: sock,
      shoeSizeRange,
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

  if (!isOpen) return null;

  const handleClearAllMeasurements = async () => {
    setIsSaving(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (user) {
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
        await refreshProfile();
      }

      setHeight(null);
      setWeight(null);
      setWaist(null);
      setHip(null);
      setUnderbust(null);
      setBust(null);
      setFootLength(null);

      onSizeSelected?.(null, null);
      onClose?.();
    } catch (err) {
      console.error("Error al limpiar medidas:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async () => {
    const safeHeight = isWithinRange(height, 120, 220)
      ? clampNumber(height, 120, 220)
      : null;
    const safeWeight = isWithinRange(weight, 30, 160)
      ? clampNumber(weight, 30, 160)
      : null;

    setIsSaving(true);
    try {
      if (activeTab === "quick") {
        if (user) {
          await supabase
            .from("profiles")
            .update({
              height_cm: safeHeight,
              weight_kg: safeWeight,
              fit_preference: mapLabelToFit(fit),
              body_measurements: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
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
          await supabase
            .from("profiles")
            .update({
              height_cm: safeHeight,
              weight_kg: safeWeight,
              fit_preference: mapLabelToFit(fit),
              body_measurements: bodyMeasurementsObj,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
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
    } catch (err) {
      console.error("Error al persistir mediciones:", err);
    } finally {
      setIsSaving(false);
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

  const canSave =
    activeTab === "quick" ? hasQuickValues : hasPreciseValues;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-xl bg-surface-card border border-border rounded-card shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-white border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-accent" />
            <h2 className="text-base font-bold text-brand-primary">
              Calculador de Tallas ERXIDI
            </h2>
            <Badge variant="neutral" className="text-[10px]">
              NTP-ISO 8559
            </Badge>
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
        <div className="px-5 py-2.5 bg-surface-subtle border-b border-border">
          <div className="grid grid-cols-2 gap-2.5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "quick"}
              onClick={() => setActiveTab("quick")}
              className={
                "p-2.5 rounded-card border text-left transition-all flex items-center gap-2.5 " +
                (activeTab === "quick"
                  ? "border-brand-primary bg-white ring-1 ring-brand-primary shadow-2xs"
                  : "border-border bg-white/60 text-brand-secondary hover:bg-white")
              }
            >
              <div className="w-7 h-7 rounded-button bg-surface-subtle border border-border flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Calculador Rápido
                </span>
                <span className="block text-[10px] text-brand-muted truncate">
                  Por estatura y peso
                </span>
              </div>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "precise"}
              onClick={() => setActiveTab("precise")}
              className={
                "p-2.5 rounded-card border text-left transition-all flex items-center gap-2.5 " +
                (activeTab === "precise"
                  ? "border-brand-primary bg-white ring-1 ring-brand-primary shadow-2xs"
                  : "border-border bg-white/60 text-brand-secondary hover:bg-white")
              }
            >
              <div className="w-7 h-7 rounded-button bg-surface-subtle border border-border flex items-center justify-center shrink-0">
                <Ruler className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-brand-primary truncate">
                  Calculador Preciso
                </span>
                <span className="block text-[10px] text-brand-muted truncate">
                  Por contornos en cm
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "quick" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RangeMeasureInput
                  id="quick-height"
                  label="Estatura"
                  value={height}
                  onChange={setHeight}
                  min={120}
                  max={220}
                  step={0.5}
                  unit="cm"
                />

                <RangeMeasureInput
                  id="quick-weight"
                  label="Peso Corporal"
                  value={weight}
                  onChange={setWeight}
                  min={30}
                  max={160}
                  step={0.5}
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
                            : "border-border bg-white hover:border-border-strong")
                        }
                      >
                        <span className="block text-xs font-bold text-brand-primary">
                          {opt.id}
                        </span>
                        <span className="block text-[10px] text-brand-secondary">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tarjeta Azul de Recomendación */}
              <div className="p-4 rounded-card bg-slate-900 text-white flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  {quickResult.imc ? (
                    <Badge variant="success" className="text-[10px]">
                      IMC: {quickResult.imc}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-[10px]">
                      Sin selección
                    </Badge>
                  )}
                  <h3 className="text-sm font-bold pt-0.5">
                    Tu Talla Recomendada ERXIDI
                  </h3>
                  <p className="text-xs text-slate-300">
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
                <div className="w-14 h-14 rounded-card bg-white text-brand-primary font-mono text-2xl font-black flex items-center justify-center shadow-inner shrink-0">
                  {quickResult.size || "—"}
                </div>
              </div>
            </div>
          )}

          {activeTab === "precise" && (
            <div className="space-y-4">
              {/* Categoría: Ropa Interior Inferior */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                    Ropa Interior Inferior (Bóxers, Trusas y Calzones)
                  </span>
                  {preciseResult.bottomSize && (
                    <Badge variant="success" className="text-[10px] font-mono">
                      Talla {preciseResult.bottomSize}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeMeasureInput
                    id="precise-waist"
                    label="Contorno de Cintura"
                    hint="A la altura del ombligo"
                    value={waist}
                    onChange={setWaist}
                    min={45}
                    max={120}
                    step={0.5}
                  />
                  <RangeMeasureInput
                    id="precise-hip"
                    label="Contorno de Cadera"
                    hint="Parte más prominente"
                    value={hip}
                    onChange={setHip}
                    min={50}
                    max={130}
                    step={0.5}
                  />
                </div>
              </div>

              {/* Categoría: Prendas Superiores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                    Prendas Superiores (Tops, Brasiers y Camisetas)
                  </span>
                  {preciseResult.topSize && (
                    <Badge variant="success" className="text-[10px] font-mono">
                      Talla {preciseResult.topSize}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeMeasureInput
                    id="precise-underbust"
                    label="Bajo Busto / Tórax"
                    hint="Base inferior del pecho"
                    value={underbust}
                    onChange={setUnderbust}
                    min={55}
                    max={110}
                    step={0.5}
                  />
                  <RangeMeasureInput
                    id="precise-bust"
                    label="Contorno de Pecho"
                    hint="Zona de mayor volumen"
                    value={bust}
                    onChange={setBust}
                    min={60}
                    max={125}
                    step={0.5}
                  />
                </div>
              </div>

              {/* Categoría: Calcetería */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                    Calcetería (Medias)
                  </span>
                  {preciseResult.sockSize && (
                    <Badge variant="success" className="text-[10px] font-mono">
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
                  step={0.5}
                />
              </div>

              {/* Tarjeta Azul de Resultado Preciso */}
              <div className="p-4 rounded-card bg-slate-900 text-white space-y-2.5 shadow-md">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-slate-800 rounded-card border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">
                      Inferior
                    </span>
                    <span className="font-mono text-xl font-black text-white block my-0.5">
                      {preciseResult.bottomSize || "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Bóxers / Trusas
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-800 rounded-card border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">
                      Superior
                    </span>
                    <span className="font-mono text-xl font-black text-white block my-0.5">
                      {preciseResult.topSize || "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Tops / Polos
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-800 rounded-card border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">
                      Calcetería
                    </span>
                    <span className="font-mono text-xl font-black text-white block my-0.5">
                      {preciseResult.sockSize || "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Calzado {preciseResult.shoeSizeRange}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Garantía de Higiene */}
          <div className="flex items-start gap-2.5 p-3 rounded-card bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <p className="text-xs leading-snug">
              <strong>Garantía de Higiene:</strong> Por protección sanitaria, la
              ropa interior no admite cambios ni devoluciones una vez abierto el
              empaque.
            </p>
          </div>
        </div>

        {/* Footer Compacto en Una Sola Fila */}
        <div className="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClearAllMeasurements}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
            title="Dejar en blanco y desactivar sugerencias automáticas"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
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
              onClick={handleApply}
              isLoading={isSaving}
              disabled={isSaving || !canSave}
              className="bg-accent hover:bg-accent-hover text-white"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {applicableSelectedSize
                ? "Aplicar Talla " + applicableSelectedSize
                : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}