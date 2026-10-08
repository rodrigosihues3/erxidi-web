import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertTriangle, Sparkles, Zap, Ruler, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { calculateShoeSize } from '../services/sizeMatcherService';

const STORAGE_KEY = 'erxidi_size_preferences';
const LEGACY_STORAGE_KEY = 'erxidi_user_profile_measurements';
const SIZES = ['S', 'M', 'L', 'XL'];
const FIT_OPTIONS = ['Ajustado', 'Regular', 'Holgado'];

const mapFitToLabel = (fit) => {
  const map = { ajustado: 'Ajustado', regular: 'Regular', holgado: 'Holgado' };
  return map[fit?.toLowerCase()] || 'Regular';
};

const mapLabelToFit = (label) => {
  const map = { Ajustado: 'ajustado', Regular: 'regular', Holgado: 'holgado' };
  return map[label] || 'regular';
};

function getSavedMeasurements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer de localStorage:', err);
  }
  return null;
}

/**
 * Control accesible y exacto con botones decremento [-], input editable directo y [+]
 */
function NumberStepper({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = "Ingresa tus medidas para calcular",
  unit = "cm",
}) {
  const numValue = value != null && value !== '' && !isNaN(Number(value)) ? Number(value) : null;

  const handleDecrement = () => {
    if (numValue == null) {
      onChange(min);
    } else {
      const next = Math.max(min, Number((numValue - step).toFixed(1)));
      onChange(next);
    }
  };

  const handleIncrement = () => {
    if (numValue == null) {
      onChange(min);
    } else {
      const next = Math.min(max, Number((numValue + step).toFixed(1)));
      onChange(next);
    }
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(null);
      return;
    }
    const val = Number(raw);
    if (!isNaN(val)) {
      onChange(val);
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-brand-secondary">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border rounded-button bg-surface-card overflow-hidden h-9 w-full focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-all">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={numValue != null && numValue <= min}
            className="w-9 h-full flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-bold select-none border-r border-border"
            aria-label={`Disminuir ${label || ''}`}
          >
            -
          </button>
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={numValue != null ? numValue : ''}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="flex-1 h-full text-center font-mono font-bold text-sm text-brand-primary bg-transparent outline-none px-2 placeholder:text-brand-muted placeholder:font-normal placeholder:text-[11px]"
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={numValue != null && numValue >= max}
            className="w-9 h-full flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-bold select-none border-l border-border"
            aria-label={`Aumentar ${label || ''}`}
          >
            +
          </button>
        </div>
        <span className="text-xs font-mono font-semibold text-brand-muted w-6 select-none text-right">
          {unit}
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-brand-muted font-mono px-0.5">
        <span>Mín: {min}</span>
        <span>Máx: {max}</span>
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

  const [activeTab, setActiveTab] = useState(saved.activeTab || 'quick');

  // Quick inputs (altura, peso, fit)
  const [height, setHeight] = useState(saved.height ?? 175);
  const [weight, setWeight] = useState(saved.weight ?? 70);
  const [fit, setFit] = useState(saved.fit ?? 'Regular');

  // Precise anatomical inputs (arrancan en null si no hay datos guardados previamente)
  const [waist, setWaist] = useState(saved.waist ?? null);
  const [hip, setHip] = useState(saved.hip ?? null);
  const [underbust, setUnderbust] = useState(saved.under_bust ?? saved.underbust ?? null);
  const [bust, setBust] = useState(saved.bust ?? null);
  const [footLength, setFootLength] = useState(saved.foot_length ?? saved.footLength ?? null);

  const [isSaving, setIsSaving] = useState(false);

  // Sync state con profile de Supabase o localStorage al abrir
  useEffect(() => {
    if (isOpen) {
      if (user && profile) {
        if (profile.height_cm) setHeight(profile.height_cm);
        if (profile.weight_kg) setWeight(profile.weight_kg);
        if (profile.fit_preference) setFit(mapFitToLabel(profile.fit_preference));

        const bodyM = profile.body_measurements || {};
        setWaist(bodyM.waist != null ? bodyM.waist : null);
        setHip(bodyM.hip != null ? bodyM.hip : null);
        setUnderbust(bodyM.under_bust != null ? bodyM.under_bust : bodyM.underbust != null ? bodyM.underbust : null);
        setBust(bodyM.bust != null ? bodyM.bust : null);
        setFootLength(bodyM.foot_length != null ? bodyM.foot_length : bodyM.footLength != null ? bodyM.footLength : null);
      } else {
        const stored = getSavedMeasurements();
        if (stored) {
          if (stored.height) setHeight(stored.height);
          if (stored.weight) setWeight(stored.weight);
          if (stored.fit) setFit(stored.fit);
          setWaist(stored.waist != null ? stored.waist : null);
          setHip(stored.hip != null ? stored.hip : null);
          setUnderbust(stored.under_bust != null ? stored.under_bust : stored.underbust != null ? stored.underbust : null);
          setBust(stored.bust != null ? stored.bust : null);
          setFootLength(stored.foot_length != null ? stored.foot_length : stored.footLength != null ? stored.footLength : null);
          if (stored.activeTab) setActiveTab(stored.activeTab);
        } else {
          setWaist(null);
          setHip(null);
          setUnderbust(null);
          setBust(null);
          setFootLength(null);
        }
      }
    }
  }, [isOpen, user, profile]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Quick Mode BMI & Size calculation
  const quickResult = useMemo(() => {
    const heightInMeters = (Number(height) || 175) / 100;
    const computedImc = (Number(weight) || 70) / (heightInMeters * heightInMeters);

    let baseIndex = 1; // Default 'M'
    if (computedImc < 20) {
      baseIndex = 0; // 'S'
    } else if (computedImc < 25) {
      baseIndex = 1; // 'M'
    } else if (computedImc < 30) {
      baseIndex = 2; // 'L'
    } else {
      baseIndex = 3; // 'XL'
    }

    let finalIndex = baseIndex;
    if (fit === 'Ajustado' && finalIndex > 0) {
      finalIndex -= 1;
    } else if (fit === 'Holgado' && finalIndex < SIZES.length - 1) {
      finalIndex += 1;
    }

    return {
      size: SIZES[finalIndex],
      baseSize: SIZES[baseIndex],
      imc: computedImc,
      explanation: 'Recomendación equilibrada para tu complexión física.',
    };
  }, [height, weight, fit]);

  // 2. Precise Mode calculations by garment family
  const preciseResult = useMemo(() => {
    // 1. PRENDAS BAJAS (Bóxers / Calzones / Trusas)
    let bottom = null;
    if (waist != null || hip != null) {
      const w = waist != null ? Number(waist) : (Number(hip) - 16);
      const h = hip != null ? Number(hip) : (Number(waist) + 16);
      if (w <= 76 && h <= 95) bottom = 'S';
      else if (w <= 84 && h <= 101) bottom = 'M';
      else if (w <= 92 && h <= 108) bottom = 'L';
      else bottom = 'XL';
    }

    // 2. PRENDAS ALTAS (Polos / Tops / Brasiers)
    let top = null;
    if (bust != null || underbust != null) {
      const b = bust != null ? Number(bust) : (Number(underbust) + 15);
      if (b <= 86) top = 'S';
      else if (b <= 92) top = 'M';
      else if (b <= 98) top = 'L';
      else top = 'XL';
    }

    // 3. CALCETERÍA (Medias)
    let sock = null;
    let shoeSizeRange = '—';
    if (footLength != null) {
      const f = Number(footLength);
      shoeSizeRange = calculateShoeSize(f);
      if (f < 24.5) sock = 'S';
      else if (f <= 26.5) sock = 'M';
      else if (f <= 29.5) sock = 'L';
      else sock = 'XL';
    }

    return {
      bottomSize: bottom,
      topSize: top,
      sockSize: sock,
      shoeSizeRange,
    };
  }, [waist, hip, bust, underbust, footLength]);

  const hasPreciseValues = waist != null || hip != null || bust != null || underbust != null || footLength != null;

  // Talla aplicable para el callback (según la pestaña activa y la familia de la prenda)
  const applicableSelectedSize = useMemo(() => {
    if (activeTab === 'quick') return quickResult.size;
    if (garmentFamily === 'tops' && preciseResult.topSize) return preciseResult.topSize;
    if (garmentFamily === 'socks' && preciseResult.sockSize) return preciseResult.sockSize;
    if (garmentFamily === 'bottoms' && preciseResult.bottomSize) return preciseResult.bottomSize;
    return quickResult.size;
  }, [activeTab, garmentFamily, quickResult.size, preciseResult]);

  if (!isOpen) return null;

  const handleApply = async () => {
    const generalSize = quickResult.size;
    setIsSaving(true);

    try {
      if (activeTab === 'quick') {
        // En calculador rápido: guarda la base y resetea medidas complejas
        if (user) {
          await supabase
            .from('profiles')
            .update({
              height_cm: Number(height),
              weight_kg: Number(weight),
              fit_preference: mapLabelToFit(fit),
              body_measurements: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          await refreshProfile();
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              height: Number(height),
              weight: Number(weight),
              fit,
              waist: null,
              hip: null,
              under_bust: null,
              bust: null,
              foot_length: null,
              activeTab: 'quick',
              updatedAt: new Date().toISOString(),
            })
          );
        }
      } else {
        // En calculador preciso: guarda la base más el objeto body_measurements
        const bodyMeasurementsObj = {
          waist: waist != null ? Number(waist) : null,
          hip: hip != null ? Number(hip) : null,
          under_bust: underbust != null ? Number(underbust) : null,
          bust: bust != null ? Number(bust) : null,
          foot_length: footLength != null ? Number(footLength) : null,
        };

        if (user) {
          await supabase
            .from('profiles')
            .update({
              height_cm: Number(height),
              weight_kg: Number(weight),
              fit_preference: mapLabelToFit(fit),
              body_measurements: bodyMeasurementsObj,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          await refreshProfile();
        } else {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              height: Number(height),
              weight: Number(weight),
              fit,
              ...bodyMeasurementsObj,
              footLength: bodyMeasurementsObj.foot_length,
              activeTab: 'precise',
              updatedAt: new Date().toISOString(),
            })
          );
        }
      }
    } catch (err) {
      console.error('Error al persistir mediciones:', err);
    } finally {
      setIsSaving(false);
      onSizeSelected?.(applicableSelectedSize, {
        height,
        weight,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-matcher-title"
    >
      {/* Backdrop click dismiss */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg bg-surface-card border border-border rounded-card shadow-dropdown p-6 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2
              id="size-matcher-title"
              className="text-base font-bold text-brand-primary"
            >
              Encuentra tu Talla Ideal
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors focus:outline-none"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Tab Switcher */}
        <div className="grid grid-cols-2 gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'quick'}
            onClick={() => setActiveTab('quick')}
            className={`h-10 px-3 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none border ${
              activeTab === 'quick'
                ? 'border-brand-primary bg-surface-subtle text-brand-primary font-bold ring-1 ring-brand-primary shadow-subtle'
                : 'border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span>Calculador Rápido</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'precise'}
            onClick={() => setActiveTab('precise')}
            className={`h-10 px-3 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none border ${
              activeTab === 'precise'
                ? 'border-brand-primary bg-surface-subtle text-brand-primary font-bold ring-1 ring-brand-primary shadow-subtle'
                : 'border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary'
            }`}
          >
            <Ruler className="w-3.5 h-3.5 text-accent" />
            <span>Calculador Preciso</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* PESTAÑA 1: CALCULADOR RÁPIDO (VISTA MINIMALISTA) */}
        {/* ========================================================= */}
        {activeTab === 'quick' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Estatura */}
            <NumberStepper
              id="quick-height"
              label="Estatura"
              value={height}
              onChange={(val) => setHeight(val ?? 175)}
              min={120}
              max={220}
              step={1}
              unit="cm"
            />

            {/* Peso */}
            <NumberStepper
              id="quick-weight"
              label="Peso"
              value={weight}
              onChange={(val) => setWeight(val ?? 70)}
              min={30}
              max={160}
              step={1}
              unit="kg"
            />

            {/* Preferencia de Ajuste (Fit) */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-brand-secondary block">
                Preferencia de ajuste (Calce)
              </span>
              <div
                className="grid grid-cols-3 gap-2"
                role="radiogroup"
                aria-label="Preferencia de ajuste"
              >
                {FIT_OPTIONS.map((option) => {
                  const isSelected = fit === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setFit(option)}
                      className={`h-9 px-2 text-xs font-semibold rounded-button border transition-colors focus:outline-none ${
                        isSelected
                          ? 'border-brand-primary bg-surface-subtle text-brand-primary font-bold ring-1 ring-brand-primary'
                          : 'border-border bg-surface-card text-brand-secondary hover:border-border-strong hover:text-brand-primary'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resultado Inferior Rápido: Exclusivamente UNA tarjeta central */}
            <div className="p-4 bg-surface-subtle border border-border rounded-card text-center space-y-1.5 shadow-subtle">
              <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider block">
                TALLA SUGERIDA
              </span>
              <div className="font-mono text-3xl font-extrabold text-brand-primary">
                {quickResult.size}
              </div>
              <p className="text-xs text-brand-secondary leading-relaxed">
                Recomendación equilibrada para tu complexión física.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PESTAÑA 2: CALCULADOR PRECISO (VISTA ESTRUCTURADA Y COMPLETA) */}
        {/* ========================================================= */}
        {activeTab === 'precise' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Contexto base heredado */}
            <div className="flex items-center justify-between px-3 py-2 bg-surface-subtle rounded-button border border-border text-xs text-brand-secondary">
              <span>Contexto corporal: <strong className="text-brand-primary font-mono">{height} cm</strong> &bull; <strong className="text-brand-primary font-mono">{weight} kg</strong></span>
              <Badge variant="neutral" className="text-[10px]">{fit}</Badge>
            </div>

            {/* Bloque 1: Cintura y Cadera */}
            <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                1. PRENDAS BAJAS (BÓXERS / CALZONES)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  id="precise-waist"
                  label="Cintura (cm)"
                  value={waist}
                  onChange={setWaist}
                  min={45}
                  max={115}
                  step={1}
                  placeholder="Ingresa tus medidas para calcular"
                />
                <NumberStepper
                  id="precise-hip"
                  label="Cadera (cm)"
                  value={hip}
                  onChange={setHip}
                  min={50}
                  max={125}
                  step={1}
                  placeholder="Ingresa tus medidas para calcular"
                />
              </div>
            </div>

            {/* Bloque 2: Bajo Busto y Busto */}
            <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                2. PRENDAS ALTAS (BRASIERS / TOPS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberStepper
                  id="precise-underbust"
                  label="Bajo Busto (cm)"
                  value={underbust}
                  onChange={setUnderbust}
                  min={55}
                  max={105}
                  step={1}
                  placeholder="Ingresa tus medidas para calcular"
                />
                <NumberStepper
                  id="precise-bust"
                  label="Busto / Pecho (cm)"
                  value={bust}
                  onChange={setBust}
                  min={60}
                  max={120}
                  step={1}
                  placeholder="Ingresa tus medidas para calcular"
                />
              </div>
            </div>

            {/* Bloque 3: Longitud del Pie (Calcetería) */}
            <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                  3. CALCETERÍA (MEDIAS)
                </span>
                <span className="text-[11px] font-semibold text-accent font-mono">
                  Calzado ref: {footLength != null ? preciseResult.shoeSizeRange : '—'}
                </span>
              </div>
              <NumberStepper
                id="precise-foot"
                label="Longitud del pie (cm)"
                value={footLength}
                onChange={setFootLength}
                min={14.0}
                max={31.0}
                step={0.5}
                placeholder="Ingresa tus medidas para calcular"
              />
            </div>

            {/* Resultado Inferior Preciso: Exclusivamente GRID de 3 tarjetas compactas */}
            <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-3 shadow-subtle">
              <div className="text-center">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  TUS TALLAS SUGERIDAS POR FAMILIA DE PRENDA
                </span>
                <p className="text-[11px] text-brand-secondary mt-0.5">
                  Ajuste anatómico específico calculado según tus medidas corporales
                </p>
              </div>

              {!hasPreciseValues ? (
                <div className="p-4 bg-surface-card rounded-card border border-border text-center">
                  <p className="text-xs text-brand-secondary italic">
                    Ingresa tus medidas para calcular
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 text-center">
                  {/* Tarjeta 1 (Prendas Bajas) */}
                  <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                    <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                      PRENDAS BAJAS
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-brand-primary">
                      {preciseResult.bottomSize || '—'}
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      Bóxers / Trusas
                    </span>
                  </div>

                  {/* Tarjeta 2 (Prendas Altas) */}
                  <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                    <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                      PRENDAS ALTAS
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-brand-primary">
                      {preciseResult.topSize || '—'}
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      Polos / Tops
                    </span>
                  </div>

                  {/* Tarjeta 3 (Calcetería) */}
                  <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                    <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                      CALCETERÍA
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-brand-primary">
                      {preciseResult.sockSize || '—'}
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      Calzado {preciseResult.shoeSizeRange}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mandatory Hygiene Warning */}
        <div className="flex items-start gap-2.5 p-3 rounded-card bg-status-warning-bg border border-status-warning-border text-status-warning-text">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-snug">
            Por motivos de higiene y protección sanitaria, la ropa interior no cuenta con cambios ni devoluciones.
          </p>
        </div>

        {/* Actions / Footer */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleApply}
            isLoading={isSaving}
            disabled={isSaving}
            className="bg-accent hover:bg-accent-hover text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar perfil y aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
