import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Shirt,
  RotateCw,
  RotateCcw,
  Layers,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Check,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import {
  processStudioPhoto,
  validateGarmentImage,
} from "../services/geminiAi.service";

const PERSPECTIVES = [
  { id: "frontal", label: "Frontal", icon: Shirt },
  { id: "3/4 Der.", label: "3/4 Der.", icon: RotateCw },
  { id: "3/4 Izq.", label: "3/4 Izq.", icon: RotateCcw },
  { id: "espalda", label: "Espalda", icon: Layers },
];

const PROCESSING_STEPS = [
  "Segmentando silueta textil y removiendo fondo cotidiano...",
  "Calibrando textura del tejido y preservando detalles de pretina...",
  "Montando toma de estudio 4:5 sobre lienzo blanco puro...",
];

export default function AiPhotoStudioModal({
  isOpen,
  file,
  categoryName = "",
  colorName = "",
  onClose,
  onApprove,
}) {
  const originalFileRef = useRef(file);
  const [isExpanded, setIsExpanded] = useState(false);
  const [perspective, setPerspective] = useState("frontal");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [copyrightAlert, setCopyrightAlert] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [studioVersions, setStudioVersions] = useState([]);
  const [activeStudioVersion, setActiveStudioVersion] = useState(null);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    originalFileRef.current = file;
  }, [file]);

  const originalUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  const originalEntry = useMemo(
    () => ({
      id: "original",
      previewUrl: originalUrl,
      label: "Foto original",
      isOriginal: true,
      file: file,
    }),
    [originalUrl, file],
  );

  // La tarjeta #1 de la grilla es siempre la foto original, seguida de las generadas
  const allVersions = useMemo(
    () => [originalEntry, ...studioVersions],
    [originalEntry, studioVersions],
  );

  // Reset de estados al abrir modal con un archivo nuevo
  useEffect(() => {
    if (isOpen && file) {
      originalFileRef.current = file;
      setIsExpanded(false);
      setPerspective("frontal");
      setIsGenerating(false);
      setProcessingStep(0);
      setStudioVersions([]);
      setActiveStudioVersion({
        id: "original",
        previewUrl: originalUrl,
        label: "Foto original",
        isOriginal: true,
        file: file,
      });
      setIsMultiSelect(false);
      setSelectedIds(new Set());
      setApproving(false);
      setValidationResult(null);
      setCopyrightAlert(null);
      setModalError(null);
    }
  }, [isOpen, file, originalUrl]);

  // Guardarraíl: validación de prenda y discrepancia de categoría
  useEffect(() => {
    let isCancelled = false;

    async function checkGarment() {
      if (!file || !isOpen) return;
      setIsValidating(true);
      setValidationResult(null);
      setCopyrightAlert(null);
      setModalError(null);
      try {
        const result = await validateGarmentImage({
          imageFile: file,
          expectedCategory: categoryName,
        });
        if (!isCancelled) {
          if (result && result.isValid === false) {
            setValidationResult({
              isValid: false,
              detectedGarment: result.detectedGarment || "",
              matchesCategory: false,
              reason:
                result.reason ||
                "El archivo no contiene prendas de vestir catalogables.",
            });
          } else {
            setValidationResult({
              isValid: true,
              detectedGarment: result?.detectedGarment || "Prenda textil",
              matchesCategory: result?.matchesCategory !== false,
              summary:
                result?.summary ||
                `Prenda textil identificada: ${result?.detectedGarment || "Prenda de catálogo"}.`,
            });
          }
        }
      } catch {
        if (!isCancelled) {
          setValidationResult({
            isValid: true,
            detectedGarment: "Prenda textil",
            matchesCategory: true,
            summary: "Prenda textil admitida para estudio.",
          });
        }
      } finally {
        if (!isCancelled) {
          setIsValidating(false);
        }
      }
    }

    if (isOpen && file) {
      checkGarment();
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, file, categoryName]);

  if (!isOpen || !file) return null;

  async function handleGenerateWithAi() {
    if (copyrightAlert) return;
    if (validationResult && !validationResult.isValid) return;

    setIsGenerating(true);
    setProcessingStep(0);
    setModalError(null);

    const timer1 = setTimeout(() => setProcessingStep(1), 2500);
    const timer2 = setTimeout(() => setProcessingStep(2), 5000);

    try {
      const sourceFile = originalFileRef.current || file;
      const result = await processStudioPhoto({
        imageFile: sourceFile,
        perspective,
        colorName,
      });

      const matchedP = PERSPECTIVES.find((p) => p.id === perspective);
      const newItem = {
        id: `${Date.now()}-${perspective}`,
        file: result.file,
        previewUrl: result.previewUrl,
        perspective,
        label: matchedP ? matchedP.label : perspective,
        isOriginal: false,
      };

      setStudioVersions((prev) => [...prev, newItem]);
      setActiveStudioVersion(newItem);

      if (isMultiSelect) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(newItem.id);
          return next;
        });
      }
    } catch (err) {
      if (
        err.code === "SAFETY_RESTRICTION" ||
        err.message === "RESTRICCION_COPYRIGHT" ||
        err.message?.includes("imagen generada") ||
        err.message?.includes("SAFETY")
      ) {
        setCopyrightAlert({
          details:
            err.details ||
            "La prenda contiene ilustraciones, logotipos o elementos protegidos por derechos de autor o marcas registradas. No es posible generar la versión de estudio sintética.",
        });
        setModalError(null);
      } else {
        setModalError(
          err.message || "Error al procesar la fotografía en estudio.",
        );
      }
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsGenerating(false);
    }
  }

  function handleToggleSelectCard(item) {
    setActiveStudioVersion(item);
    if (!isMultiSelect) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  async function handleSaveOriginal() {
    setApproving(true);
    setModalError(null);
    try {
      const sourceFile = originalFileRef.current || file;
      await onApprove([sourceFile]);
      onClose();
    } catch (err) {
      setModalError(err.message || "Error al guardar foto original.");
    } finally {
      setApproving(false);
    }
  }

  async function handleApproveSelection() {
    setModalError(null);

    if (isMultiSelect) {
      if (selectedIds.size === 0) {
        setModalError("Selecciona al menos una versión de la grilla.");
        return;
      }
      const chosenFiles = allVersions
        .filter((v) => selectedIds.has(v.id))
        .map((v) => v.file);

      setApproving(true);
      try {
        await onApprove(chosenFiles);
        onClose();
      } catch (err) {
        setModalError(err.message || "Error al guardar las fotografías.");
      } finally {
        setApproving(false);
      }
    } else {
      const targetVersion = activeStudioVersion || originalEntry;
      setApproving(true);
      try {
        await onApprove([targetVersion.file]);
        onClose();
      } catch (err) {
        setModalError(err.message || "Error al guardar la fotografía.");
      } finally {
        setApproving(false);
      }
    }
  }

  function renderValidationBanner() {
    if (isValidating) {
      return (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-button text-xs text-blue-800 flex items-center gap-2 animate-in fade-in">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
          <span className="font-semibold">
            Analizando prenda textil con IA...
          </span>
        </div>
      );
    }

    if (validationResult && !validationResult.isValid) {
      return (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-button text-xs text-rose-800 flex items-start gap-2 relative animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 pr-4">
            <p className="font-bold text-[11px] uppercase tracking-wide text-rose-900">
              Imagen no admitida
            </p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              {validationResult.reason ||
                "El archivo no contiene prendas de vestir catalogables."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setValidationResult(null)}
            className="text-rose-400 hover:text-rose-700 absolute top-2 right-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (
      validationResult?.isValid &&
      validationResult.matchesCategory === false
    ) {
      return (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-button text-xs text-amber-900 flex items-start gap-2 relative animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 pr-4">
            <p className="font-bold text-[11px] uppercase tracking-wide text-amber-950">
              Discrepancia de categoría detectada
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Prenda textil identificada: {validationResult.detectedGarment},
              distinta a la categoría actual
              {categoryName ? ` (${categoryName})` : ""}. Puedes continuar o
              verificar la foto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setValidationResult(null)}
            className="text-amber-500 hover:text-amber-800 absolute top-2 right-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (validationResult?.isValid && !copyrightAlert) {
      return (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-button text-xs text-emerald-800 flex items-start gap-2 relative animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 pr-4">
            <p className="font-bold text-[11px] uppercase tracking-wide text-emerald-900">
              Prenda textil confirmada
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              {validationResult.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setValidationResult(null)}
            className="text-emerald-400 hover:text-emerald-700 absolute top-2 right-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return null;
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

          {copyrightAlert && (
            <div className="w-full p-3.5 bg-amber-50 border border-amber-200 rounded-button text-xs text-amber-900 flex items-start gap-2.5 relative animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 pr-6">
                <p className="font-bold text-xs uppercase tracking-wide text-amber-950">
                  Generación restringida por derechos de autor o marca
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  {copyrightAlert.details}
                </p>
                <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                  Puedes pulsar "Guardar foto original" para registrar esta
                  imagen real en el catálogo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCopyrightAlert(null)}
                className="text-amber-500 hover:text-amber-800 absolute top-3 right-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {renderValidationBanner()}

          {modalError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-button text-xs text-rose-800 flex items-start gap-2 relative">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 pr-4">
                <p className="text-[11px] text-rose-700">{modalError}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalError(null)}
                className="text-rose-400 hover:text-rose-700 absolute top-2 right-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
              className={`bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 text-xs shadow-sm ${
                copyrightAlert ? "ring-2 ring-accent ring-offset-2" : ""
              }`}
              onClick={handleSaveOriginal}
              disabled={approving}
            >
              Guardar foto original
            </Button>
            <Button
              type="button"
              className="bg-brand-primary text-white font-bold px-4 py-2 text-xs"
              onClick={() => setIsExpanded(true)}
              disabled={
                approving ||
                isValidating ||
                Boolean(copyrightAlert) ||
                (validationResult && !validationResult.isValid)
              }
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
        <div className="max-w-4xl w-full bg-white rounded-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-4 max-h-[92vh] flex flex-col">
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
              disabled={isGenerating || approving}
              className="text-slate-400 hover:text-brand-primary p-1 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Alerta Superior de Ancho Completo para Rechazos de Copyright */}
          {copyrightAlert && (
            <div className="w-full p-3.5 bg-amber-50 border border-amber-200 rounded-button text-xs text-amber-900 flex items-start gap-2.5 relative animate-in fade-in duration-200 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 pr-6">
                <p className="font-bold text-xs uppercase tracking-wide text-amber-950">
                  Generación restringida por derechos de autor o marca
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  {copyrightAlert.details ||
                    "La prenda contiene logotipos, licencias o propiedad intelectual protegida. No es posible generar la versión de estudio sintética."}
                </p>
                <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                  Puedes pulsar "Guardar foto original" para registrar esta
                  imagen real en el catálogo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCopyrightAlert(null)}
                className="text-amber-500 hover:text-amber-800 absolute top-3 right-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {modalError && (
            <div className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-button text-xs text-rose-800 flex items-start gap-2 relative shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 pr-4">
                <p className="text-[11px] text-rose-700">{modalError}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalError(null)}
                className="text-rose-400 hover:text-rose-700 absolute top-2 right-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 2 Columnas */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1 min-h-0 overflow-hidden">
            {/* Columna Izquierda: Vista Previa Principal */}
            <div className="md:col-span-6 flex flex-col items-center justify-center">
              <div className="relative aspect-[4/5] w-full bg-slate-50 border border-border rounded-card overflow-hidden flex items-center justify-center p-3 shadow-inner">
                {isGenerating ? (
                  /* Animación Narrativa (~2.5s por paso) */
                  <div className="w-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-accent animate-spin" />
                      <Sparkles className="w-4 h-4 text-brand-primary absolute -bottom-1 -right-1" />
                    </div>
                    <div className="space-y-2 w-full max-w-[260px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        Paso {processingStep + 1} de 3
                      </span>
                      <p className="text-xs font-bold text-brand-primary leading-snug">
                        {PROCESSING_STEPS[processingStep]}
                      </p>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-700 ease-out"
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
                      {activeStudioVersion?.isOriginal
                        ? "Foto original"
                        : activeStudioVersion
                          ? `Versión de Estudio: ${activeStudioVersion.label}`
                          : "Foto original"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Columna Derecha: Controles y Grilla de Versiones */}
            <div className="md:col-span-6 flex flex-col h-full min-h-0 space-y-3">
              {/* Notificación Persistente de Validación sobre los botones */}
              {renderValidationBanner()}

              <div className="shrink-0">
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
                        disabled={isGenerating || Boolean(copyrightAlert)}
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

                <div className="mt-3">
                  <Button
                    type="button"
                    disabled={
                      isValidating ||
                      Boolean(copyrightAlert) ||
                      (validationResult && !validationResult.isValid) ||
                      isGenerating
                    }
                    onClick={handleGenerateWithAi}
                    className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-2.5 flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Transformando en Estudio IA...</span>
                      </>
                    ) : isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                        <span>Validando prenda textil...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Editar con IA</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Grilla de Versiones (Siempre incluye Foto Original en #1) */}
              <div className="flex flex-col flex-1 min-h-0 pt-1">
                <div className="flex items-center justify-between pb-1.5 shrink-0">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Versiones de Estudio ({allVersions.length})
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMultiSelect}
                      onChange={(e) => {
                        setIsMultiSelect(e.target.checked);
                        setSelectedIds(new Set());
                      }}
                      className="rounded border-border accent-brand-primary cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Seleccionar varias</span>
                  </label>
                </div>

                <div className="flex-1 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    {allVersions.map((item) => {
                      const isActivePreview =
                        activeStudioVersion?.id === item.id;
                      const isChecked = selectedIds.has(item.id);
                      const isHighlighted = isMultiSelect
                        ? isChecked
                        : isActivePreview;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleSelectCard(item)}
                          className={`aspect-[4/5] rounded-button overflow-hidden cursor-pointer relative bg-white transition-all flex flex-col ${
                            isHighlighted
                              ? "border-2 border-brand-primary ring-2 ring-brand-primary/20 shadow-sm"
                              : "border border-border hover:border-brand-primary/60 opacity-85 hover:opacity-100"
                          }`}
                        >
                          {isMultiSelect && (
                            <div
                              className={`absolute top-2 right-2 z-10 w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                isChecked
                                  ? "bg-brand-primary border-brand-primary text-white"
                                  : "bg-white/90 border-slate-300 text-transparent"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}

                          <div className="flex-1 w-full bg-slate-50 flex items-center justify-center overflow-hidden p-1.5">
                            <img
                              src={item.previewUrl}
                              alt={item.label}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span
                            className={`text-[10px] font-bold text-center py-1 border-t border-border truncate px-1.5 ${
                              item.isOriginal
                                ? "bg-slate-100 text-slate-700"
                                : "bg-surface-subtle text-brand-primary"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer del Modo Expandido */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
              disabled={isGenerating || approving}
            >
              Volver
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className={`bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 text-xs shadow-sm ${
                  copyrightAlert
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-white animate-pulse"
                    : ""
                }`}
                onClick={handleSaveOriginal}
                disabled={isGenerating || approving}
              >
                Guardar foto original
              </Button>
              <Button
                type="button"
                className="bg-brand-primary text-white font-bold px-5 py-2 text-xs"
                onClick={handleApproveSelection}
                disabled={
                  isGenerating ||
                  approving ||
                  (isMultiSelect ? selectedIds.size === 0 : !activeStudioVersion)
                }
                isLoading={approving}
              >
                {isMultiSelect
                  ? `Guardar fotos editadas (${selectedIds.size})`
                  : "Guardar foto editada"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
