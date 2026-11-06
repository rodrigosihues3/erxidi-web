import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Star,
  Trash2,
  ImagePlus,
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  Pencil,
  Eye,
  Shirt,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import VariantMatrix from "../components/VariantMatrix";
import AiPhotoStudioModal from "../components/AiPhotoStudioModal";
import {
  createProduct,
  getProduct,
  getProductDependencies,
  updateProduct,
  uploadProductImage,
} from "../services/adminProducts.service";
import { enhanceDescriptionWithAi } from "../services/geminiAi.service";
import { invalidateCatalogCache } from "../../../services/api/catalogService";

const initial = {
  category_id: "",
  material_id: "",
  brand_id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  main_image_url: "",
  gallery_urls: [],
  has_size_guide: true,
  is_featured: false,
  is_active: true,
  target_gender: "hombre",
};

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProductFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [form, setForm] = useState(initial);
  const [variants, setVariants] = useState([]);
  const [colorImages, setColorImages] = useState([]);
  const [deps, setDeps] = useState({
    categories: [],
    materials: [],
    sizes: [],
    brands: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [activeImage, setActiveImage] = useState("");
  const [activeColor, setActiveColor] = useState("");

  // Estados para Estudio Fotográfico IA y Asistencia de Redacción
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancingMode, setEnhancingMode] = useState(null);
  const [previousDescription, setPreviousDescription] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [deleteImageModalOpen, setDeleteImageModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [studioFile, setStudioFile] = useState(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? "" : curr));
    }, 4000);
  }

  // Textarea con Altura Dinámica Auto-Expandible sensible a isPreviewMode
  useEffect(() => {
    if (!isPreviewMode && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.max(140, textareaRef.current.scrollHeight);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [form.description, isPreviewMode]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const dependencies = await getProductDependencies();
        if (!active) return;
        setDeps(dependencies);
        if (editing) {
          const product = await getProduct(id);
          if (!active) return;
          const gallery = product.gallery_urls || [];
          const mainUrl = product.main_image_url || gallery[0] || "";
          const normalizedGallery =
            mainUrl && !gallery.includes(mainUrl)
              ? [mainUrl, ...gallery]
              : gallery;

          setForm({
            category_id: product.category_id || "",
            material_id: product.material_id || "",
            brand_id: product.brand_id || "",
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.price ? String(product.price) : "",
            main_image_url: mainUrl,
            gallery_urls: normalizedGallery,
            has_size_guide: product.has_size_guide,
            is_featured: product.is_featured,
            is_active: product.is_active,
            target_gender: product.target_gender || "hombre",
          });

          const activeVariants = (product.product_variants || [])
            .filter((variant) => variant.is_active !== false)
            .map((variant) => ({ ...variant, product_id: product.id }));
          setVariants(activeVariants);

          // Hidratar product_color_images o migrar desde gallery_urls
          const rawColorImages = product.product_color_images || [];
          let initialColorImages = [];

          if (rawColorImages.length > 0) {
            initialColorImages = rawColorImages.map((item) => ({
              id: item.id,
              product_id: item.product_id,
              color: item.color,
              image_url: item.image_url,
              is_cover: Boolean(item.is_cover),
              display_order: item.display_order ?? 0,
            }));
          } else {
            const fallbackColor = activeVariants[0]?.color || "Blanco";
            initialColorImages = normalizedGallery.map((url, idx) => ({
              color: fallbackColor,
              image_url: url,
              is_cover: url === mainUrl || idx === 0,
              display_order: idx,
            }));
          }

          setColorImages(initialColorImages);

          const initialColor = activeVariants[0]?.color || "";
          if (initialColor) {
            setActiveColor(initialColor);
          }
          setActiveImage(mainUrl);
        }
      } catch (err) {
        if (active)
          setError(err.message || "No se pudo cargar el formulario.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, editing]);

  const availableColors = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter(Boolean))],
    [variants],
  );

  useEffect(() => {
    if (availableColors.length > 0) {
      if (!availableColors.includes(activeColor)) {
        setActiveColor(availableColors[0]);
      }
    } else if (activeColor !== "") {
      setActiveColor("");
    }
  }, [availableColors, activeColor]);

  // Fotografías asociadas al color activo
  const activeColorImages = useMemo(() => {
    return colorImages.filter(
      (img) => img.color.toLowerCase() === (activeColor || "").toLowerCase(),
    );
  }, [colorImages, activeColor]);

  // Sincronización automática de imagen activa al alternar color
  useEffect(() => {
    if (!activeColor) return;
    const matching = colorImages.filter(
      (img) => img.color.toLowerCase() === activeColor.toLowerCase(),
    );
    if (matching.length > 0) {
      const cover = matching.find((img) => img.is_cover) || matching[0];
      if (!matching.some((img) => img.image_url === activeImage)) {
        setActiveImage(cover.image_url);
      }
    } else {
      setActiveImage("");
    }
  }, [activeColor, colorImages]);

  // Jerarquía ordenada de categorías
  const categorizedOptions = useMemo(() => {
    const roots = deps.categories.filter((c) => c.parent_id == null);
    const options = [];

    roots.forEach((root) => {
      options.push({ id: root.id, name: root.name, isChild: false });
      const children = deps.categories.filter((c) => c.parent_id === root.id);
      children.forEach((child) => {
        options.push({ id: child.id, name: `— ${child.name}`, isChild: true });
      });
    });

    return options.length > 0 ? options : deps.categories;
  }, [deps.categories]);

  // Filtrado reactivo de categorías desde target_genders de base de datos
  const filteredCategoryOptions = useMemo(() => {
    if (!form.target_gender) return categorizedOptions;
    return categorizedOptions.filter((cat) => {
      const rawCat = deps.categories.find(
        (c) => String(c.id) === String(cat.id),
      );
      if (!rawCat || !rawCat.target_genders) return true;
      return rawCat.target_genders.includes(form.target_gender);
    });
  }, [categorizedOptions, deps.categories, form.target_gender]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleGenderChange(newGender) {
    update("target_gender", newGender);
    const currentCat = deps.categories.find(
      (c) => String(c.id) === String(form.category_id),
    );
    if (currentCat && currentCat.target_genders) {
      if (!currentCat.target_genders.includes(newGender)) {
        update("category_id", "");
      }
    }
  }

  async function handleDownloadImage(url, filename) {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download =
        filename || `erxidi-${form.slug || "prenda"}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleNameChange(value) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugify(value),
    }));
  }

  function handlePriceChange(val) {
    if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
      update("price", val);
    }
  }

  function handlePriceBlur() {
    const num = parseFloat(form.price);
    if (!isNaN(num) && num > 0) {
      update("price", num.toFixed(2));
    }
  }

  async function handleEnhanceText(mode) {
    setIsEnhancing(true);
    setEnhancingMode(mode);
    try {
      const selectedCategory =
        deps.categories.find((c) => String(c.id) === String(form.category_id))
          ?.name || "";

      const currentText = form.description;
      const enhanced = await enhanceDescriptionWithAi({
        rawText: currentText,
        mode,
        productName: form.name,
        category: selectedCategory,
      });

      setPreviousDescription(currentText);
      update("description", enhanced);
      showToast(
        mode === "redaccion"
          ? "Redacción optimizada con IA."
          : "Estructura de características generada con IA.",
      );
    } catch (err) {
      showToast(err.message || "Error al conectar con el Asistente IA.");
    } finally {
      setIsEnhancing(false);
      setEnhancingMode(null);
    }
  }

  function openPhotoModal(forColor) {
    if (forColor) {
      setActiveColor(forColor);
    }
    fileInputRef.current?.click();
  }

  // Soporte y Conversión en Cliente de Imágenes HEIC (iPhone)
  async function handleFileInputChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    let normalizedFile = file;
    const isHeic =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif") ||
      file.type === "image/heic";

    if (isHeic) {
      try {
        let heic2anyFn = window.heic2any;
        if (!heic2anyFn) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          heic2anyFn = window.heic2any;
        }

        const blobResult = await heic2anyFn({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });

        const finalBlob = Array.isArray(blobResult)
          ? blobResult[0]
          : blobResult;
        normalizedFile = new File(
          [finalBlob],
          file.name.replace(/\.(heic|heif)$/i, ".jpg"),
          { type: "image/jpeg" },
        );
      } catch (err) {
        console.warn(
          "Conversión HEIC no disponible, usando archivo base:",
          err,
        );
      }
    }

    setStudioFile(normalizedFile);
    setIsStudioOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleStudioApprove(payloadFiles) {
    setUploadingImages(true);
    setError("");
    try {
      const filesArray = Array.isArray(payloadFiles)
        ? payloadFiles
        : [payloadFiles];
      if (filesArray.length === 0) return;

      const targetColor = activeColor || availableColors[0] || "Blanco";
      const uploadedEntries = [];

      for (let i = 0; i < filesArray.length; i++) {
        const fileToUpload = filesArray[i];
        const uploaded = await uploadProductImage(fileToUpload);
        uploadedEntries.push({
          color: targetColor,
          image_url: uploaded.url,
          is_cover: false,
          display_order: colorImages.length + i,
        });
      }

      // Si este color no tenía portada, asignar la primera subida como portada
      const hasCover = colorImages.some(
        (ci) =>
          ci.color.toLowerCase() === targetColor.toLowerCase() && ci.is_cover,
      );

      if (!hasCover && uploadedEntries.length > 0) {
        uploadedEntries[0].is_cover = true;
      }

      const firstUploadedUrl = uploadedEntries[0]?.image_url;

      setColorImages((prev) => [...prev, ...uploadedEntries]);
      if (firstUploadedUrl) {
        setActiveImage(firstUploadedUrl);
      }

      // Actualizar main_image_url si el producto carecía de imagen
      if (!form.main_image_url && firstUploadedUrl) {
        setForm((prev) => ({ ...prev, main_image_url: firstUploadedUrl }));
      }

      // Sincronizar variantes locales del color activo
      if (firstUploadedUrl) {
        setVariants((prev) =>
          prev.map((v) =>
            v.color.toLowerCase() === targetColor.toLowerCase()
              ? { ...v, image_url: v.image_url || firstUploadedUrl }
              : v,
          ),
        );
      }

      showToast(
        filesArray.length > 1
          ? `${filesArray.length} fotografías sincronizadas en la variante ${targetColor}.`
          : `Fotografía sincronizada en la variante ${targetColor}.`,
      );
    } catch (err) {
      setError(err.message || "Error al subir las fotografías.");
      throw err;
    } finally {
      setUploadingImages(false);
    }
  }

  // Dual-Cover 1: Portada Global de Catálogo con Reordenamiento Dinámico
  function handleSetGlobalCover(targetImageUrl) {
    if (!targetImageUrl) return;
    setForm((prev) => ({ ...prev, main_image_url: targetImageUrl }));

    const foundImage = colorImages.find(
      (img) => img.image_url === targetImageUrl,
    );
    const targetColor = foundImage?.color || activeColor;

    if (targetColor) {
      setActiveColor(targetColor);

      // Reordenar variants para que targetColor esté en el índice 0
      setVariants((prev) => {
        const matching = prev.filter(
          (v) => v.color.toLowerCase() === targetColor.toLowerCase(),
        );
        const others = prev.filter(
          (v) => v.color.toLowerCase() !== targetColor.toLowerCase(),
        );
        return [...matching, ...others];
      });
    }

    showToast("Foto establecida como Portada de Catálogo y variantes reordenadas.");
  }

  function confirmDeleteActiveImage() {
    handleRemoveColorImage(activeImage);
    setDeleteImageModalOpen(false);
  }

  // Dual-Cover 2: Portada del Color Activo
  function handleSetColorCover(targetImageUrl) {
    if (!activeColor || !targetImageUrl) return;

    setColorImages((prev) =>
      prev.map((img) => {
        if (img.color.toLowerCase() === activeColor.toLowerCase()) {
          return {
            ...img,
            is_cover: img.image_url === targetImageUrl,
          };
        }
        return img;
      }),
    );

    // Sincronizar variantes locales del color activo
    setVariants((prev) =>
      prev.map((v) =>
        v.color.toLowerCase() === activeColor.toLowerCase()
          ? { ...v, image_url: targetImageUrl }
          : v,
      ),
    );

    showToast(`Portada de variante ${activeColor} actualizada.`);
  }

  // Eliminación de fotografía
  function handleRemoveColorImage(urlToRemove) {
    if (!urlToRemove) return;

    setColorImages((prev) => prev.filter((img) => img.image_url !== urlToRemove));

    if (form.main_image_url === urlToRemove) {
      const remaining = colorImages.filter(
        (img) => img.image_url !== urlToRemove,
      );
      setForm((prev) => ({
        ...prev,
        main_image_url: remaining[0]?.image_url || "",
      }));
    }

    if (activeImage === urlToRemove) {
      const remainingInColor = activeColorImages.filter(
        (img) => img.image_url !== urlToRemove,
      );
      setActiveImage(remainingInColor[0]?.image_url || "");
    }

    showToast("Fotografía eliminada.");
  }

  // Reasignación de Color al Soltar (Drag & Drop Nativo)
  function handleDropImageToColor(imageUrl, targetColor) {
    if (!imageUrl || !targetColor) return;

    setColorImages((prev) =>
      prev.map((img) =>
        img.image_url === imageUrl ? { ...img, color: targetColor } : img,
      ),
    );

    setActiveColor(targetColor);
    setActiveImage(imageUrl);
    showToast(`Foto reasignada a la variante ${targetColor}.`);
  }

  function buildPayload() {
    const allGalleryUrls = colorImages.map((ci) => ci.image_url);
    const main = form.main_image_url || allGalleryUrls[0];

    if (!main) {
      throw new Error(
        "Debes cargar al menos una imagen y definir la imagen principal.",
      );
    }

    if (
      !form.category_id ||
      !form.material_id ||
      !form.brand_id ||
      !form.name.trim() ||
      !form.description.trim() ||
      Number(form.price) <= 0
    ) {
      throw new Error(
        "Completa los campos obligatorios del producto (incluyendo Categoría, Marca y Material).",
      );
    }

    if (!form.slug.trim()) {
      throw new Error("El slug es obligatorio.");
    }

    const seenComposite = new Set();
    const seenSkus = new Set();
    const cleanVariants = [];

    for (const variant of variants) {
      if (variant.is_active === false) continue;

      const color = (variant.color || "").trim();
      const sku = (variant.sku || "").trim();
      const sizeId = Number(variant.size_id);

      if (!color || !sku || !sizeId) continue;

      const compositeKey = `${sizeId}-${color.toLowerCase()}`;
      if (seenComposite.has(compositeKey)) continue;
      seenComposite.add(compositeKey);

      const normalizedSku = sku.toUpperCase();
      if (seenSkus.has(normalizedSku)) {
        throw new Error(`El código SKU "${sku}" está duplicado en la matriz.`);
      }
      seenSkus.add(normalizedSku);

      cleanVariants.push({
        ...(variant.id != null ? { id: variant.id } : {}),
        size_id: sizeId,
        color,
        color_hex: variant.color_hex || "#000000",
        stock: Math.max(0, Number(variant.stock) || 0),
        sku,
        image_url: variant.image_url || null,
        is_active: true,
      });
    }

    if (cleanVariants.length === 0) {
      throw new Error(
        "Debes registrar al menos una variante activa (color y talla) con SKU válido.",
      );
    }

    return {
      category_id: Number(form.category_id),
      material_id: Number(form.material_id),
      brand_id: Number(form.brand_id),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      main_image_url: main,
      gallery_urls: allGalleryUrls,
      has_size_guide: Boolean(form.has_size_guide),
      is_featured: Boolean(form.is_featured),
      is_active: Boolean(form.is_active),
      target_gender: form.target_gender,
      variants: cleanVariants,
      color_images: colorImages.map((ci, idx) => ({
        color: ci.color.trim(),
        image_url: ci.image_url,
        is_cover: Boolean(ci.is_cover),
        display_order: ci.display_order ?? idx,
      })),
    };
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (editing) await updateProduct(id, payload);
      else await createProduct(payload);

      invalidateCatalogCache();
      setIsSuccessModalOpen(true);
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-card border border-border rounded-card p-6">
        <p className="text-sm text-brand-secondary">Cargando formulario...</p>
      </div>
    );
  }

  const isCurrentGlobalCover =
    Boolean(activeImage) && activeImage === form.main_image_url;
  const isCurrentColorCover = activeColorImages.some(
    (img) => img.image_url === activeImage && img.is_cover,
  );

  return (
    <form onSubmit={submit} className="pb-12">
      {/* A. Barra Superior Pegada al Techo */}
      <div className="-mx-6 -mt-6 mb-6 px-6 py-3 border-b border-border bg-white/95 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-4">
        {/* Izquierda: Botón Volver (type="button") */}
        <Button
          onClick={() => navigate("/admin/productos")}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Productos
        </Button>

        {/* Centro: Configuración Rápida */}
        <div className="flex items-center gap-6">
          <Check
            checked={form.is_active}
            label="Activo"
            onChange={(v) => update("is_active", v)}
          />
          <Check
            checked={form.is_featured}
            label="Destacado"
            onChange={(v) => update("is_featured", v)}
          />
          <Check
            checked={form.has_size_guide}
            label="Mostrar guía de tallas"
            onChange={(v) => update("has_size_guide", v)}
          />
        </div>

        {/* Derecha: Acciones (Solo Guardar es type="submit") */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/admin/productos")}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={saving}
            className="bg-accent hover:bg-accent-hover text-white font-bold shadow-sm px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 mr-1" />
            Guardar producto
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-button border border-status-danger-border bg-status-danger-bg text-status-danger-text text-sm">
          {error}
        </div>
      )}

      {/* B. Contenedor de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 1. Columna Izquierda - Galería & Multimedia por Color */}
        <div className="lg:col-span-5 space-y-4">
          {activeColorImages.length === 0 ? (
            /* Estado Vacío de la Variante Activa */
            <div
              onClick={() => openPhotoModal(activeColor)}
              className="aspect-[4/5] w-full border-2 border-dashed border-border hover:border-brand-primary rounded-card bg-surface-subtle flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors p-6 text-slate-400 hover:text-brand-primary"
            >
              <ImagePlus className="w-10 h-10 stroke-[1.5]" />
              <p className="text-xs font-bold text-center">
                Subir foto para {activeColor || "esta variante"}
              </p>
            </div>
          ) : (
            <>
              {/* Foto Principal Activa del Color (Ratio 4:5) */}
              <div className="relative aspect-[4/5] w-full bg-slate-50 border border-border rounded-card overflow-hidden flex items-center justify-center p-3">
                {activeImage ? (
                  <>
                    <img
                      src={activeImage}
                      alt={form.name || "Prenda"}
                      className="w-full h-full object-contain"
                    />

                    {/* Controles Superiores: Sistema Dual-Cover y Eliminar (type="button") */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Portada Global del Producto */}
                        <button
                          type="button"
                          onClick={() => handleSetGlobalCover(activeImage)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold shadow-xs transition-colors ${
                            isCurrentGlobalCover
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs font-semibold"
                          }`}
                          title={
                            isCurrentGlobalCover
                              ? "Foto de portada global en catálogo"
                              : "Establecer como portada global de catálogo"
                          }
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isCurrentGlobalCover ? "fill-current" : ""
                            }`}
                          />
                          <span>
                            {isCurrentGlobalCover
                              ? "Portada de Catálogo"
                              : "Marcar Catálogo"}
                          </span>
                        </button>

                        {/* Portada de Color */}
                        <button
                          type="button"
                          onClick={() => handleSetColorCover(activeImage)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold shadow-xs transition-colors ${
                            isCurrentColorCover
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs font-semibold"
                          }`}
                          title={`Portada asignada a las variantes de color ${activeColor}`}
                        >
                          <Shirt className="w-3.5 h-3.5" />
                          <span>
                            {isCurrentColorCover
                              ? "Portada de Color"
                              : "Marcar Color"}
                          </span>
                        </button>
                      </div>

                      {/* Barra de Herramientas: Descargar y Eliminar */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadImage(
                              activeImage,
                              `erxidi-${form.slug || "producto"}-${activeColor}.jpg`,
                            )
                          }
                          className="w-8 h-8 rounded bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors backdrop-blur-xs"
                          title="Descargar imagen en resolución original"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteImageModalOpen(true)}
                          title="Eliminar esta fotografía"
                          className="w-8 h-8 rounded bg-black/50 hover:bg-rose-600 text-white flex items-center justify-center transition-colors backdrop-blur-xs shadow-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => openPhotoModal(activeColor)}
                    className="flex flex-col items-center justify-center text-center p-6 cursor-pointer text-brand-muted hover:text-brand-primary transition-colors"
                  >
                    <ImagePlus className="w-8 h-8 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold">
                      Selecciona una foto para previsualizar
                    </p>
                  </div>
                )}
              </div>

              {/* Tira de Miniaturas con Drag & Drop Nativo */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {activeColorImages.map((img) => {
                  const isSelected = img.image_url === activeImage;
                  const isGlobalCover =
                    img.image_url === form.main_image_url;
                  const isColorCover = img.is_cover;

                  return (
                    <div
                      key={img.image_url}
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", img.image_url);
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onClick={() => setActiveImage(img.image_url)}
                      className={`aspect-[4/5] w-16 rounded-button border overflow-hidden cursor-grab active:cursor-grabbing relative bg-slate-50 transition-all ${
                        isSelected
                          ? "border-brand-primary ring-2 ring-brand-primary/20 scale-105"
                          : "border-border hover:border-brand-primary/50"
                      }`}
                      title="Arrastra esta foto a otra pastilla de color para reasignarla"
                    >
                      <img
                        src={img.image_url}
                        alt="Miniatura de color"
                        className="w-full h-full object-contain p-0.5"
                      />

                      {/* Badge de Portada Global */}
                      {isGlobalCover && (
                        <span
                          className="absolute top-0.5 left-0.5 bg-amber-500 text-white p-0.5 rounded-xs shadow-xs"
                          title="Portada de Catálogo"
                        >
                          <Star className="w-2.5 h-2.5 fill-current" />
                        </span>
                      )}

                      {/* Badge de Portada de Color */}
                      {isColorCover && (
                        <span
                          className="absolute bottom-0.5 right-0.5 bg-blue-600 text-white p-0.5 rounded-xs shadow-xs"
                          title="Portada de este color"
                        >
                          <Shirt className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Botón Subir Foto para añadir ángulos al color activo */}
                <button
                  type="button"
                  onClick={() => openPhotoModal(activeColor)}
                  className="aspect-[4/5] w-16 rounded-button border-2 border-dashed border-border hover:border-brand-primary bg-surface-subtle flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-brand-primary transition-colors shrink-0"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[9px] font-semibold leading-tight text-center">
                    {uploadingImages ? "Subiendo..." : "Subir foto"}
                  </span>
                </button>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        {/* 2. Columna Derecha - Información y Controles */}
        <div className="lg:col-span-7 space-y-5 bg-surface-card border border-border rounded-card p-5 shadow-xs">
          {/* Fila de Selectores: 1. Público Objetivo | 2. Categoría / Tipo | 3. Material | 4. Marca */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Público Objetivo
              </span>
              <select
                value={form.target_gender}
                onChange={(e) => handleGenderChange(e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-button bg-surface-subtle text-xs font-semibold text-brand-primary focus:outline-none focus:border-brand-primary"
              >
                {[
                  { value: "hombre", label: "Hombres" },
                  { value: "mujer", label: "Mujeres" },
                  { value: "nino", label: "Niños" },
                  { value: "nina", label: "Niñas" },
                ].map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Categoría / Tipo
              </span>
              <select
                required
                value={form.category_id}
                onChange={(e) => update("category_id", e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-button bg-surface-subtle text-xs font-semibold text-brand-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="">Categoría...</option>
                {filteredCategoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Material
              </span>
              <select
                required
                value={form.material_id}
                onChange={(e) => update("material_id", e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-button bg-surface-subtle text-xs font-semibold text-brand-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="">Material...</option>
                {deps.materials.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                Marca
              </span>
              <select
                required
                value={form.brand_id}
                onChange={(e) => update("brand_id", e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-button bg-surface-subtle text-xs font-semibold text-brand-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="">Marca...</option>
                {(deps.brands || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Título y Slug con Ancho Holgado sin Superposición del Lápiz */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Nombre de la prenda
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej. Bóxer Clásico Pima Esencial"
                className="w-full text-xl font-black text-brand-primary bg-transparent border-b border-border/60 focus:border-brand-primary outline-none py-1 pr-7"
              />
              <Pencil
                className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1"
                title="Campo editable"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-1 flex-wrap">
              <span className="shrink-0 text-slate-400">erxidi.pe/producto/</span>
              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-border/80 rounded-button px-2.5 py-1">
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => update("slug", slugify(e.target.value))}
                  style={{
                    width: `${Math.max(18, (form.slug || "").length + 4)}ch`,
                  }}
                  className="bg-transparent text-xs font-mono text-brand-primary focus:outline-none"
                  placeholder="slug-del-producto"
                />
                <Pencil
                  className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none"
                  title="Slug editable"
                />
              </div>
            </div>
          </div>

          {/* Precio con Restricción de Decimales y Formato Blur */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Precio (S/)
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.price}
              onChange={(e) => handlePriceChange(e.target.value)}
              onBlur={handlePriceBlur}
              placeholder="0.00"
              className="text-lg font-black font-mono w-32 h-10 px-3 border border-border rounded-button text-brand-primary focus:outline-none focus:border-brand-primary"
            />
          </div>

          {/* Descripción con Asistencia IA, Modo Vista Previa y Textarea Auto-Expandible */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Descripción de la prenda
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isEnhancing}
                  onClick={() => handleEnhanceText("redaccion")}
                  className="border border-accent/40 bg-accent/5 text-accent hover:bg-accent/10 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
                  title="Mejora la ortografía y persuasión del texto"
                >
                  {isEnhancing && enhancingMode === "redaccion" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>Mejorando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mejorar redacción</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isEnhancing}
                  onClick={() => handleEnhanceText("estructura")}
                  className="border border-border bg-surface-subtle text-brand-primary hover:border-brand-primary/40 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
                  title="Convierte la descripción en lista de características comerciales"
                >
                  {isEnhancing && enhancingMode === "estructura" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>Mejorando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mejorar estructura</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewMode((prev) => !prev)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-2 py-1 rounded border border-border bg-white"
                  title="Alternar entre edición y vista previa de catálogo"
                >
                  {isPreviewMode ? (
                    <Pencil className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{isPreviewMode ? "Editar texto" : "Vista previa"}</span>
                </button>

                {previousDescription !== null &&
                  previousDescription !== form.description && (
                    <button
                      type="button"
                      onClick={() => {
                        update("description", previousDescription);
                        setPreviousDescription(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors ml-1"
                      title="Revertir al texto anterior a la mejora de IA"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Deshacer</span>
                    </button>
                  )}
              </div>
            </div>

            {!isPreviewMode ? (
              <textarea
                ref={textareaRef}
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className={`w-full px-3.5 py-2.5 border border-border rounded-button text-xs leading-relaxed min-h-[140px] resize-y transition-colors focus:border-brand-primary focus:outline-none ${
                  isEnhancing
                    ? "ring-2 ring-accent/30 bg-amber-50/20 animate-pulse border-accent"
                    : ""
                }`}
                placeholder="Detalles de confección, suavidad y calce..."
              />
            ) : (
              <div className="min-h-[90px] p-3.5 bg-slate-50 border border-border rounded-button text-xs leading-relaxed text-brand-secondary space-y-1.5">
                {form.description ? (
                  form.description.split("\n").map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith("•") || trimmed.startsWith("*")) {
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-1">
                          <span className="text-accent font-bold">•</span>
                          <span>
                            {trimmed
                              .replace(/^[•*]\s*/, "")
                              .replace(/\*\*/g, "")}
                          </span>
                        </div>
                      );
                    }
                    return <p key={idx}>{trimmed.replace(/\*\*/g, "")}</p>;
                  })
                ) : (
                  <p className="text-slate-400 italic">
                    Sin descripción redactada...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Divisor y Módulo de Variantes */}
          <hr className="border-border my-2" />

          <VariantMatrix
            sizes={deps.sizes}
            variants={variants}
            targetGender={form.target_gender}
            activeColor={activeColor}
            onActiveColorChange={setActiveColor}
            onDropImageToColor={handleDropImageToColor}
            onChange={setVariants}
          />
        </div>
      </div>

      {/* Modal de Confirmación: Desvincular Fotografía */}
      {deleteImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white rounded-card p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-brand-primary">
                  ¿Desvincular fotografía de la variante?
                </h3>
                <p className="text-xs text-brand-secondary mt-1 leading-relaxed">
                  Esta imagen se retirará de la galería del color {activeColor} y
                  no estará disponible para sus variantes.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteImageModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={confirmDeleteActiveImage}
              >
                Eliminar fotografía
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal B2B de Éxito al Guardar */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white rounded-card p-6 shadow-2xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-brand-primary">
              Producto guardado exitosamente
            </h3>
            <p className="text-xs text-brand-secondary leading-relaxed">
              Las variantes, stock y galería por color se sincronizaron con la base de datos.
            </p>
            <div className="flex items-center justify-center gap-3 pt-4 mt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSuccessModalOpen(false)}
              >
                Seguir editando
              </Button>
              <Button
                type="button"
                className="bg-brand-primary text-white font-bold"
                onClick={() => navigate("/admin/productos")}
              >
                Volver a productos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Estudio Fotográfico IA (2 Etapas con Imagen 3) */}
      <AiPhotoStudioModal
        isOpen={isStudioOpen}
        file={studioFile}
        categoryName={
          deps.categories.find(
            (c) => String(c.id) === String(form.category_id),
          )?.name || ""
        }
        colorName={activeColor}
        onClose={() => {
          setIsStudioOpen(false);
          setStudioFile(null);
        }}
        onApprove={handleStudioApprove}
      />

      {/* Toast Flotante Amigable de Notificaciones IA */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-button bg-brand-primary text-white text-xs font-semibold shadow-xl border border-brand-primary/20 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </form>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-brand-primary cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}
