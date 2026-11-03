import { useEffect, useState } from "react";
import {
    Building2,
    CreditCard,
    Clock,
    Save,
    Search,
    Plus,
    Trash2,
    AlertTriangle,
    Power,
    CheckCircle2,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import {
    getAllStoreSettings,
    updateStoreSetting,
    queryRucDecolecta,
} from "../services/adminSettings.service";

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
    const [activeTab, setActiveTab] = useState("identity"); // 'identity' | 'payments' | 'hours'
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
    });

    const [businessHours, setBusinessHours] = useState({});
    const [emergencyFlags, setEmergencyFlags] = useState({
        close_store_today: false,
        pause_express_only: false,
        pause_reason: "",
    });

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await getAllStoreSettings();
                if (!active) return;
                setIdentity(data.identity);
                setPaymentMethods(data.paymentMethods);
                setBusinessHours(data.businessHours);
                setEmergencyFlags(data.emergencyFlags);
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
            await updateStoreSetting("payment_methods", paymentMethods);
            setStatusMessage({ type: "success", text: "Cuentas bancarias y billeteras actualizadas correctamente." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar métodos de pago." });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveHours = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMessage({ type: "", text: "" });
        try {
            await Promise.all([
                updateStoreSetting("business_hours", businessHours),
                updateStoreSetting("emergency_flags", emergencyFlags),
            ]);
            setStatusMessage({ type: "success", text: "Horarios y reglas operativas actualizadas correctamente." });
        } catch (err) {
            setStatusMessage({ type: "error", text: err.message || "Error al guardar horarios." });
        } finally {
            setSaving(false);
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
                <p className="text-xs uppercase tracking-wider text-brand-secondary font-bold">Configuración</p>
                <h1 className="text-2xl font-black text-brand-primary">Ajustes del Negocio</h1>
                <p className="text-xs text-brand-secondary mt-1">
                    Parámetros maestros sincronizados directamente con las validaciones del checkout y políticas de despacho.
                </p>
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
            <div className="flex border-b border-border space-x-2">
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
            </div>

            {/* PESTAÑA 1: IDENTIDAD FISCAL */}
            {activeTab === "identity" && (
                <form onSubmit={handleSaveIdentity} className="space-y-4 max-w-2xl">
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Billeteras Digitales (Yape / Plin)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Input
                                    label="Número Yape"
                                    value={paymentMethods.digital_wallets?.yape_number || ""}
                                    onChange={(e) =>
                                        setPaymentMethods({
                                            ...paymentMethods,
                                            digital_wallets: { ...paymentMethods.digital_wallets, yape_number: e.target.value },
                                        })
                                    }
                                />
                                <Input
                                    label="Número Plin"
                                    value={paymentMethods.digital_wallets?.plin_number || ""}
                                    onChange={(e) =>
                                        setPaymentMethods({
                                            ...paymentMethods,
                                            digital_wallets: { ...paymentMethods.digital_wallets, plin_number: e.target.value },
                                        })
                                    }
                                />
                                <Input
                                    label="Titular Visible"
                                    value={paymentMethods.digital_wallets?.holder_name || ""}
                                    onChange={(e) =>
                                        setPaymentMethods({
                                            ...paymentMethods,
                                            digital_wallets: { ...paymentMethods.digital_wallets, holder_name: e.target.value },
                                        })
                                    }
                                />
                            </div>

                            <div className="pt-4">
                                <Button type="submit" isLoading={saving}>
                                    <Save className="w-4 h-4 mr-2" /> Guardar Métodos de Pago
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            )}

            {/* PESTAÑA 3: HORARIOS Y OPERATIVIDAD */}
            {activeTab === "hours" && (
                <form onSubmit={handleSaveHours} className="space-y-6">
                    {/* Interruptores de Emergencia */}
                    <Card className="border-amber-300 bg-amber-50/40">
                        <CardHeader>
                            <CardTitle className="text-amber-900 flex items-center gap-2">
                                <Power className="w-4 h-4" /> Interruptores de Emergencia (Kill Switches)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-start gap-3 p-3 bg-white border border-border rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={emergencyFlags.close_store_today}
                                        onChange={(e) =>
                                            setEmergencyFlags({ ...emergencyFlags, close_store_today: e.target.checked })
                                        }
                                        className="mt-1 h-4 w-4 rounded border-border"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-rose-700 block">Cerrar tienda por hoy</span>
                                        <span className="text-[11px] text-brand-secondary">
                                            Bloquea de inmediato la recepción de cualquier orden en el checkout.
                                        </span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 bg-white border border-border rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={emergencyFlags.pause_express_only}
                                        onChange={(e) =>
                                            setEmergencyFlags({ ...emergencyFlags, pause_express_only: e.target.checked })
                                        }
                                        className="mt-1 h-4 w-4 rounded border-border"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-amber-700 block">Pausar únicamente Delivery Express</span>
                                        <span className="text-[11px] text-brand-secondary">
                                            Permite que los clientes sigan comprando con entrega programada al día siguiente.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            {emergencyFlags.pause_express_only && (
                                <Input
                                    label="Motivo visible para el cliente (Opcional)"
                                    placeholder="Ej: Suspensión temporal por condiciones climáticas adversas."
                                    value={emergencyFlags.pause_reason || ""}
                                    onChange={(e) => setEmergencyFlags({ ...emergencyFlags, pause_reason: e.target.value })}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Matriz Semanal */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Horario de Atención Semanal (Hora de Lima)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
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
                                <Button type="submit" isLoading={saving}>
                                    <Save className="w-4 h-4 mr-2" /> Guardar Horarios y Operatividad
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            )}
        </div>
    );
}