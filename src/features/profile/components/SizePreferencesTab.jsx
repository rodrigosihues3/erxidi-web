import React, { useState, useEffect, useMemo } from 'react';
import { Ruler, CheckCircle, AlertCircle, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { calcularCalzado } from '../../catalog/services/sizeMatcherService';

const STORAGE_KEY = 'erxidi_size_preferences';
const LEGACY_STORAGE_KEY = 'erxidi_user_profile_measurements';

const FIT_OPTIONS = [
  { id: 'ajustado', label: 'Ajustado', desc: 'Ceñido al cuerpo' },
  { id: 'regular', label: 'Regular', desc: 'Calce estándar ergonómico' },
  { id: 'holgado', label: 'Holgado', desc: 'Mayor confort y soltura' },
];

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
  placeholder = 'Sin calibrar',
  unit = 'cm',
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

export default function SizePreferencesTab() {
  const { user, profile, refreshProfile } = useAuth();

  // Valores iniciales extraídos del perfil
  const initialData = useMemo(() => {
    const bm = profile?.body_measurements || {};
    return {
      height: profile?.height_cm != null ? Number(profile.height_cm) : null,
      weight: profile?.weight_kg != null ? Number(profile.weight_kg) : null,
      fitPreference: profile?.fit_preference || 'regular',
      waist: bm.waist != null ? Number(bm.waist) : null,
      hip: bm.hip != null ? Number(bm.hip) : null,
      bust: bm.bust != null ? Number(bm.bust) : null,
      underBust: bm.under_bust != null ? Number(bm.under_bust) : bm.underbust != null ? Number(bm.underbust) : null,
      footLength: bm.foot_length != null ? Number(bm.foot_length) : bm.footLength != null ? Number(bm.footLength) : null,
    };
  }, [profile]);

  // Bloque 1: Base
  const [height, setHeight] = useState(initialData.height);
  const [weight, setWeight] = useState(initialData.weight);
  const [fitPreference, setFitPreference] = useState(initialData.fitPreference);

  // Bloque 2: Ropa Interior Bajas
  const [waist, setWaist] = useState(initialData.waist);
  const [hip, setHip] = useState(initialData.hip);

  // Bloque 3: Ropa Interior Altas
  const [bust, setBust] = useState(initialData.bust);
  const [underBust, setUnderBust] = useState(initialData.underBust);

  // Bloque 4: Calcetería
  const [footLength, setFootLength] = useState(initialData.footLength);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Sincronizar estado cuando initialData cambie
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

  // Detección de cambios (isDirty)
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
  }, [height, weight, fitPreference, waist, hip, bust, underBust, footLength, initialData]);

  // ==========================================
  // INFERENCIA REACTIVA DE TALLAS ESTIMADAS
  // ==========================================
  const estimatedSizes = useMemo(() => {
    // 1. Prendas Bajas (Bóxers / Trusas)
    let bottom = null;
    if (waist != null || hip != null) {
      const w = waist != null ? Number(waist) : Number(hip) - 16;
      const h = hip != null ? Number(hip) : Number(waist) + 16;
      if (w <= 76 && h <= 95) bottom = 'S';
      else if (w <= 84 && h <= 101) bottom = 'M';
      else if (w <= 92 && h <= 108) bottom = 'L';
      else bottom = 'XL';
    }

    // 2. Prendas Altas (Tops / Brasiers)
    let top = null;
    if (bust != null || underBust != null) {
      const b = bust != null ? Number(bust) : Number(underBust) + 15;
      if (b <= 86) top = 'S';
      else if (b <= 92) top = 'M';
      else if (b <= 98) top = 'L';
      else top = 'XL';
    }

    // 3. Calcetería (Medias)
    let sock = null;
    let shoeRange = '—';
    if (footLength != null) {
      const f = Number(footLength);
      shoeRange = calcularCalzado(f);
      if (f < 24.5) sock = `S (${shoeRange})`;
      else if (f <= 26.5) sock = `M (${shoeRange})`;
      else if (f <= 29.5) sock = `L (${shoeRange})`;
      else sock = `XL (${shoeRange})`;
    }

    return {
      bottom,
      top,
      sock,
      shoeRange,
    };
  }, [waist, hip, bust, underBust, footLength]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    setFeedback(null);

    const payload = {
      height_cm: height ? Number(height) : null,
      weight_kg: weight ? Number(weight) : null,
      fit_preference: fitPreference,
      body_measurements: {
        waist: waist ? Number(waist) : null,
        hip: hip ? Number(hip) : null,
        bust: bust ? Number(bust) : null,
        under_bust: underBust ? Number(underBust) : null,
        foot_length: footLength ? Number(footLength) : null,
      },
      updated_at: new Date().toISOString(),
    };

    try {
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', user.id);

        if (error) throw error;
        await refreshProfile();
      }

      // Sincronizar en localStorage
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
        type: 'success',
        message: 'Tus medidas antropométricas y preferencias de talla fueron guardadas con éxito.',
      });
    } catch (err) {
      console.error('Error al guardar medidas en perfil:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error al guardar tus medidas.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {feedback && (
        <div
          className={`p-3.5 rounded-card border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-status-danger-border text-status-danger-text'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid Principal: Formulario a la izquierda y Resumen a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Principal: Formulario de Medidas (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4 text-accent" />
                Calibración de Medidas Anatómicas
              </CardTitle>
              <CardDescription>
                Ingresa tus dimensiones para recibir recomendaciones de talla precisas en ropa interior y calcetería.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                {/* Bloque 1: Contexto Corporal (Base) */}
                <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    1. Contexto Corporal (Base)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumberStepper
                      id="profile-height"
                      label="Estatura (cm)"
                      value={height}
                      onChange={setHeight}
                      min={120}
                      max={220}
                      step={1}
                      placeholder="175"
                    />
                    <NumberStepper
                      id="profile-weight"
                      label="Peso (kg)"
                      value={weight}
                      onChange={setWeight}
                      min={30}
                      max={160}
                      step={1}
                      unit="kg"
                      placeholder="70"
                    />
                  </div>

                  {/* Preferencia de Calce */}
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-brand-secondary mb-1.5">
                      Preferencia de Calce (Fit)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {FIT_OPTIONS.map((opt) => {
                        const isSelected = fitPreference === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFitPreference(opt.id)}
                            className={`p-2.5 rounded-card border text-left transition-all ${
                              isSelected
                                ? 'border-brand-primary bg-surface-card ring-1 ring-brand-primary text-brand-primary'
                                : 'border-border bg-surface-card text-brand-secondary hover:border-border-strong'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-bold">{opt.label}</span>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                            </div>
                            <span className="text-[10px] text-brand-muted block">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bloque 2: Ropa Interior Bajas */}
                <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    2. Ropa Interior Bajas (Bóxers / Calzones)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumberStepper
                      id="profile-waist"
                      label="Cintura (cm)"
                      value={waist}
                      onChange={setWaist}
                      min={45}
                      max={115}
                      step={1}
                      placeholder="Sin calibrar"
                    />
                    <NumberStepper
                      id="profile-hip"
                      label="Cadera (cm)"
                      value={hip}
                      onChange={setHip}
                      min={50}
                      max={125}
                      step={1}
                      placeholder="Sin calibrar"
                    />
                  </div>
                </div>

                {/* Bloque 3: Ropa Interior Altas (Tops / Brasiers) */}
                <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                    3. Ropa Interior Altas (Tops / Brasiers)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumberStepper
                      id="profile-underbust"
                      label="Bajo Busto (cm)"
                      value={underBust}
                      onChange={setUnderBust}
                      min={55}
                      max={105}
                      step={1}
                      placeholder="Sin calibrar"
                    />
                    <NumberStepper
                      id="profile-bust"
                      label="Busto / Pecho (cm)"
                      value={bust}
                      onChange={setBust}
                      min={60}
                      max={120}
                      step={1}
                      placeholder="Sin calibrar"
                    />
                  </div>
                </div>

                {/* Bloque 4: Calcetería */}
                <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                      4. Calcetería (Medias)
                    </span>
                    <span className="text-[11px] font-semibold text-accent font-mono">
                      Calzado aprox: {calcularCalzado(footLength)}
                    </span>
                  </div>
                  <NumberStepper
                    id="profile-foot"
                    label="Longitud de Pie (cm)"
                    value={footLength}
                    onChange={setFootLength}
                    min={14.0}
                    max={31.0}
                    step={0.5}
                    placeholder="Sin calibrar"
                  />
                </div>

                <div className="pt-2 flex justify-end">
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

        {/* Columna Lateral: Tarjetas de Talla Estimada en Perfil (4 cols) */}
        <aside className="lg:col-span-4 space-y-4">
          <Card className="sticky top-24">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm">Tus Tallas Estimadas</CardTitle>
              <CardDescription>
                Resumen calculado en tiempo real según tus medidas registradas.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-3">
              {/* Tarjeta 1: Prendas Bajas */}
              <div className="p-3 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                    Prendas Bajas
                  </span>
                  <span className="text-[10px] text-brand-muted">Bóxers / Trusas</span>
                </div>
                {estimatedSizes.bottom ? (
                  <span className="font-mono text-xl font-extrabold text-brand-primary">
                    {estimatedSizes.bottom}
                  </span>
                ) : (
                  <Badge variant="warning" className="text-[10px]">
                    Sin calibrar
                  </Badge>
                )}
              </div>

              {/* Tarjeta 2: Prendas Altas */}
              <div className="p-3 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                    Prendas Altas
                  </span>
                  <span className="text-[10px] text-brand-muted">Brasiers / Tops</span>
                </div>
                {estimatedSizes.top ? (
                  <span className="font-mono text-xl font-extrabold text-brand-primary">
                    {estimatedSizes.top}
                  </span>
                ) : (
                  <Badge variant="warning" className="text-[10px]">
                    Sin calibrar
                  </Badge>
                )}
              </div>

              {/* Tarjeta 3: Calcetería */}
              <div className="p-3 bg-surface-subtle border border-border rounded-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                    Calcetería
                  </span>
                  <span className="text-[10px] text-brand-muted">Medias</span>
                </div>
                {estimatedSizes.sock ? (
                  <span className="font-mono text-sm font-extrabold text-brand-primary">
                    {estimatedSizes.sock}
                  </span>
                ) : (
                  <Badge variant="warning" className="text-[10px]">
                    Sin calibrar
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
