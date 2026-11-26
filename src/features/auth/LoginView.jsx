import React, { useState, useEffect, useMemo } from "react";
import * as RouterDom from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  Card,
  CardContent,
} from "../../components/ui/Card";
import { lookupDni } from "../../services/api/dniService";
import {
  Mail,
  MailCheck,
  ShieldAlert,
  Search,
  Check,
  AlertCircle,
  ShieldCheck,
  Send,
  ArrowLeft,
} from "lucide-react";

function evaluatePasswordRules(password = "") {
  const val = String(password);
  const rules = [
    {
      id: "length",
      label: "Mínimo 8 caracteres",
      passed: val.length >= 8,
    },
    {
      id: "upper",
      label: "Al menos una letra mayúscula (A-Z)",
      passed: /[A-Z]/.test(val),
    },
    {
      id: "lower",
      label: "Al menos una letra minúscula (a-z)",
      passed: /[a-z]/.test(val),
    },
    {
      id: "number",
      label: "Al menos un número (0-9)",
      passed: /\d/.test(val),
    },
    {
      id: "special",
      label: "Al menos un carácter especial (!@#$%^&*._-)",
      passed: /[^A-Za-z0-9]/.test(val),
    },
  ];

  const passedCount = rules.filter((r) => r.passed).length;
  const isAllValid = passedCount === rules.length;

  return { rules, passedCount, isAllValid };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailNotConfirmedError(error) {
  return Boolean(error?.message?.toLowerCase().includes("email not confirmed"));
}

export default function LoginView() {
  const [searchParams] = RouterDom.useSearchParams();
  const initialTab =
    searchParams.get("tab") === "register" ? "register" : "login";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { signIn, signUp, resendConfirmationEmail } = useAuth();
  const navigate = RouterDom.useNavigate();
  const location = RouterDom.useLocation();

  // Pantalla de enlace de confirmación enviado: { email } | null
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(() => {
    const email = location.state?.pendingVerificationEmail;
    return email ? { email } : null;
  });
  const [unconfirmedLoginEmail, setUnconfirmedLoginEmail] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResendingLink, setIsResendingLink] = useState(false);
  const [resendFeedback, setResendFeedback] = useState(null);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timerId = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timerId);
  }, [resendCooldown]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "register") {
      setActiveTab("register");
    } else if (tabParam === "login") {
      setActiveTab("login");
    }
  }, [searchParams]);

  const redirectPath = location.state?.from?.pathname || "/catalogo";

  // -------------------------------------------------------------
  // ESTADO: INICIAR SESIÓN
  // -------------------------------------------------------------
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // -------------------------------------------------------------
  // ESTADO: CREAR CUENTA
  // -------------------------------------------------------------
  const [dni, setDni] = useState("");
  const [firstName, setFirstName] = useState("");
  const [paternalSurname, setPaternalSurname] = useState("");
  const [maternalSurname, setMaternalSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [isDniLocked, setIsDniLocked] = useState(false);
  const [dniFeedback, setDniFeedback] = useState(null);

  const [registerError, setRegisterError] = useState(null);
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const passwordCheck = useMemo(
    () => evaluatePasswordRules(registerPassword),
    [registerPassword]
  );

  const passwordsMatch =
    confirmPassword.length > 0 && registerPassword === confirmPassword;

  // Consulta de DNI mediante Decolecta / RENIEC
  const handleDniLookup = async (dniToSearch = dni) => {
    const cleanDni = String(dniToSearch || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (cleanDni.length !== 8) {
      setDniFeedback({
        type: "error",
        message: "El DNI debe contener 8 dígitos numéricos.",
      });
      setIsDniLocked(false);
      return;
    }

    setIsSearchingDni(true);
    setDniFeedback(null);

    try {
      const res = await lookupDni(cleanDni);
      if (res.success && res.names) {
        setFirstName(res.names);
        setPaternalSurname(res.firstLastName || "");
        setMaternalSurname(res.secondLastName || "");
        setIsDniLocked(true);
        setDniFeedback({
          type: "success",
          message: "Identidad verificada exitosamente en RENIEC.",
        });
      } else {
        setIsDniLocked(false);
        setDniFeedback({
          type: "info",
          message:
            "No se pudieron obtener los datos. Completa tus nombres manualmente.",
        });
      }
    } catch {
      setIsDniLocked(false);
      setDniFeedback({
        type: "info",
        message:
          "Servicio de consulta no disponible. Ingresa tus datos manualmente.",
      });
    } finally {
      setIsSearchingDni(false);
    }
  };

  const handleDniChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 8);
    setDni(rawVal);
    setDniFeedback(null);
    setIsDniLocked(false);

    if (rawVal.length === 8) {
      handleDniLookup(rawVal);
    }
  };

  // Destino post-autenticación según el rol del perfil
  async function resolveDestination(userId) {
    let dest = redirectPath;
    if (dest === "/catalogo" || dest === "/") {
      const uid = userId || (await supabase.auth.getUser()).data?.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (prof?.role === "delivery") {
          dest = "/reparto";
        } else if (prof?.role === "owner") {
          dest = "/admin";
        }
      }
    }
    return dest;
  }

  async function handleManualResendLink(targetEmail) {
    const email = String(targetEmail || "").trim();
    if (!email || resendCooldown > 0 || isResendingLink) return;
    setIsResendingLink(true);
    setResendFeedback(null);
    try {
      const { error } = await resendConfirmationEmail(email);
      if (error) throw error;
      setResendCooldown(60);
      setResendFeedback({
        type: "success",
        message:
          "Enlace de confirmación reenviado. Revisa tu bandeja de entrada o carpeta de spam.",
      });
    } catch (err) {
      setResendFeedback({
        type: "error",
        message:
          err?.message ||
          "No se pudo reenviar el enlace. Inténtalo nuevamente en unos segundos.",
      });
    } finally {
      setIsResendingLink(false);
    }
  }

  function handleBackFromConfirmation() {
    if (confirmationEmailSent?.email) {
      setLoginEmail(confirmationEmailSent.email);
    }
    setConfirmationEmailSent(null);
    setResendFeedback(null);
    setActiveTab("login");
  }

  // Submit Login
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError(null);
    setUnconfirmedLoginEmail(null);
    setResendFeedback(null);
    setLoginLoading(true);

    try {
      const email = loginEmail.trim();
      const { data: authData, error } = await signIn(email, loginPassword);
      if (error) {
        if (isEmailNotConfirmedError(error)) {
          setUnconfirmedLoginEmail(email);
          setLoginError(
            "Tu correo aún no ha sido confirmado. Abre el enlace de confirmación que te enviamos por correo electrónico (revisa también spam).",
          );
          return;
        }
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("El correo o la contraseña son incorrectos.");
        }
        throw error;
      }

      navigate(await resolveDestination(authData?.user?.id), {
        replace: true,
      });
    } catch (err) {
      setLoginError(
        err.message || "No se pudo iniciar sesión. Verifica tus datos."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // Restablecer contraseña
  async function handleResetPassword(e) {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim()) {
      setLoginError("Ingresa tu correo para enviarte el enlace.");
      return;
    }

    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        loginEmail.trim(),
        {
          redirectTo: "https://erxidi-web.vercel.app/actualizar-password",
        }
      );
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err) {
      setLoginError(
        err.message || "No se pudo enviar el enlace de recuperación."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // Submit Registro
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccessMessage(null);

    if (dni && dni.replace(/\D/g, "").length !== 8) {
      setRegisterError("El DNI debe contener exactamente 8 dígitos.");
      return;
    }
    if (!firstName.trim() || !paternalSurname.trim()) {
      setRegisterError("Por favor ingresa tu nombre y apellido paterno.");
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith("9")) {
      setRegisterError(
        "El teléfono celular debe ser peruano y tener 9 dígitos (inicia con 9)."
      );
      return;
    }
    if (!EMAIL_REGEX.test(registerEmail.trim())) {
      setRegisterError("Ingresa un correo electrónico válido.");
      return;
    }
    if (!passwordCheck.isAllValid) {
      setRegisterError(
        "La contraseña aún no cumple con todos los requisitos de seguridad."
      );
      return;
    }
    if (registerPassword !== confirmPassword) {
      setRegisterError("Las contraseñas ingresadas no coinciden.");
      return;
    }

    setRegisterLoading(true);

    const metadata = {
      first_name: firstName.trim(),
      paternal_surname: paternalSurname.trim(),
      maternal_surname: maternalSurname.trim(),
      dni: dni.trim() || null,
      phone: cleanPhone,
    };

    try {
      const email = registerEmail.trim();
      const { data, error } = await signUp(email, registerPassword, metadata);

      if (error) {
        if (error.message?.includes("User already registered")) {
          throw new Error(
            "Este correo electrónico ya está registrado. Inicia sesión."
          );
        }
        throw error;
      }

      // Supabase devuelve identities vacías cuando el correo ya está confirmado.
      if (data?.user?.identities?.length === 0) {
        throw new Error(
          "Este correo electrónico ya está registrado. Inicia sesión."
        );
      }

      // Sesión inmediata (confirmación de correo desactivada en el proyecto).
      if (data?.session) {
        navigate(await resolveDestination(data.user?.id), { replace: true });
        return;
      }

      // Registro pendiente de confirmación mediante enlace nativo de Supabase.
      if (data?.user) {
        setConfirmationEmailSent({ email });
        setResendCooldown(60);
        setResendFeedback(null);
        return;
      }

      throw new Error("No se pudo completar el registro. Intenta nuevamente.");
    } catch (err) {
      setRegisterError(err.message || "Ocurrió un error al crear la cuenta.");
    } finally {
      setRegisterLoading(false);
    }
  }

  if (confirmationEmailSent) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 py-10">
        <Card className="max-w-md w-full">
          <CardContent className="pt-2 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border text-brand-primary flex items-center justify-center mx-auto">
              <MailCheck className="w-6 h-6 text-accent" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-brand-primary">
                Revisa tu correo electrónico
              </h2>
              <p className="text-xs text-brand-secondary leading-relaxed">
                Hemos enviado un enlace de confirmación a{" "}
                <span className="font-semibold text-brand-primary break-all">
                  {confirmationEmailSent.email}
                </span>
                . Haz clic en el botón del correo para activar tu cuenta e
                ingresar automáticamente a ERXIDI.
              </p>
            </div>

            {resendFeedback && (
              <div
                className={`p-3 rounded-button border text-xs text-left ${
                  resendFeedback.type === "success"
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-status-danger-bg border-status-danger-border text-status-danger-text"
                }`}
              >
                {resendFeedback.message}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resendCooldown > 0 || isResendingLink}
                isLoading={isResendingLink}
                onClick={() =>
                  handleManualResendLink(confirmationEmailSent.email)
                }
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {resendCooldown > 0
                  ? `Reenviar enlace en ${resendCooldown}s`
                  : "Reenviar enlace de confirmación"}
              </Button>

              <button
                type="button"
                onClick={handleBackFromConfirmation}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-brand-secondary hover:text-brand-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Ir a Iniciar Sesión
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 py-10">
      <Card className="max-w-md w-full">
        {/* Pestañas Conmutables */}
        <div className="grid grid-cols-2 border-b border-border text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              setLoginError(null);
            }}
            className={
              "py-3 text-center transition-colors " +
              (activeTab === "login"
                ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
                : "text-brand-muted hover:text-brand-primary bg-surface-subtle")
            }
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setRegisterError(null);
            }}
            className={
              "py-3 text-center transition-colors " +
              (activeTab === "register"
                ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
                : "text-brand-muted hover:text-brand-primary bg-surface-subtle")
            }
          >
            Crear Cuenta
          </button>
        </div>

        <CardContent className="pt-5">
          <div className="transition-[max-height,opacity] duration-500 ease-in-out overflow-hidden">
            {/* ========================================================= */}
            {/* TAB 1: INICIAR SESIÓN */}
            {/* ========================================================= */}
            {activeTab === "login" && (
              <div className="space-y-4">
                {loginError && (
                  <div className="bg-rose-50 border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs space-y-2.5">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                    {unconfirmedLoginEmail && (
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resendCooldown > 0 || isResendingLink}
                          isLoading={isResendingLink}
                          onClick={() =>
                            handleManualResendLink(unconfirmedLoginEmail)
                          }
                          className="w-full text-xs border-status-danger-border text-status-danger-text hover:bg-rose-100"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {resendCooldown > 0
                            ? `Reenviar enlace en ${resendCooldown}s`
                            : "Reenviar enlace de confirmación"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {resendFeedback && (
                  <div
                    className={`p-3 rounded-button border text-xs ${
                      resendFeedback.type === "success"
                        ? "bg-status-success-bg border-status-success-border text-status-success-text"
                        : "bg-status-danger-bg border-status-danger-border text-status-danger-text"
                    }`}
                  >
                    {resendFeedback.message}
                  </div>
                )}

                <form
                  onSubmit={
                    forgotPasswordMode ? handleResetPassword : handleLoginSubmit
                  }
                  className="space-y-4"
                >
                  <Input
                    label="Correo Electrónico"
                    type="email"
                    placeholder="usuario@erxidi.pe"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  {!forgotPasswordMode && (
                    <Input
                      label="Contraseña"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  )}

                  {forgotPasswordMode && resetEmailSent && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-button text-xs flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Se ha enviado un enlace de recuperación a tu correo.
                        Revisa también tu bandeja de spam.
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-2 bg-accent hover:bg-accent-hover text-white"
                    isLoading={loginLoading}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {forgotPasswordMode
                      ? "Enviar Enlace"
                      : "Ingresar a mi Cuenta"}
                  </Button>

                  {!forgotPasswordMode && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setForgotPasswordMode(true)}
                        className="text-xs text-brand-secondary hover:text-brand-primary hover:underline transition-colors focus:outline-none"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  )}

                  {forgotPasswordMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(false);
                        setResetEmailSent(false);
                        setLoginError(null);
                      }}
                      className="w-full text-center text-xs font-medium text-brand-secondary hover:text-brand-primary"
                    >
                      Volver a iniciar sesión
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: CREAR CUENTA (Con Checklist de Contraseña Reactivo) */}
            {/* ========================================================= */}
            {activeTab === "register" && (
              <div className="space-y-4">
                {registerSuccessMessage ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-card space-y-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-emerald-900">
                      ¡Cuenta creada exitosamente!
                    </h3>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {registerSuccessMessage}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRegisterSuccessMessage(null);
                        setActiveTab("login");
                      }}
                      className="mt-2 text-xs"
                    >
                      Ir a Iniciar Sesión
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                    {registerError && (
                      <div className="bg-rose-50 border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{registerError}</span>
                      </div>
                    )}

                    {/* Búsqueda de DNI */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="reg-dni"
                          className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                        >
                          DNI (8 dígitos) - Opcional
                        </label>
                        {isSearchingDni && (
                          <span className="text-[11px] text-accent flex items-center gap-1 font-semibold">
                            Consultando RENIEC...
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <Input
                            id="reg-dni"
                            type="text"
                            inputMode="numeric"
                            placeholder="8 dígitos (opcional)"
                            maxLength={8}
                            value={dni}
                            onChange={handleDniChange}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleDniLookup();
                              }
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          onClick={() => handleDniLookup()}
                          disabled={isSearchingDni || dni.length !== 8}
                          className="h-10 px-3.5 shrink-0"
                          title="Buscar en RENIEC"
                        >
                          <Search className="w-4 h-4 text-brand-primary" />
                        </Button>
                      </div>

                      {dniFeedback && (
                        <div
                          className={
                            "mt-1.5 text-xs flex items-center gap-1.5 " +
                            (dniFeedback.type === "success"
                              ? "text-emerald-600 font-medium"
                              : "text-amber-600")
                          }
                        >
                          {dniFeedback.type === "success" ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{dniFeedback.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Nombres y Apellidos */}
                    <div className="space-y-3">
                      <label
                        htmlFor="reg-names"
                        className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                      >
                        Nombres
                      </label>
                      <Input
                        id="reg-names"
                        placeholder="Nombres completos"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        readOnly={isDniLocked}
                        className={
                          isDniLocked
                            ? "bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                            : ""
                        }
                        required
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label="Ap. Paterno"
                          id="reg-paternal"
                          placeholder="Paterno"
                          value={paternalSurname}
                          onChange={(e) => setPaternalSurname(e.target.value)}
                          readOnly={isDniLocked}
                          className={
                            isDniLocked
                              ? "bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                              : ""
                          }
                          required
                        />
                        <Input
                          label="Ap. Materno"
                          id="reg-maternal"
                          placeholder="Materno"
                          value={maternalSurname}
                          onChange={(e) => setMaternalSurname(e.target.value)}
                          readOnly={isDniLocked}
                          className={
                            isDniLocked
                              ? "bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                              : ""
                          }
                        />
                      </div>
                    </div>

                    <Input
                      label="Teléfono Celular"
                      id="reg-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="9XXXXXXXX"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      required
                    />

                    <Input
                      label="Correo Electrónico"
                      id="reg-email"
                      type="email"
                      placeholder="tu.correo@ejemplo.pe"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                    />

                    {/* Contraseñas con Validación Interactiva */}
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          label="Contraseña"
                          id="reg-pass"
                          type="password"
                          placeholder="Crea una clave segura"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                        <Input
                          label="Confirmar"
                          id="reg-confirm-pass"
                          type="password"
                          placeholder="Repite contraseña"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>

                      {/* Panel Dinámico de Cumplimiento de Contraseña */}
                      <div className="p-3 rounded-card bg-surface-subtle border border-border space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-brand-secondary flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                            Seguridad de la contraseña
                          </span>
                          <span className="font-mono font-bold text-brand-primary">
                            {passwordCheck.passedCount}/5 reglas
                          </span>
                        </div>

                        {/* Barra de progreso segmentada */}
                        <div className="grid grid-cols-5 gap-1 h-1.5">
                          {[1, 2, 3, 4, 5].map((step) => {
                            const active = passwordCheck.passedCount >= step;
                            const barColor =
                              passwordCheck.passedCount <= 2
                                ? "bg-rose-500"
                                : passwordCheck.passedCount <= 4
                                  ? "bg-amber-500"
                                  : "bg-emerald-600";
                            return (
                              <div
                                key={step}
                                className={
                                  "rounded-full transition-all duration-200 " +
                                  (active ? barColor : "bg-slate-200")
                                }
                              />
                            );
                          })}
                        </div>

                        <ul className="space-y-1 text-[11px]">
                          {passwordCheck.rules.map((rule) => (
                            <li
                              key={rule.id}
                              className={
                                "flex items-center gap-1.5 transition-colors " +
                                (rule.passed
                                  ? "text-emerald-700 font-semibold"
                                  : registerPassword.length > 0
                                    ? "text-rose-600"
                                    : "text-brand-muted")
                              }
                            >
                              {rule.passed ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-current inline-flex items-center justify-center text-[9px] shrink-0">
                                  •
                                </span>
                              )}
                              <span>{rule.label}</span>
                            </li>
                          ))}

                          {confirmPassword.length > 0 && (
                            <li
                              className={
                                "flex items-center gap-1.5 pt-1 border-t border-border/60 font-semibold " +
                                (passwordsMatch
                                  ? "text-emerald-700"
                                  : "text-rose-600")
                              }
                            >
                              {passwordsMatch ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              )}
                              <span>
                                {passwordsMatch
                                  ? "Las contraseñas coinciden"
                                  : "Las contraseñas aún no coinciden"}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={
                        registerLoading ||
                        !passwordCheck.isAllValid ||
                        !passwordsMatch
                      }
                      className="w-full mt-3 bg-accent hover:bg-accent-hover text-white"
                      isLoading={registerLoading}
                    >
                      Registrar Cuenta
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}