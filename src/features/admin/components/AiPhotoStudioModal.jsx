import { useEffect, useMemo, useState } from "react";
import {
  X,
  Sparkles,
  Shirt,
  RotateCw,
  RotateCcw,
  Layers,
  Check,
  Loader2,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import { processStudioPhoto } from "../services/geminiAi.service";

const PERSPECTIVES = [
  { id: "frontal", label: "Frontal", icon: Shirt },
  { id: "tres-cuartos-der", label: "3/4 Der.", icon: RotateCw },
  { id: "tres-cuartos-izq", label: "3/4 Izq.", icon: RotateCcw },
  { id: "espalda", label: "Espalda", icon: Layers },
];

const PROCESSING_STEPS = [
  "Analizando silueta de la prenda...",
  "Eliminando superficie cotidiana y ruido...",
  "Calibrando iluminación de estudio y proporción 4:5...",
];

export default function AiPhotoStudioModal({
  isOpen,
  file,
  colorName = "",
  onClose,
  onApprove,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [perspective, setPerspective] = useState("frontal");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [studioVersions, setStudioVersions] = useState([]);
  const [activeStudioVersion, setActiveStudioVersion] = useState(null);
  const [approving, setApproving] = useState(false);

  const originalUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  // Reset de estados al abrir modal con un archivo nuevo
  useEffect(() => {
    if (isOpen) {
      setIsExpanded(false);
      setPerspective("frontal");
      setIsProcessing(false);
      setProcessingStep(0);
      setStudioVersions([]);
      setActiveStudioVersion(null);
      setApproving(false);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  async function handleExecuteStudio() {
    setIsProcessing(true);
    setProcessingStep(0);

    const timer1 = setTimeout(() => setProcessingStep(1), 600);
    const timer2 = setTimeout(() => setProcessingStep(2), 1200);

    try {
      const result = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const res = await processStudioPhoto({
              imageFile: file,
              perspective,
            });
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }, 1800);
      });

      const matchedP = PERSPECTIVES.find((p) => p.id === perspective);
      const newItem = {
        id: `${Date.now()}-${perspective}`,
        file: result.file,
        previewUrl: result.previewUrl,
        perspective,
        label: matchedP ? matchedP.label : perspective,
      };

      setStudioVersions((prev) => [newItem, ...prev]);
      setActiveStudioVersion(newItem);
    } catch (err) {
      window.alert(err.message || "Error al procesar la fotografía en estudio.");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsProcessing(false);
    }
  }

  async function handleSaveOriginal() {
    setApproving(true);
    try {
      await onApprove(file, true);
      onClose();
    } catch (err) {
      window.alert(err.message || "Error al guardar foto original.");
    } finally {
      setApproving(false);
    }
  }

  async function handleApproveStudio() {
    if (!activeStudioVersion) {
      window.alert("Genera o selecciona primero una versión de estudio.");
      return;
    }
    setApproving(true);
    try {
      await onApprove(activeStudioVersion.file, false);
      onClose();
    } catch (err) {
      window.alert(err.message || "Error al aprobar versión de estudio.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {!isExpanded ? (
        /* =========================================================
           ETAPA 1: Previsualización Compacta Inicial
        ========================================================= */
        <div className="max-w-xl w-full bg-white rounded-card p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-sm font-bold text-brand-primary">
              Previsualización de Fotografía ({colorName || "Prenda"})
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={approving}
              className="text-slate-400 hover:text-brand-primary p-1 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative aspect-[4/5] max-h-[380px] mx-auto bg-slate-50 border border-border rounded-button overflow-hidden flex items-center justify-center p-2 shadow-xs">
            <img
              src={originalUrl}
              alt="Foto cargada"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Footer Etapa 1 */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={approving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 text-xs shadow-sm"
              onClick={handleSaveOriginal}
              disabled={approving}
            >
              Guardar foto original
            </Button>
            <Button
              type="button"
              className="bg-brand-primary text-white font-bold px-4 py-2 text-xs"
              onClick={() => setIsExpanded(true)}
              disabled={approving}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Mejorar con IA
            </Button>
          </div>
        </div>
      ) : (
        /* =========================================================
           ETAPA 2: Estudio Fotográfico Expandido
        ========================================================= */
        <div className="max-w-4xl w-full bg-white rounded-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-5 max-h-[90vh] flex flex-col">
          {/* Cabecera Estudio IA */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-brand-primary">
                Estudio Fotográfico IA · ERXIDI ({colorName || "Prenda"})
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || approving}
              className="text-slate-400 hover:text-brand-primary p-1 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2 Columnas */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1 overflow-y-auto pr-1">
            {/* Columna Izquierda: ÚNICO CONTENEDOR */}
            <div className="md:col-span-6 flex flex-col items-center justify-center">
              <div className="relative aspect-[4/5] w-full bg-slate-50 border border-border rounded-card overflow-hidden flex items-center justify-center p-3 shadow-inner">
                {isProcessing ? (
                  /* Animación Narrativa */
                  <div className="w-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-accent animate-spin" />
                      <Sparkles className="w-4 h-4 text-brand-primary absolute -bottom-1 -right-1" />
                    </div>
                    <div className="space-y-2 w-full max-w-[240px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        Paso {processingStep + 1} de 3
                      </span>
                      <p className="text-xs font-bold text-brand-primary leading-snug">
                        {PROCESSING_STEPS[processingStep]}
                      </p>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-500 ease-out"
                          style={{
                            width: `${((processingStep + 1) / 3) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={activeStudioVersion?.previewUrl || originalUrl}
                      alt="Previsualización de estudio"
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold backdrop-blur-xs">
                      {activeStudioVersion
                        ? `Versión de Estudio: ${activeStudioVersion.label}`
                        : "Foto original"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Columna Derecha: Controles y Versiones */}
            <div className="md:col-span-6 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Perspectiva de la prenda
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PERSPECTIVES.map((p) => {
                    const IconComponent = p.icon;
                    const selected = perspective === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setPerspective(p.id)}
                        className={`px-3 py-2 rounded-button text-xs font-semibold border flex items-center transition-all ${
                          selected
                            ? "bg-brand-primary text-white border-brand-primary font-bold shadow-xs"
                            : "border-border bg-surface-subtle text-brand-primary hover:border-brand-primary/50"
                        }`}
                      >
                        <IconComponent className="w-4 h-4 mr-1.5 shrink-0" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-2.5 mt-3 flex items-center justify-center gap-2 text-xs"
                  onClick={handleExecuteStudio}
                  isLoading={isProcessing}
                  disabled={isProcessing}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Editar con IA</span>
                </Button>
              </div>

              {/* Cuadrícula de Versiones de Estudio */}
              {studioVersions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Versiones de Estudio ({studioVersions.length})
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 max-h-[190px] overflow-y-auto p-1">
                    {studioVersions.map((item) => {
                      const isSelected = activeStudioVersion?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveStudioVersion(item)}
                          className={`aspect-[4/5] rounded-button overflow-hidden cursor-pointer relative bg-white transition-all flex flex-col ${
                            isSelected
                              ? "border-2 border-brand-primary ring-2 ring-brand-primary/20 shadow-sm"
                              : "border border-border hover:border-brand-primary/60 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.label}
                            className="w-full h-full object-contain p-1"
                          />
                          <span className="text-[10px] font-bold text-center py-1 bg-surface-subtle text-brand-primary border-t border-border truncate px-1">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer del Modo Expandido */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
              disabled={isProcessing || approving}
            >
              Volver
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 text-xs shadow-sm"
                onClick={handleSaveOriginal}
                disabled={isProcessing || approving}
              >
                Guardar foto original
              </Button>
              <Button
                type="button"
                className="bg-brand-primary text-white font-bold px-5 py-2 text-xs"
                onClick={handleApproveStudio}
                disabled={!activeStudioVersion || isProcessing || approving}
                isLoading={approving}
              >
                Aprobar y guardar en catálogo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
