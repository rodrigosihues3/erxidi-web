import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import {
  User,
  Mail,
  Phone,
  Ruler,
  MapPin,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Package,
  Send,
  Lock,
  Save,
  KeyRound,
  Sparkles,
} from "lucide-react";
import SizePreferencesTab from "../profile/components/SizePreferencesTab";
import AddressesTab from "../profile/components/AddressesTab";

export default function ProfileView() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("personal"); // 'personal' | 'addresses' | 'measurements' | 'security'

  // ==========================================
  // PESTAÑA 1: DATOS PERSONALES Y CUENTA
  // ==========================================
  const initialPersonal = useMemo(() => {
    return {
      firstName: profile?.first_name || "",
      lastName:
        profile?.last_name ||
        [profile?.paternal_surname, profile?.maternal_surname]
          .filter(Boolean)
          .join(" ") ||
        "",
      dni: profile?.dni || profile?.document_number || "",
      phone: profile?.phone || "",
    };
  }, [profile]);

  const [firstName, setFirstName] = useState(initialPersonal.firstName);
  const [lastName, setLastName] = useState(initialPersonal.lastName);
  const [dni, setDni] = useState(initialPersonal.dni);
  const [phone, setPhone] = useState(initialPersonal.phone);

  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalFeedback, setPersonalFeedback] = useState(null);

  // Email verification y edición
  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Sincronizar formulario personal cuando profile cambia
  useEffect(() => {
    setFirstName(initialPersonal.firstName);
    setLastName(initialPersonal.lastName);
    setDni(initialPersonal.dni);
    setPhone(initialPersonal.phone);
  }, [initialPersonal]);

  const isDirtyPersonal = useMemo(() => {
    return (
      firstName.trim() !== initialPersonal.firstName.trim() ||
      lastName.trim() !== initialPersonal.lastName.trim() ||
      dni.trim() !== initialPersonal.dni.trim() ||
      phone.trim() !== initialPersonal.phone.trim()
    );
  }, [firstName, lastName, dni, phone, initialPersonal]);

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    if (!user || !isDirtyPersonal) return;

    setIsSavingPersonal(true);
    setPersonalFeedback(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          dni: dni.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
      setPersonalFeedback({
        type: "success",
        message: "Tus datos personales fueron actualizados correctamente.",
      });
    } catch (err) {
      setPersonalFeedback({
        type: "error",
        message: err.message || "Error al actualizar los datos personales.",
      });
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    setIsResendingEmail(true);
    setResendStatus(null);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) throw error;
      setResendStatus({
        type: "success",
        message:
          "Enlace de confirmación enviado. Revisa tu bandeja de entrada o spam.",
      });
    } catch (err) {
      setResendStatus({
        type: "error",
        message: err.message || "No se pudo reenviar el correo de confirmación.",
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || newEmail === user?.email) {
      setIsEditingEmail(false);
      return;
    }

    setIsUpdatingEmail(true);
    setResendStatus(null);
    setPersonalFeedback(null);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) throw error;

      setPersonalFeedback({
        type: "success",
        message:
          "Se ha enviado un enlace de confirmación a tu nuevo correo. Verifícalo para actualizar tu acceso y habilitar pago contra entrega.",
      });
      setIsEditingEmail(false);
    } catch (err) {
      setPersonalFeedback({
        type: "error",
        message: err.message || "Error al actualizar el correo electrónico.",
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // ==========================================
  // PESTAÑA 3: SEGURIDAD
  // ==========================================
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState(null);

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    setSecurityFeedback(null);

    if (newPassword.length < 6) {
      setSecurityFeedback({
        type: "error",
        message: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityFeedback({
        type: "error",
        message: "Las contraseñas no coinciden.",
      });
      return;
    }

    setIsSavingSecurity(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSecurityFeedback({
        type: "success",
        message: "Tu contraseña ha sido actualizada exitosamente.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setSecurityFeedback({
        type: "error",
        message: err.message || "Error al actualizar la contraseña.",
      });
    } finally {
      setIsSavingSecurity(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Mi Cuenta</h1>
          <p className="text-xs text-brand-secondary mt-1">
            Gestiona tus datos de identificación, medidas anatómicas y seguridad.
          </p>
        </div>

        <Link to="/mi-cuenta/pedidos">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Package className="w-4 h-4 text-accent" />
            Ver Mis Pedidos
          </Button>
        </Link>
      </div>

      {/* Navegación por Pestañas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border text-xs font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          className={`py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "personal"
              ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
              : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
          }`}
        >
          <User className="w-3.5 h-3.5 text-accent" />
          <span>Datos Personales</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("addresses")}
          className={`py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "addresses"
              ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
              : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-accent" />
          <span>Direcciones</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("measurements")}
          className={`py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "measurements"
              ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
              : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
          }`}
        >
          <Ruler className="w-3.5 h-3.5 text-accent" />
          <span>Medidas y Talla</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "security"
              ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
              : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-accent" />
          <span>Seguridad</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PESTAÑA 1: DATOS PERSONALES */}
      {/* ========================================================= */}
      {activeTab === "personal" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {personalFeedback && (
            <div
              className={`p-3.5 rounded-card border text-xs flex items-center gap-2 ${
                personalFeedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-status-danger-border text-status-danger-text"
              }`}
            >
              {personalFeedback.type === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{personalFeedback.message}</span>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" />
                  Información Personal y Contacto
                </CardTitle>
                {isEmailVerified ? (
                  <Badge variant="success" className="text-[11px]">
                    Correo Verificado
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-[11px]">
                    Pendiente de Verificación
                  </Badge>
                )}
              </div>
              <CardDescription>
                Tus datos de contacto y facturación registrados en la plataforma.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleSavePersonal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Nombres"
                    id="profile-firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <Input
                    label="Apellidos"
                    id="profile-lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Documento de Identidad (DNI)"
                    id="profile-dni"
                    value={dni}
                    maxLength={8}
                    placeholder="8 dígitos"
                    onChange={(e) =>
                      setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                  />
                  <Input
                    label="Teléfono Celular"
                    id="profile-phone"
                    type="tel"
                    maxLength={9}
                    placeholder="9XXXXXXXX"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                    }
                    helperText="Número para coordinación de entrega."
                    required
                  />
                </div>

                {/* Sección de Correo Electrónico */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                        Correo Electrónico
                      </label>
                      {!isEditingEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewEmail(user?.email || "");
                            setIsEditingEmail(true);
                          }}
                          className="text-xs text-accent hover:underline font-medium"
                        >
                          Cambiar correo
                        </button>
                      )}
                    </div>

                    {isEditingEmail ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          id="profile-new-email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Nuevo correo electrónico"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleUpdateEmail}
                          disabled={isUpdatingEmail || !newEmail.trim()}
                          isLoading={isUpdatingEmail}
                          className="h-10 px-4 flex-shrink-0 bg-accent hover:bg-accent-hover text-white"
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingEmail(false)}
                          className="h-10 px-3 flex-shrink-0"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="h-10 px-3 bg-surface-subtle border border-border rounded-button text-sm text-brand-primary flex items-center">
                        <Mail className="w-4 h-4 text-brand-muted mr-2" />
                        {user?.email}
                      </div>
                    )}
                  </div>

                  {!isEmailVerified && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <span>
                          Tu correo aún no está verificado. Verifica tu cuenta para
                          habilitar pedidos con pago contra entrega.
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendConfirmation}
                        disabled={isResendingEmail}
                        isLoading={isResendingEmail}
                        className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Reenviar Email
                      </Button>
                    </div>
                  )}

                  {resendStatus && (
                    <div
                      className={`p-2.5 rounded-button text-xs ${
                        resendStatus.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {resendStatus.message}
                    </div>
                  )}
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!isDirtyPersonal || isSavingPersonal}
                    isLoading={isSavingPersonal}
                    className="bg-accent hover:bg-accent-hover text-white px-6"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Datos Personales
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: DIRECCIONES */}
      {/* ========================================================= */}
      {activeTab === "addresses" && <AddressesTab />}

      {/* ========================================================= */}
      {/* PESTAÑA 3: MEDIDAS CORPORALES Y TALLA */}
      {/* ========================================================= */}
      {activeTab === "measurements" && <SizePreferencesTab />}

      {/* ========================================================= */}
      {/* PESTAÑA 4: SEGURIDAD */}
      {/* ========================================================= */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {securityFeedback && (
            <div
              className={`p-3.5 rounded-card border text-xs flex items-center gap-2 ${
                securityFeedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-status-danger-border text-status-danger-text"
              }`}
            >
              {securityFeedback.type === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{securityFeedback.message}</span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-accent" />
                Seguridad y Credenciales
              </CardTitle>
              <CardDescription>
                Actualiza tu contraseña para mantener tu cuenta protegida.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleSaveSecurity} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Nueva Contraseña"
                    id="profile-new-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />

                  <Input
                    label="Confirmar Nueva Contraseña"
                    id="profile-confirm-password"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isSavingSecurity || !newPassword || !confirmPassword}
                    isLoading={isSavingSecurity}
                    className="bg-accent hover:bg-accent-hover text-white px-6"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Actualizar Contraseña
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
