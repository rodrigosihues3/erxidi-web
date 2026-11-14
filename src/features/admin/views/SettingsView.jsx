import { useEffect, useState, useRef } from "react";
import {
    Building2,
    CreditCard,
    Clock,
    MapPin,
    Save,
    Search,
    Plus,
    Trash2,
    AlertTriangle,
    Power,
    CheckCircle2,
    QrCode,
    RefreshCw,
    Upload,
    Loader2,
    Smartphone,
    Snowflake,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import {
    getAllStoreSettings,
    updateStoreSetting,
    updatePaymentSettings,
    updateEmergencySettings,
    updateBusinessHours,
    uploadPaymentQr,
    queryRucDecolecta,
} from "../services/adminSettings.service";
import { cropQrCode } from "../utils/qrCropper";
import CoverageSettingsView from "./CoverageSettingsView";

const DAYS_MAP = [
    { key: "1", label: "Lunes" },
    { key: "2", label: "Martes" },
    { key: "3", label: "Miércoles" },
    { key: "4", label: "Jueves" },
    { key: "5", label: "Viernes" },
    { key: "6", label: "Sábado" },
    { key: "0", label: "Domingo" },
];

export default function SettingsView() {
    const [activeTab, setActiveTab] = useState("identity"); // 'identity' | 'payments' | 'hours' | 'coverage'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchingRuc, setSearchingRuc] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });

    // Estados de datos
    const [identity, setIdentity] = useState({
        ruc: "",
        legal_name: "",
        commercial_name: "",
        support_phone: "",
    });

    const [paymentMethods, setPaymentMethods] = useState({
        bank_accounts: [],
        digital_wallets: { yape_number: "", plin_number: "", holder_name: "" },
        yape_enabled: true,
        yape_qr_url: null,
        yape_phone: "",
        yape_holder_name: "",
        plin_enabled: false,
        plin_qr_url: null,
        plin_phone: "",
        plin_holder_name: "",
    });

    const [yapeFileBlob, setYapeFileBlob] = useState(null);
    const [yapePreview, setYapePreview] = useState(null);
    const [isProcessingYapeQr, setIsProcessingYapeQr] = useState(false);
    const yapeInputRef = useRef(null);

    const [plinFileBlob, setPlinFileBlob] = useState(null);
    const [plinPreview, setPlinPreview] = useState(null);
    const [isProcessingPlinQr, setIsProcessingPlinQr] = useState(false);
    const plinInputRef = useRef(null);

    const [businessHours, setBusinessHours] = useState({});
    const [emergencySettings, setEmergencySettings] = useState({
        store_closed: false,
        pause_express: false,
        pause_scheduled: false,
        pause_pickup: false,
    });
    const [savingEmergency, setSavingEmergency] = useState(false);
    const [savingHours, setSavingHours] = useState(false);
    const [seasonalSnowEnabled, setSeasonalSnowEnabled] = useState(true);
    const [savingSnow, setSavingSnow] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await getAllStoreSettings();
                if (!active) return;
                setIdentity(data.identity);
                setPaymentMethods({
                    bank_accounts: data.paymentMethods.bank_accounts || [],
                    digital_wallets: data.paymentMethods.digital_wallets || { yape_number: "", plin_number: "", holder_name: "" },
                    yape_enabled: data.paymentMethods.yape_enabled ?? true,
                    yape_qr_url: data.paymentMethods.yape_qr_url || null,
                    yape_phone: data.paymentMethods.yape_phone || data.paymentMethods.digital_wallets?.yape_number || "",
                    yape_holder_name: data.paymentMethods.yape_holder_name || data.paymentMethods.digital_wallets?.holder_name || "",
                    plin_enabled: data.paymentMethods.plin_enabled ?? false,
                    plin_qr_url: data.paymentMethods.plin_qr_url || null,
                    plin_phone: data.paymentMethods.plin_phone || data.paymentMethods.digital_wallets?.plin_number || "",
                    plin_holder_name: data.paymentMethods.plin_holder_name || data.paymentMethods.digital_wallets?.holder_name || "",
                });
                setBusinessHours(data.businessHours || {});
                setEmergencySettings({
                    store_closed: Boolean(data.emergencyFlags?.store_closed ?? data.emergencyFlags?.close_store_today ?? false),
                    pause_express: Boolean(data.emergencyFlags?.pause_express ?? data.emergencyFlags?.pause_express_only ?? false),
                    pause_scheduled: Boolean(data.emergencyFlags?.pause_scheduled ?? false),
                    pause_pickup: Boolean(data.emergencyFlags?.pause_pickup ?? false),
                });
                setSeasonalSnowEnabled(data.seasonalSnowEnabled ?? true);
            } catch (err) {
                if (active) setStatusMessage({ type: "error", text: err.message || "Error al cargar configuraciones." });
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (yapePreview && yapePreview.startsWith("blob:")) {
                URL.revokeObjectURL(yapePreview);
            }
            if (plinPreview && plinPreview.startsWith("blob:")) {
                URL.revokeObjectURL(plinPreview);
            }
        };
    }, [yapePreview, plinPreview]);

    const handleYapeFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingYapeQr(true);
        setStatusMessage({ type: "", text: "" });

        try {
            const { blob, previewUrl } = await cropQrCode(file);
            setYapeFileBlob(blob);
            setYapePreview(previewUrl);
            setPaymentMethods((prev) => ({
                ...prev,
                yape_qr_url: previewUrl,
            }));
        } catch {
            setStatusMessage({
                type: "error",
                text: "No se pudo detectar el código QR automáticamente. Sube una captura más clara.",
            });
        } finally {
            setIsProcessingYapeQr(false);
            if (yapeInputRef.current) yapeInputRef.current.value = "";
        }
    };

    const handleRemoveYapeQr = () => {
        if (yapePreview && yapePreview.startsWith("blob:")) {
            URL.revokeObjectURL(yapePreview);
        }
        setYapeFileBlob(null);
        setYapePreview(null);
        setPaymentMethods((prev) => ({
            ...prev,
            yape_qr_url: null,
        }));
        if (yapeInputRef.current) yapeInputRef.current.value = "";
    };

    const handlePlinFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingPlinQr(true);
        setStatusMessage({ type: "", text: "" });

        try {
            const { blob, previewUrl } = await cropQrCode(file);
            setPlinFileBlob(blob);
            setPlinPreview(previewUrl);
            setPaymentMethods((prev) => ({
                ...prev,
                plin_qr_url: previewUrl,
            }));
        } catch {
            setStatusMessage({
                type: "error",
                text: "No se pudo detectar el código QR automáticamente. Sube una captura más clara.",
            });
        } finally {
            setIsProcessingPlinQr(false);
            if (plinInputRef.current) plinInputRef.current.value = "";
        }
    };

    const handleRemovePlinQr = () => {
        if (plinPreview && plinPreview.startsWith("blob:")) {
            URL.revokeObjectURL(plinPreview);
        }
        setPlinFileBlob(null);
        setPlinPreview(null);
        setPaymentMethods((prev) => ({
            ...prev,
            plin_qr_url: null,
        }));
        if (plinInputRef.current) plinInputRef.current.value = "";
    };

    const handleSearchRuc = async () => {
        if (!identity.ruc || identity.ruc.length !== 11) {
            setStatusMessage({ type: "error", text: "Ingresa un RUC válido de 11 dígitos." });
            return;
        }

        setSearchingRuc(true);
        setStatusMessage({ type: "", text: "" });

        const result = await queryRucDecolecta(identity.ruc);
        setSearchingRuc(false);

        if (result.success && result.legal_name) {
            setIdentity((prev) => ({ ...prev, legal_name: result.legal_name }));
            setStatusMessage({ type: "success", text: "Razón Social autocompletada desde el padrón." });
        } else {
            setStatusMessage({ type: "warning", text: result.message });
        }
    };

    const handleToggleSeasonalSnow = async () => {
        const nextEnabled = !seasonalSnowEnabled;
        setSavingSnow(true);
        setStatusMessage({ type: "", text: "" });
        try {
            await updateStoreSetting("seasonal_snow", { enabled: nextEnabled });
            setSeasonalSnowEnabled(nextEnabled);
            setStatusMessage({
                type: "success",
                text: nextEnabled
                    ? "Efecto de nieve activado en la tienda pública."
                    : "Efecto de nieve desactivado en la tienda pública.",
            });
        } catch (err) {
            setStatusMessage({
                type: "error",
                text: err.message || "Error al actualizar el efecto de nieve.",
            });
        } finally {
            setSavingSnow(false);
        }
    };

    const handleSaveIdentity = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMessage({ type: "", text: "" });
        try {
            await updateStoreSetting("business_identity", identity);
            setStatusMessage({ type: "success", text: "Datos fiscales actualizados correctamente." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar identidad." });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePayments = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMessage({ type: "", text: "" });
        try {
            let finalYapeQrUrl = paymentMethods.yape_qr_url;
            let finalPlinQrUrl = paymentMethods.plin_qr_url;

            // Subir blob de QR de Yape a Supabase Storage si se generó uno nuevo
            if (yapeFileBlob) {
                finalYapeQrUrl = await uploadPaymentQr(yapeFileBlob, "yape");
            }

            // Subir blob de QR de Plin a Supabase Storage si se generó uno nuevo
            if (plinFileBlob) {
                finalPlinQrUrl = await uploadPaymentQr(plinFileBlob, "plin");
            }

            const payload = {
                yape_enabled: Boolean(paymentMethods.yape_enabled),
                yape_phone: paymentMethods.yape_phone?.trim() || null,
                yape_holder_name: paymentMethods.yape_holder_name?.trim() || null,
                yape_qr_url: finalYapeQrUrl,
                plin_enabled: Boolean(paymentMethods.plin_enabled),
                plin_phone: paymentMethods.plin_phone?.trim() || null,
                plin_holder_name: paymentMethods.plin_holder_name?.trim() || null,
                plin_qr_url: finalPlinQrUrl,
                bank_accounts: paymentMethods.bank_accounts,
                value: {
                    bank_accounts: paymentMethods.bank_accounts,
                    digital_wallets: {
                        yape_number: paymentMethods.yape_phone?.trim() || "",
                        plin_number: paymentMethods.plin_phone?.trim() || "",
                        holder_name: paymentMethods.yape_holder_name?.trim() || paymentMethods.plin_holder_name?.trim() || "",
                    },
                    yape_enabled: Boolean(paymentMethods.yape_enabled),
                    plin_enabled: Boolean(paymentMethods.plin_enabled),
                    yape_qr_url: finalYapeQrUrl,
                    plin_qr_url: finalPlinQrUrl,
                },
            };

            await updatePaymentSettings(payload);

            setPaymentMethods((prev) => ({
                ...prev,
                yape_enabled: Boolean(paymentMethods.yape_enabled),
                plin_enabled: Boolean(paymentMethods.plin_enabled),
                yape_qr_url: finalYapeQrUrl,
                plin_qr_url: finalPlinQrUrl,
            }));
            setYapeFileBlob(null);
            setPlinFileBlob(null);
            setYapePreview(null);
            setPlinPreview(null);

            setStatusMessage({ type: "success", text: "Configuración de pagos guardada con éxito." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar métodos de pago." });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEmergency = async (e) => {
        if (e) e.preventDefault();
        setSavingEmergency(true);
        setStatusMessage({ type: "", text: "" });
        try {
            await updateEmergencySettings(emergencySettings);
            setStatusMessage({ type: "success", text: "Interruptores de emergencia actualizados correctamente." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar interruptores de emergencia." });
        } finally {
            setSavingEmergency(false);
        }
    };

    const handleSaveHours = async (e) => {
        if (e) e.preventDefault();
        setSavingHours(true);
        setStatusMessage({ type: "", text: "" });
        try {
            await updateBusinessHours(businessHours);
            setStatusMessage({ type: "success", text: "Horarios de atención actualizados correctamente." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar horarios de atención." });
        } finally {
            setSavingHours(false);
        }
    };

    const addBankAccount = () => {
        setPaymentMethods((prev) => ({
            ...prev,
            bank_accounts: [
                ...prev.bank_accounts,
                { bank: "BCP", account_number: "", cci: "", holder_name: identity.legal_name || "ERXIDI" },
            ],
        }));
    };

    const removeBankAccount = (index) => {
        setPaymentMethods((prev) => ({
            ...prev,
            bank_accounts: prev.bank_accounts.filter((_, i) => i !== index),
        }));
    };

    const updateBankAccount = (index, field, value) => {
        setPaymentMethods((prev) => {
            const updated = [...prev.bank_accounts];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, bank_accounts: updated };
        });
    };

    if (loading) {
        return (
            <Card className="p-8 text-center text-xs text-brand-secondary">
                Cargando ajustes operativos de la tienda...
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl uppercase tracking-wider font-black text-brand-primary">Ajustes del Negocio</h1>
            </div>

            {statusMessage.text && (
                <div
                    className={`p-3 rounded-button text-xs flex items-center gap-2 ${statusMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : statusMessage.type === "warning"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                >
                    {statusMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Selector de Pestañas */}
            <div className="flex flex-wrap border-b border-border gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab("identity")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === "identity"
                        ? "border-brand-primary text-brand-primary"
                        : "border-transparent text-brand-secondary hover:text-brand-primary"
                        }`}
                >
                    <Building2 className="w-4 h-4" />
                    Identidad Fiscal y Contacto
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("payments")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === "payments"
                        ? "border-brand-primary text-brand-primary"
                        : "border-transparent text-brand-secondary hover:text-brand-primary"
                        }`}
                >
                    <CreditCard className="w-4 h-4" />
                    Cuentas y Métodos de Pago
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("hours")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === "hours"
                        ? "border-brand-primary text-brand-primary"
                        : "border-transparent text-brand-secondary hover:text-brand-primary"
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Horarios y Operatividad
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("coverage")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === "coverage"
                        ? "border-brand-primary text-brand-primary"
                        : "border-transparent text-brand-secondary hover:text-brand-primary"
                        }`}
                >
                    <MapPin className="w-4 h-4" />
                    Zona de Cobertura y Tarifas
                </button>
            </div>

            {/* PESTAÑA 1: IDENTIDAD FISCAL */}
            {activeTab === "identity" && (
                <div className="space-y-6 max-w-2xl">
                    <form onSubmit={handleSaveIdentity} className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Datos de Facturación y Contacto</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1">
                                        RUC
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={identity.ruc}
                                            onChange={(e) => setIdentity({ ...identity, ruc: e.target.value })}
                                            placeholder="20601234567"
                                            maxLength={11}
                                            required
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleSearchRuc}
                                            isLoading={searchingRuc}
                                            className="shrink-0 text-xs"
                                        >
                                            <Search className="w-3.5 h-3.5 mr-1" />
                                            Consultar Decolecta
                                        </Button>
                                    </div>
                                </div>

                                <Input
                                    label="Razón Social (Editable)"
                                    value={identity.legal_name}
                                    onChange={(e) => setIdentity({ ...identity, legal_name: e.target.value })}
                                    required
                                />

                                <Input
                                    label="Nombre Comercial"
                                    value={identity.commercial_name}
                                    onChange={(e) => setIdentity({ ...identity, commercial_name: e.target.value })}
                                    required
                                />

                                <Input
                                    label="Teléfono / WhatsApp de Soporte"
                                    value={identity.support_phone}
                                    onChange={(e) => setIdentity({ ...identity, support_phone: e.target.value })}
                                    placeholder="+51987654321"
                                    required
                                />

                                <div className="pt-2">
                                    <Button type="submit" isLoading={saving}>
                                        <Save className="w-4 h-4 mr-2" /> Guardar Identidad
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Snowflake className="w-4 h-4 text-brand-secondary" />
                                Efectos de Temporada
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between gap-4 p-3.5 rounded-card border border-border bg-surface-subtle">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-brand-primary">
                                        Nieve ambiental en tienda pública
                                    </p>
                                    <p className="text-[11px] text-brand-secondary leading-snug">
                                        Muestra u oculta el efecto sutil de nieve en el catálogo sin afectar el panel admin ni reparto.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant={seasonalSnowEnabled ? "primary" : "outline"}
                                    onClick={handleToggleSeasonalSnow}
                                    isLoading={savingSnow}
                                    aria-pressed={seasonalSnowEnabled}
                                    className="shrink-0 text-xs"
                                >
                                    {seasonalSnowEnabled ? "Desactivar" : "Activar"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* PESTAÑA 2: CUENTAS BANCARIAS */}
            {activeTab === "payments" && (
                <form onSubmit={handleSavePayments} className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Cuentas Bancarias para Transferencias</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addBankAccount} className="text-xs">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Cuenta
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {paymentMethods.bank_accounts.length === 0 ? (
                                <p className="text-xs text-brand-secondary">No hay cuentas bancarias registradas.</p>
                            ) : (
                                paymentMethods.bank_accounts.map((acc, index) => (
                                    <div key={index} className="p-3 border border-border rounded-lg space-y-3 bg-surface-subtle">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-brand-primary">Cuenta #{index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeBankAccount(index)}
                                                className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-brand-secondary mb-1">Banco</label>
                                                <select
                                                    value={acc.bank}
                                                    onChange={(e) => updateBankAccount(index, "bank", e.target.value)}
                                                    className="w-full h-10 px-2 text-xs border border-border rounded-button bg-white"
                                                >
                                                    <option value="BCP">BCP</option>
                                                    <option value="Interbank">Interbank</option>
                                                    <option value="BBVA">BBVA</option>
                                                    <option value="Scotiabank">Scotiabank</option>
                                                    <option value="Banco de la Nación">Banco de la Nación</option>
                                                </select>
                                            </div>

                                            <Input
                                                label="Número de Cuenta"
                                                value={acc.account_number}
                                                onChange={(e) => updateBankAccount(index, "account_number", e.target.value)}
                                                required
                                            />

                                            <Input
                                                label="Código CCI"
                                                value={acc.cci}
                                                onChange={(e) => updateBankAccount(index, "cci", e.target.value)}
                                                required
                                            />

                                            <Input
                                                label="Titular de la Cuenta"
                                                value={acc.holder_name}
                                                onChange={(e) => updateBankAccount(index, "holder_name", e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Tarjeta Yape */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-brand-primary" />
                                <div>
                                    <CardTitle>Billetera Digital Yape</CardTitle>
                                    <p className="text-xs text-brand-secondary mt-0.5">
                                        Gestiona el número receptor, titular y código QR con recorte automático 1:1.
                                    </p>
                                </div>
                            </div>

                            {/* Switch de activación Yape */}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={paymentMethods.yape_enabled}
                                onClick={() =>
                                    setPaymentMethods((prev) => ({
                                        ...prev,
                                        yape_enabled: !prev.yape_enabled,
                                    }))
                                }
                                className="flex items-center gap-2.5 focus:outline-none cursor-pointer"
                            >
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                                        paymentMethods.yape_enabled
                                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                            : "text-slate-500 bg-slate-100 border-slate-200"
                                    }`}
                                >
                                    {paymentMethods.yape_enabled ? "Activo" : "Inactivo"}
                                </span>
                                <div
                                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                                        paymentMethods.yape_enabled ? "bg-emerald-600" : "bg-slate-300"
                                    }`}
                                >
                                    <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                            paymentMethods.yape_enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </div>
                            </button>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`transition-opacity duration-200 ${
                                    !paymentMethods.yape_enabled ? "opacity-50 pointer-events-none" : ""
                                }`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    <div className="md:col-span-7 space-y-4">
                                        <Input
                                            label="Teléfono de Yape"
                                            placeholder="987654321"
                                            value={paymentMethods.yape_phone || ""}
                                            onChange={(e) =>
                                                setPaymentMethods({
                                                    ...paymentMethods,
                                                    yape_phone: e.target.value,
                                                })
                                            }
                                            className="font-mono"
                                        />
                                        <Input
                                            label="Nombre del Titular"
                                            placeholder="Ej: ERXIDI S.A.C."
                                            value={paymentMethods.yape_holder_name || ""}
                                            onChange={(e) =>
                                                setPaymentMethods({
                                                    ...paymentMethods,
                                                    yape_holder_name: e.target.value,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="md:col-span-5 flex flex-col items-center">
                                        <span className="block text-xs font-semibold text-brand-secondary mb-2 self-start md:self-center">
                                            Código QR de Yape (1:1)
                                        </span>
                                        <div className="aspect-square w-40 h-40 object-contain rounded-card border border-border p-2 bg-white relative overflow-hidden flex flex-col items-center justify-center">
                                            {isProcessingYapeQr ? (
                                                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-3 text-center space-y-2 z-10">
                                                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                                                    <span className="text-[11px] font-semibold text-brand-secondary">
                                                        Detectando y recortando código QR...
                                                    </span>
                                                </div>
                                            ) : paymentMethods.yape_qr_url ? (
                                                <img
                                                    src={yapePreview || paymentMethods.yape_qr_url}
                                                    alt="Código QR Yape"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <label className="w-full h-full flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-surface-subtle transition-colors text-center group">
                                                    <Upload className="w-7 h-7 text-brand-secondary group-hover:text-brand-primary mb-1.5 transition-colors" />
                                                    <span className="text-xs font-bold text-brand-primary">
                                                        Subir QR de Yape
                                                    </span>
                                                    <span className="text-[10px] text-brand-secondary mt-0.5">
                                                        Afiche o captura (Autorecorte 1:1)
                                                    </span>
                                                    <input
                                                        ref={yapeInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleYapeFileSelect}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>

                                        {paymentMethods.yape_qr_url && !isProcessingYapeQr && (
                                            <div className="flex items-center gap-2 mt-2.5">
                                                <input
                                                    ref={yapeInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleYapeFileSelect}
                                                    className="hidden"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => yapeInputRef.current?.click()}
                                                    className="text-xs"
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1" /> Cambiar QR
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleRemoveYapeQr}
                                                    className="text-xs text-rose-600 hover:text-rose-700 hover:border-rose-300"
                                                >
                                                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar QR
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tarjeta Plin */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-brand-primary" />
                                <div>
                                    <CardTitle>Billetera Digital Plin</CardTitle>
                                    <p className="text-xs text-brand-secondary mt-0.5">
                                        Habilita o deshabilita la recepción de pagos vía Plin (QR opcional).
                                    </p>
                                </div>
                            </div>

                            {/* Switch de activación Plin */}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={paymentMethods.plin_enabled}
                                onClick={() =>
                                    setPaymentMethods((prev) => ({
                                        ...prev,
                                        plin_enabled: !prev.plin_enabled,
                                    }))
                                }
                                className="flex items-center gap-2.5 focus:outline-none cursor-pointer"
                            >
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                                        paymentMethods.plin_enabled
                                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                            : "text-slate-500 bg-slate-100 border-slate-200"
                                    }`}
                                >
                                    {paymentMethods.plin_enabled ? "Activo" : "Inactivo"}
                                </span>
                                <div
                                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                                        paymentMethods.plin_enabled ? "bg-emerald-600" : "bg-slate-300"
                                    }`}
                                >
                                    <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                            paymentMethods.plin_enabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </div>
                            </button>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`transition-opacity duration-200 ${
                                    !paymentMethods.plin_enabled ? "opacity-50 pointer-events-none" : ""
                                }`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    <div className="md:col-span-7 space-y-4">
                                        <Input
                                            label="Teléfono de Plin"
                                            placeholder="987654321"
                                            value={paymentMethods.plin_phone || ""}
                                            onChange={(e) =>
                                                setPaymentMethods({
                                                    ...paymentMethods,
                                                    plin_phone: e.target.value,
                                                })
                                            }
                                            className="font-mono"
                                        />
                                        <Input
                                            label="Nombre del Titular"
                                            placeholder="Ej: ERXIDI S.A.C."
                                            value={paymentMethods.plin_holder_name || ""}
                                            onChange={(e) =>
                                                setPaymentMethods({
                                                    ...paymentMethods,
                                                    plin_holder_name: e.target.value,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="md:col-span-5 flex flex-col items-center">
                                        <span className="block text-xs font-semibold text-brand-secondary mb-2 self-start md:self-center">
                                            Código QR de Plin (Opcional, 1:1)
                                        </span>
                                        <div className="aspect-square w-40 h-40 object-contain rounded-card border border-border p-2 bg-white relative overflow-hidden flex flex-col items-center justify-center">
                                            {isProcessingPlinQr ? (
                                                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-3 text-center space-y-2 z-10">
                                                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                                                    <span className="text-[11px] font-semibold text-brand-secondary">
                                                        Detectando y recortando código QR...
                                                    </span>
                                                </div>
                                            ) : paymentMethods.plin_qr_url ? (
                                                <img
                                                    src={plinPreview || paymentMethods.plin_qr_url}
                                                    alt="Código QR Plin"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <label className="w-full h-full flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-surface-subtle transition-colors text-center group">
                                                    <Upload className="w-7 h-7 text-brand-secondary group-hover:text-brand-primary mb-1.5 transition-colors" />
                                                    <span className="text-xs font-bold text-brand-primary">
                                                        Subir QR de Plin
                                                    </span>
                                                    <span className="text-[10px] text-brand-secondary mt-0.5">
                                                        Opcional (Autorecorte 1:1)
                                                    </span>
                                                    <input
                                                        ref={plinInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handlePlinFileSelect}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>

                                        {paymentMethods.plin_qr_url && !isProcessingPlinQr && (
                                            <div className="flex items-center gap-2 mt-2.5">
                                                <input
                                                    ref={plinInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePlinFileSelect}
                                                    className="hidden"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => plinInputRef.current?.click()}
                                                    className="text-xs"
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1" /> Cambiar QR
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleRemovePlinQr}
                                                    className="text-xs text-rose-600 hover:text-rose-700 hover:border-rose-300"
                                                >
                                                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar QR
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="pt-2">
                        <Button type="submit" isLoading={saving}>
                            <Save className="w-4 h-4 mr-2" /> Guardar Métodos de Pago
                        </Button>
                    </div>
                </form>
            )}

            {/* PESTAÑA 3: HORARIOS Y OPERATIVIDAD */}
            {activeTab === "hours" && (
                <div className="space-y-6">
                    {/* BLOQUE 1: Horario de Atención Semanal */}
                    <form onSubmit={handleSaveHours}>
                        <Card>
                            <CardHeader className="border-b border-border pb-3">
                                <CardTitle className="text-sm font-bold text-brand-primary">
                                    Horario de Atención Semanal (Hora de Lima)
                                </CardTitle>
                                <p className="text-xs text-brand-secondary mt-0.5">
                                    Configura los rangos de atención y corte de recepción express para cada día.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-4">
                                <div className="divide-y divide-border">
                                    {DAYS_MAP.map(({ key, label }) => {
                                        const day = businessHours[key] || {
                                            enabled: false,
                                            open: "09:00",
                                            close: "18:00",
                                            express_cutoff: "17:00",
                                        };

                                        return (
                                            <div key={key} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                <label className="flex items-center gap-2 sm:w-32 cursor-pointer font-bold text-brand-primary">
                                                    <input
                                                        type="checkbox"
                                                        checked={day.enabled}
                                                        onChange={(e) =>
                                                            setBusinessHours({
                                                                ...businessHours,
                                                                [key]: { ...day, enabled: e.target.checked },
                                                            })
                                                        }
                                                        className="h-4 w-4 rounded border-border"
                                                    />
                                                    <span>{label}</span>
                                                </label>

                                                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-brand-secondary">Apertura:</span>
                                                        <input
                                                            type="time"
                                                            disabled={!day.enabled}
                                                            value={day.open}
                                                            onChange={(e) =>
                                                                setBusinessHours({
                                                                    ...businessHours,
                                                                    [key]: { ...day, open: e.target.value },
                                                                })
                                                            }
                                                            className="h-8 px-2 border border-border rounded text-xs disabled:opacity-40"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-brand-secondary">Cierre:</span>
                                                        <input
                                                            type="time"
                                                            disabled={!day.enabled}
                                                            value={day.close}
                                                            onChange={(e) =>
                                                                setBusinessHours({
                                                                    ...businessHours,
                                                                    [key]: { ...day, close: e.target.value },
                                                                })
                                                            }
                                                            className="h-8 px-2 border border-border rounded text-xs disabled:opacity-40"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-brand-secondary font-semibold text-accent">
                                                            Corte Express:
                                                        </span>
                                                        <input
                                                            type="time"
                                                            disabled={!day.enabled}
                                                            value={day.express_cutoff}
                                                            onChange={(e) =>
                                                                setBusinessHours({
                                                                    ...businessHours,
                                                                    [key]: { ...day, express_cutoff: e.target.value },
                                                                })
                                                            }
                                                            className="h-8 px-2 border border-accent/40 rounded text-xs disabled:opacity-40"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" isLoading={savingHours} disabled={savingHours}>
                                        {savingHours ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        Guardar Horarios de Atención
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>

                    {/* BLOQUE 2: Interruptores de Emergencia (Kill Switches) al final */}
                    <Card className="border-rose-200 bg-rose-50/20">
                        <CardHeader className="border-b border-rose-100 pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-rose-900 flex items-center gap-2 text-sm font-bold">
                                    <Power className="w-4 h-4 text-rose-600" /> Interruptores de Emergencia (Kill Switches)
                                </CardTitle>
                                <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                    Corte Inmediato
                                </span>
                            </div>
                            <p className="text-xs text-brand-secondary mt-1">
                                Control de alta prioridad para detener o restringir modalidades de venta en tiempo real.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {/* 1. Interruptor Maestro (Destructivo) */}
                            <label
                                className={`flex items-start gap-3 p-3.5 rounded-card border transition-all cursor-pointer ${
                                    emergencySettings.store_closed
                                        ? "border-rose-500 bg-rose-100/70 shadow-sm"
                                        : "border-rose-200 bg-white hover:border-rose-300"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={emergencySettings.store_closed}
                                    onChange={(e) =>
                                        setEmergencySettings((prev) => ({
                                            ...prev,
                                            store_closed: e.target.checked,
                                        }))
                                    }
                                    className="mt-1 h-4 w-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                                />
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-rose-800 block">
                                        Cerrar tienda por completo (Modo Emergencia / Vacaciones)
                                    </span>
                                    <span className="text-[11px] text-rose-700 block leading-snug">
                                        Bloquea inmediatamente la recepción de pedidos en cualquier modalidad en el checkout.
                                    </span>
                                </div>
                            </label>

                            {/* 2. Interruptores Modales (Banderas Operativas Secundarias) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                <label
                                    className={`flex items-start gap-3 p-3 rounded-card border transition-all cursor-pointer ${
                                        emergencySettings.pause_express
                                            ? "border-amber-400 bg-amber-50/80"
                                            : "border-border bg-white hover:border-border-strong"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={emergencySettings.pause_express}
                                        onChange={(e) =>
                                            setEmergencySettings((prev) => ({
                                                ...prev,
                                                pause_express: e.target.checked,
                                            }))
                                        }
                                        className="mt-1 h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold text-brand-primary block">
                                            Pausar únicamente Delivery Express
                                        </span>
                                        <span className="text-[11px] text-brand-secondary block leading-tight">
                                            Deshabilita envíos inmediatos en el día.
                                        </span>
                                    </div>
                                </label>

                                <label
                                    className={`flex items-start gap-3 p-3 rounded-card border transition-all cursor-pointer ${
                                        emergencySettings.pause_scheduled
                                            ? "border-amber-400 bg-amber-50/80"
                                            : "border-border bg-white hover:border-border-strong"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={emergencySettings.pause_scheduled}
                                        onChange={(e) =>
                                            setEmergencySettings((prev) => ({
                                                ...prev,
                                                pause_scheduled: e.target.checked,
                                            }))
                                        }
                                        className="mt-1 h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold text-brand-primary block">
                                            Pausar Delivery Programado
                                        </span>
                                        <span className="text-[11px] text-brand-secondary block leading-tight">
                                            Deshabilita envíos diferidos del día siguiente.
                                        </span>
                                    </div>
                                </label>

                                <label
                                    className={`flex items-start gap-3 p-3 rounded-card border transition-all cursor-pointer ${
                                        emergencySettings.pause_pickup
                                            ? "border-amber-400 bg-amber-50/80"
                                            : "border-border bg-white hover:border-border-strong"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={emergencySettings.pause_pickup}
                                        onChange={(e) =>
                                            setEmergencySettings((prev) => ({
                                                ...prev,
                                                pause_pickup: e.target.checked,
                                            }))
                                        }
                                        className="mt-1 h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold text-brand-primary block">
                                            Pausar Recojo en Tienda Física
                                        </span>
                                        <span className="text-[11px] text-brand-secondary block leading-tight">
                                            Deshabilita el retiro presencial en taller.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-2 flex justify-start">
                                <Button
                                    type="button"
                                    onClick={handleSaveEmergency}
                                    isLoading={savingEmergency}
                                    disabled={savingEmergency}
                                    className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
                                >
                                    {savingEmergency ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Guardar Interruptores de Emergencia
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* PESTAÑA 4: ZONA DE COBERTURA Y TARIFAS */}
            {activeTab === "coverage" && <CoverageSettingsView />}
        </div>
    );
}
