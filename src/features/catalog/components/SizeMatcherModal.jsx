import React, { useState, useMemo, useEffect } from 'react';
import { X, AlertTriangle, Sparkles, Zap, Ruler, Check, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

const STORAGE_KEY = 'erxidi_user_profile_measurements';
const SIZES = ['S', 'M', 'L', 'XL'];
const FIT_OPTIONS = ['Ajustado', 'Regular', 'Holgado'];

function getSavedMeasurements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer de localStorage:', err);
  }
  return null;
}

export default function SizeMatcherModal({
  isOpen,
  onClose,
  onSizeSelected,
  garmentFamily = null,
}) {
  const saved = useMemo(() => getSavedMeasurements() || {}, []);

  const [activeTab, setActiveTab] = useState(saved.activeTab || 'quick');

  // Quick inputs
  const [height, setHeight] = useState(saved.height ?? 175);
  const [weight, setWeight] = useState(saved.weight ?? 70);
  const [fit, setFit] = useState(saved.fit ?? 'Regular');

  // Precise inputs
  const [waist, setWaist] = useState(saved.waist ?? 80);
  const [hip, setHip] = useState(saved.hip ?? 96);
  const [underbust, setUnderbust] = useState(saved.underbust ?? 75);
  const [bust, setBust] = useState(saved.bust ?? 90);
  const [footLength, setFootLength] = useState(saved.footLength ?? 26);

  // Sync state if saved data is read upon opening
  useEffect(() => {
    if (isOpen) {
      const stored = getSavedMeasurements();
      if (stored) {
        if (stored.height) setHeight(stored.height);
        if (stored.weight) setWeight(stored.weight);
        if (stored.fit) setFit(stored.fit);
        if (stored.waist) setWaist(stored.waist);
        if (stored.hip) setHip(stored.hip);
        if (stored.underbust) setUnderbust(stored.underbust);
        if (stored.bust) setBust(stored.bust);
        if (stored.footLength) setFootLength(stored.footLength);
        if (stored.activeTab) setActiveTab(stored.activeTab);
      }
    }
  }, [isOpen]);

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
    const heightInMeters = height / 100;
    const computedImc = weight / (heightInMeters * heightInMeters);

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

    let expText = 'Recomendación equilibrada para tu complexión física.';
    if (fit === 'Ajustado') {
      expText =
        finalIndex < baseIndex
          ? `Ajuste ceñido: una talla menos sobre tu base ${SIZES[baseIndex]}.`
          : 'Ajuste ceñido para complexión delgada.';
    } else if (fit === 'Holgado') {
      expText =
        finalIndex > baseIndex
          ? `Ajuste holgado: mayor holgura sobre tu base ${SIZES[baseIndex]}.`
          : 'Ajuste relajado para máxima comodidad.';
    }

    return {
      size: SIZES[finalIndex],
      baseSize: SIZES[baseIndex],
      imc: computedImc,
      explanation: expText,
    };
  }, [height, weight, fit]);

  // 2. Precise Mode calculations by garment family
  const preciseResult = useMemo(() => {
    // Lower body (Bóxers / Trusas)
    let bottom = 'M';
    if (waist <= 76 && hip <= 95) bottom = 'S';
    else if (waist <= 84 && hip <= 101) bottom = 'M';
    else if (waist <= 92 && hip <= 108) bottom = 'L';
    else bottom = 'XL';

    // Upper body (Brasiers / Tops)
    let top = 'M';
    if (underbust <= 72 && bust <= 86) top = 'S';
    else if (underbust <= 77 && bust <= 92) top = 'M';
    else if (underbust <= 82 && bust <= 98) top = 'L';
    else top = 'XL';

    // Socks & footwear reference
    let socks = 'M';
    let shoeRef = '38 - 40';
    if (footLength < 24.5) {
      socks = 'S';
      shoeRef = '35 - 37';
    } else if (footLength <= 26.5) {
      socks = 'M';
      shoeRef = '38 - 40';
    } else if (footLength <= 29.5) {
      socks = 'L';
      shoeRef = '41 - 43';
    } else {
      socks = 'XL';
      shoeRef = '44 - 46';
    }

    return {
      bottomSize: bottom,
      topSize: top,
      socksSize: socks,
      shoeRef,
      suggestedSize: bottom, // Primary reference
    };
  }, [waist, hip, underbust, bust, footLength]);

  const targetPreciseSize = useMemo(() => {
    if (garmentFamily === 'bottoms') return preciseResult.bottomSize;
    if (garmentFamily === 'tops') return preciseResult.topSize;
    if (garmentFamily === 'socks') return preciseResult.socksSize;
    return preciseResult.suggestedSize;
  }, [garmentFamily, preciseResult]);

  const activeCalculatedSize =
    activeTab === 'quick' ? quickResult.size : targetPreciseSize;

  if (!isOpen) return null;

  const handleApply = () => {
    const allMeasurements = {
      height,
      weight,
      fit,
      waist,
      hip,
      underbust,
      bust,
      footLength,
      calculatedSize: activeCalculatedSize,
      quickSize: quickResult.size,
      bottomSize: preciseResult.bottomSize,
      topSize: preciseResult.topSize,
      socksSize: preciseResult.socksSize,
      shoeReference: preciseResult.shoeRef,
      activeTab,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allMeasurements));
    } catch (err) {
      console.error('Error al persistir mediciones:', err);
    }

    onSizeSelected?.(activeCalculatedSize, allMeasurements);
    onClose?.();
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

        {/* Tab 1: Calculador Rápido */}
        {activeTab === 'quick' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Estatura */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <label htmlFor="height-slider" className="text-brand-secondary">
                  Estatura
                </label>
                <span className="font-mono text-brand-primary font-bold">
                  {height} cm
                </span>
              </div>
              <input
                id="height-slider"
                type="range"
                min={140}
                max={200}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full h-2 bg-surface-subtle border border-border rounded-badge appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                <span>140 cm</span>
                <span>200 cm</span>
              </div>
            </div>

            {/* Peso */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <label htmlFor="weight-slider" className="text-brand-secondary">
                  Peso
                </label>
                <span className="font-mono text-brand-primary font-bold">
                  {weight} kg
                </span>
              </div>
              <input
                id="weight-slider"
                type="range"
                min={45}
                max={120}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-2 bg-surface-subtle border border-border rounded-badge appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                <span>45 kg</span>
                <span>120 kg</span>
              </div>
            </div>

            {/* Preferencia de Ajuste (Fit) */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-brand-secondary block">
                Preferencia de ajuste (Fit)
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
          </div>
        )}

        {/* Tab 2: Calculador Preciso */}
        {activeTab === 'precise' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Bloque 1: Prendas Bajas */}
            {(!garmentFamily || garmentFamily === 'bottoms') && (
              <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  {garmentFamily ? 'Prendas Bajas (Bóxers / Calzones)' : '1. Prendas Bajas (Bóxers / Calzones)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="waist-input" className="text-brand-secondary font-semibold">
                        Cintura (cm)
                      </label>
                      <span className="font-mono font-bold text-brand-primary">
                        {waist} cm
                      </span>
                    </div>
                    <input
                      id="waist-input"
                      type="range"
                      min={50}
                      max={130}
                      value={waist}
                      onChange={(e) => setWaist(Number(e.target.value))}
                      className="w-full h-2 bg-surface-card border border-border rounded-badge appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                      <span>50 cm</span>
                      <span>130 cm</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="hip-input" className="text-brand-secondary font-semibold">
                        Cadera (cm)
                      </label>
                      <span className="font-mono font-bold text-brand-primary">
                        {hip} cm
                      </span>
                    </div>
                    <input
                      id="hip-input"
                      type="range"
                      min={70}
                      max={140}
                      value={hip}
                      onChange={(e) => setHip(Number(e.target.value))}
                      className="w-full h-2 bg-surface-card border border-border rounded-badge appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                      <span>70 cm</span>
                      <span>140 cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bloque 2: Prendas Altas / Busto */}
            {(!garmentFamily || garmentFamily === 'tops') && (
              <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-3">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  {garmentFamily ? 'Prendas Altas / Busto (Brasiers / Tops)' : '2. Prendas Altas / Busto (Brasiers / Tops)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="underbust-input" className="text-brand-secondary font-semibold">
                        Bajo Busto (cm)
                      </label>
                      <span className="font-mono font-bold text-brand-primary">
                        {underbust} cm
                      </span>
                    </div>
                    <input
                      id="underbust-input"
                      type="range"
                      min={60}
                      max={120}
                      value={underbust}
                      onChange={(e) => setUnderbust(Number(e.target.value))}
                      className="w-full h-2 bg-surface-card border border-border rounded-badge appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                      <span>60 cm</span>
                      <span>120 cm</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="bust-input" className="text-brand-secondary font-semibold">
                        Busto / Pecho (cm)
                      </label>
                      <span className="font-mono font-bold text-brand-primary">
                        {bust} cm
                      </span>
                    </div>
                    <input
                      id="bust-input"
                      type="range"
                      min={70}
                      max={130}
                      value={bust}
                      onChange={(e) => setBust(Number(e.target.value))}
                      className="w-full h-2 bg-surface-card border border-border rounded-badge appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                      <span>70 cm</span>
                      <span>130 cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bloque 3: Calcetería */}
            {(!garmentFamily || garmentFamily === 'socks') && (
              <div className="p-3.5 rounded-card bg-surface-subtle border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                    {garmentFamily ? 'Calcetería (Medias)' : '3. Calcetería (Medias)'}
                  </span>
                  <span className="text-[11px] font-semibold text-accent">
                    Calzado ref: {preciseResult.shoeRef}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="foot-input" className="text-brand-secondary font-semibold">
                      Longitud del pie (cm)
                    </label>
                    <span className="font-mono font-bold text-brand-primary">
                      {footLength} cm
                    </span>
                  </div>
                  <input
                    id="foot-input"
                    type="range"
                    min={20}
                    max={32}
                    step={0.5}
                    value={footLength}
                    onChange={(e) => setFootLength(Number(e.target.value))}
                    className="w-full h-2 bg-surface-card border border-border rounded-badge appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-brand-muted font-mono">
                    <span>20 cm (~34)</span>
                    <span>26 cm (~39)</span>
                    <span>32 cm (~46)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Calculation Result Box */}
        {activeTab === 'quick' ? (
          <div className="p-4 bg-surface-subtle border border-border rounded-card text-center space-y-2">
            <span className="text-xs font-semibold text-brand-secondary uppercase tracking-wider block">
              Resultado sugerido
            </span>

            <div className="flex items-baseline justify-center gap-2">
              <span className="text-sm font-semibold text-brand-secondary">
                Talla recomendada:
              </span>
              <span className="font-mono text-3xl font-extrabold text-brand-primary">
                {quickResult.size}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge variant="neutral">
                IMC {quickResult.imc.toFixed(1)}
              </Badge>
              <Badge variant="neutral">
                Base: {quickResult.baseSize}
              </Badge>
            </div>
            <p className="text-xs text-brand-secondary pt-1 leading-relaxed">
              {quickResult.explanation}
            </p>
          </div>
        ) : garmentFamily ? (
          /* Modo Preciso filtrado por familia */
          <div className="p-4 bg-surface-subtle border border-border rounded-card text-center space-y-2">
            <span className="text-xs font-semibold text-brand-secondary uppercase tracking-wider block">
              Resultado sugerido (
              {garmentFamily === 'bottoms'
                ? 'Prendas Bajas'
                : garmentFamily === 'tops'
                ? 'Prendas Altas / Busto'
                : 'Calcetería'}
              )
            </span>

            <div className="flex items-baseline justify-center gap-2">
              <span className="text-sm font-semibold text-brand-secondary">
                Talla recomendada:
              </span>
              <span className="font-mono text-3xl font-extrabold text-brand-primary">
                {targetPreciseSize}
              </span>
            </div>

            {garmentFamily === 'socks' ? (
              <div className="pt-1">
                <Badge variant="neutral">
                  Calzado ref: {preciseResult.shoeRef}
                </Badge>
              </div>
            ) : garmentFamily === 'bottoms' ? (
              <p className="text-xs text-brand-secondary pt-1 leading-relaxed">
                Cintura: {waist} cm &bull; Cadera: {hip} cm
              </p>
            ) : (
              <p className="text-xs text-brand-secondary pt-1 leading-relaxed">
                Bajo Busto: {underbust} cm &bull; Busto: {bust} cm
              </p>
            )}
          </div>
        ) : (
          /* Modo Preciso global (sin filtro de familia) */
          <div className="p-4 bg-surface-subtle border border-border rounded-card space-y-3">
            <div className="text-center">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block">
                Tus tallas sugeridas por familia de prenda
              </span>
              <p className="text-[11px] text-brand-secondary mt-0.5">
                Ajuste anatómico específico calculado según tus medidas corporales
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
              {/* Prendas Bajas */}
              <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                  Prendas Bajas
                </span>
                <span className="font-mono text-2xl font-extrabold text-brand-primary">
                  {preciseResult.bottomSize}
                </span>
                <span className="text-[10px] text-brand-muted">
                  Bóxers / Trusas
                </span>
              </div>

              {/* Prendas Altas */}
              <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                  Prendas Altas
                </span>
                <span className="font-mono text-2xl font-extrabold text-brand-primary">
                  {preciseResult.topSize}
                </span>
                <span className="text-[10px] text-brand-muted">
                  Brasiers / Tops
                </span>
              </div>

              {/* Calcetería */}
              <div className="p-3 bg-surface-card rounded-card border border-border flex flex-col justify-between space-y-1 shadow-subtle">
                <span className="text-[11px] font-semibold text-brand-secondary block uppercase tracking-wide">
                  Calcetería
                </span>
                <span className="font-mono text-2xl font-extrabold text-brand-primary">
                  {preciseResult.socksSize}
                </span>
                <span className="text-[10px] text-brand-muted">
                  Calzado {preciseResult.shoeRef}
                </span>
              </div>
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
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleApply}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar perfil y aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
