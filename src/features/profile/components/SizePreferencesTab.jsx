import React, { useState, useEffect, useMemo } from "react";
import {
  Ruler,
  CheckCircle,
  AlertCircle,
  Save,
  RotateCcw,
  Info,
} from "lucide-react";
import Button from "../../../components/ui/Button";
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
import { calcularCalzado } from "../../catalog/services/sizeMatcherService";

const STORAGE_KEY = "erxidi_size_preferences";
const LEGACY_STORAGE_KEY = "erxidi_user_profile_measurements";

const FIT_OPTIONS = [
  { id: "ajustado", label: "Ajustado", desc: "Ceñido" },
  { id: "regular", label: "Regular", desc: "Estándar" },
  { id: "holgado", label: "Holgado", desc: "Suelto" },
];

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

function ProfileRangeInput({
  id,
  label,
  guideText,
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

  const isSelected = isWithinRange(value, min, max);
  const numericValid = isSelected ? Number(Number(value).toFixed(1)) : null;

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
          {guideText && (
            <span className="block text-[10px] text-brand-muted truncate">
              {guideText}
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

      <div className="flex items-center border border-border rounded-button bg-white overflow-hidden h-8 w-full focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isSelected && numericValid <= min}
          className="w-8 h-full flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-slate-100 disabled:opacity-30 font-bold border-r border-border shrink-0 select-none"
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
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SizePreferencesTab() {
  const { user, profile, refreshProfile } = useAuth();

  const initialData = useMemo(() => {
    const bm = profile?.body_measurements || {};
    return {
      height: isWithinRange(profile?.height_cm, 120, 220)
        ? Number(profile.height_cm)
        : null,
      weight: isWithinRange(profile?.weight_kg, 30, 160)
        ? Number(profile.weight_kg)
        : null,
      fitPreference: profile?.fit_preference || "regular",
      waist: isWithinRange(bm.waist, 45, 120) ? Number(bm.waist) : null,
      hip: isWithinRange(bm.hip, 50, 130) ? Number(bm.hip) : null,
      bust: isWithinRange(bm.bust, 60, 125) ? Number(bm.bust) : null,
      underBust: isWithinRange(bm.under_bust ?? bm.underbust, 55, 110)
        ? Number(bm.under_bust ?? bm.underbust)
        : null,
      footLength: isWithinRange(bm.foot_length ?? bm.footLength, 14, 31)
        ? Number(bm.foot_length ?? bm.footLength)
        : null,
    };
  }, [profile]);

  const [height, setHeight] = useState(initialData.height);
  const [weight, setWeight] = useState(initialData.weight);
  const [fitPreference, setFitPreference] = useState(initialData.fitPreference);
  const [waist, setWaist] = useState(initialData.waist);
  const [hip, setHip] = useState(initialData.hip);
  const [bust, setBust] = useState(initialData.bust);
  const [underBust, setUnderBust] = useState(initialData.underBust);
  const [footLength, setFootLength] = useState(initialData.footLength);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setHeight(initialData.height);
    setWeight(initialData.weight);
    setFitPreference(initialData.fitPreference);
    setWaist(initialData.waist);
    setHip(initialData.hip);
    setBust(initialData.bust);
    setUnderBust(initialData.underBust);
    setFootLength(initialData.footLength);
  }, [initialData]);

  const isDirty = useMemo(() => {
    return (
      height !== initialData.height ||
      weight !== initialData.weight ||
      fitPreference !== initialData.fitPreference ||
      waist !== initialData.waist ||
      hip !== initialData.hip ||
      bust !== initialData.bust ||
      underBust !== initialData.underBust ||
      footLength !== initialData.footLength
    );
  }, [
    height,
    weight,
    fitPreference,
    waist,
    hip,
    bust,
    underBust,
    footLength,
    initialData,
  ]);

  const estimatedSizes = useMemo(() => {
    let quickGeneral = null;
    if (isWithinRange(height, 120, 220) && isWithinRange(weight, 30, 160)) {
      const hm = Number(height) / 100;
      const imc = Number(weight) / (hm * hm);
      const list = ["S", "M", "L", "XL"];
      let idx = imc < 20 ? 0 : imc < 25 ? 1 : imc < 30 ? 2 : 3;
      if (fitPreference === "ajustado" && idx > 0) idx -= 1;
      if (fitPreference === "holgado" && idx < 3) idx += 1;
      quickGeneral = list[idx];
    }

    let bottom = null;
    const validW = isWithinRange(waist, 45, 120) ? Number(waist) : null;
    const validH = isWithinRange(hip, 50, 130) ? Number(hip) : null;
    if (validW != null || validH != null) {
      const w = validW != null ? validW : validH - 16;
      const h = validH != null ? validH : validW + 16;
      if (w <= 76 && h <= 95) bottom = "S";
      else if (w <= 84 && h <= 101) bottom = "M";
      else if (w <= 92 && h <= 108) bottom = "L";
      else bottom = "XL";
    }

    let top = null;
    const validB = isWithinRange(bust, 60, 125) ? Number(bust) : null;
    const validUB = isWithinRange(underBust, 55, 110)
      ? Number(underBust)
      : null;
    if (validB != null || validUB != null) {
      const b = validB != null ? validB : validUB + 15;
      if (b <= 86) top = "S";
      else if (b <= 92) top = "M";
      else if (b <= 98) top = "L";
      else top = "XL";
    }

    let sock = null;
    let shoeRange = "—";
    if (isWithinRange(footLength, 14, 31)) {
      const f = Number(footLength);
      shoeRange = calcularCalzado(f);
      if (f < 24.5) sock = "S (" + shoeRange + ")";
      else if (f <= 26.5) sock = "M (" + shoeRange + ")";
      else if (f <= 29.5) sock = "L (" + shoeRange + ")";
      else sock = "XL (" + shoeRange + ")";
    }

    return {
      quickGeneral,
      bottom: bottom || quickGeneral,
      top: top || quickGeneral,
      sock,
      shoeRange,
    };
  }, [height, weight, fitPreference, waist, hip, bust, underBust, footLength]);

  const handleClearProfileMeasurements = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (user) {
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
        await refreshProfile();
      }

      setHeight(null);
      setWeight(null);
      setFitPreference("regular");
      setWaist(null);
      setHip(null);
      setBust(null);
      setUnderBust(null);
      setFootLength(null);

      setFeedback({
        type: "success",
        message: "Medidas restablecidas en blanco.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "No se pudieron limpiar las medidas.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    setFeedback(null);

    const payload = {
      height_cm: isWithinRange(height, 120, 220) ? Number(height) : null,
      weight_kg: isWithinRange(weight, 30, 160) ? Number(weight) : null,
      fit_preference: fitPreference,
      body_measurements: {
        waist: isWithinRange(waist, 45, 120) ? Number(waist) : null,
        hip: isWithinRange(hip, 50, 130) ? Number(hip) : null,
        bust: isWithinRange(bust, 60, 125) ? Number(bust) : null,
        under_bust: isWithinRange(underBust, 55, 110)
          ? Number(underBust)
          : null,
        foot_length: isWithinRange(footLength, 14, 31)
          ? Number(footLength)
          : null,
      },
      updated_at: new Date().toISOString(),
    };

    try {
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", user.id);

        if (error) throw error;
        await refreshProfile();
      }

      const localData = {
        height: payload.height_cm,
        weight: payload.weight_kg,
        fit: fitPreference,
        waist: payload.body_measurements.waist,
        hip: payload.body_measurements.hip,
        bust: payload.body_measurements.bust,
        under_bust: payload.body_measurements.under_bust,
        underbust: payload.body_measurements.under_bust,
        foot_length: payload.body_measurements.foot_length,
        footLength: payload.body_measurements.foot_length,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(localData));

      setFeedback({
        type: "success",
        message: "Tus medidas fueron guardadas.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Error al guardar tus medidas.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {feedback && (
        <div
          className={
            "p-3.5 rounded-card border text-xs flex items-center gap-2 " +
            (feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-status-danger-border text-status-danger-text")
          }
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-accent" />
                  Medidas y Preferencia de Talla
                </CardTitle>
                <button
                  type="button"
                  onClick={handleClearProfileMeasurements}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-button text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>
              <CardDescription>
                Desliza o escribe tus medidas para activar las sugerencias de
                talla en el catálogo.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                {/* Calculador Rápido */}
                <div className="p-4 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    Calculador Rápido (Estatura y Peso)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ProfileRangeInput
                      id="profile-height"
                      label="Estatura"
                      value={height}
                      onChange={setHeight}
                      min={120}
                      max={220}
                      step={0.5}
                      unit="cm"
                    />
                    <ProfileRangeInput
                      id="profile-weight"
                      label="Peso Corporal"
                      value={weight}
                      onChange={setWeight}
                      min={30}
                      max={160}
                      step={0.5}
                      unit="kg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-primary mb-1.5">
                      Preferencia de calce
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {FIT_OPTIONS.map((opt) => {
                        const isSelected = fitPreference === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFitPreference(opt.id)}
                            className={
                              "p-2.5 rounded-card border text-left transition-all " +
                              (isSelected
                                ? "border-brand-primary bg-white ring-1 ring-brand-primary"
                                : "border-border bg-white/70 hover:bg-white")
                            }
                          >
                            <span className="text-xs font-bold text-brand-primary block">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-brand-secondary block">
                              {opt.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Ropa Interior Inferior */}
                <div className="p-4 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    Ropa Interior Inferior (Bóxers, Trusas y Calzones)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ProfileRangeInput
                      id="profile-waist"
                      label="Contorno de Cintura"
                      guideText="A la altura del ombligo"
                      value={waist}
                      onChange={setWaist}
                      min={45}
                      max={120}
                      step={0.5}
                    />
                    <ProfileRangeInput
                      id="profile-hip"
                      label="Contorno de Cadera"
                      guideText="Parte más prominente"
                      value={hip}
                      onChange={setHip}
                      min={50}
                      max={130}
                      step={0.5}
                    />
                  </div>
                </div>

                {/* Prendas Superiores */}
                <div className="p-4 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    Prendas Superiores (Brasiers, Tops y Camisetas)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ProfileRangeInput
                      id="profile-underbust"
                      label="Bajo Busto / Tórax"
                      guideText="Base inferior del pecho"
                      value={underBust}
                      onChange={setUnderBust}
                      min={55}
                      max={110}
                      step={0.5}
                    />
                    <ProfileRangeInput
                      id="profile-bust"
                      label="Contorno de Pecho"
                      guideText="Zona de mayor volumen"
                      value={bust}
                      onChange={setBust}
                      min={60}
                      max={125}
                      step={0.5}
                    />
                  </div>
                </div>

                {/* Calcetería */}
                <div className="p-4 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    Calcetería (Medias)
                  </span>
                  <ProfileRangeInput
                    id="profile-foot"
                    label="Longitud del Pie"
                    guideText="Del talón a la punta en cm"
                    value={footLength}
                    onChange={setFootLength}
                    min={14.0}
                    max={31.0}
                    step={0.5}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isDirty || isSaving}
                    isLoading={isSaving}
                    className="bg-accent hover:bg-accent-hover text-white px-6"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Medidas
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Tarjeta Azul de Recomendación */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 text-white rounded-card p-5 space-y-4 sticky top-24 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold">Tu Talla Recomendada ERXIDI</h3>
              <Badge variant="success" className="text-[10px]">
                NTP-ISO 8559
              </Badge>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-card bg-slate-800 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold block">
                    Ropa Interior Inferior
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Bóxers, Trusas y Calzones
                  </span>
                </div>
                <span className="font-mono text-2xl font-black text-white">
                  {estimatedSizes.bottom || "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-card bg-slate-800 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold block">
                    Prendas Superiores
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Brasiers, Tops y Polos
                  </span>
                </div>
                <span className="font-mono text-2xl font-black text-white">
                  {estimatedSizes.top || "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-card bg-slate-800 border border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold block">Calcetería</span>
                  <span className="text-[11px] text-slate-400">
                    Medias de algodón
                  </span>
                </div>
                <span className="font-mono text-sm font-black text-white">
                  {estimatedSizes.sock || "—"}
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-slate-800/70 border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2 leading-relaxed">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Usa «Limpiar» si prefieres dejar las medidas en blanco y elegir
                tus tallas manualmente en la tienda.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}