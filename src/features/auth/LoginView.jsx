import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { lookupDni } from "../../services/api/dniService";
import {
  Lock,
  Mail,
  ShieldAlert,
  UserCheck,
  Search,
  Check,
  AlertCircle,
  Phone,
  User,
  Info,
  Edit3,
} from "lucide-react";

export default function LoginView() {
  const [activeTab, setActiveTab] = useState("login"); // 'login' | 'register'
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Consulta de DNI mediante Decolecta / RENIEC
  const handleDniLookup = async (dniToSearch = dni) => {
    const cleanDni = String(dniToSearch || "").replace(/\D/g, "").slice(0, 8);
    if (!/^\d{8}$/.test(cleanDni)) {
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
          message: "No se pudieron obtener los datos. Completa tus nombres manualmente.",
        });
      }
    } catch (err) {
      setIsDniLocked(false);
      setDniFeedback({
        type: "info",
        message: "Servicio de consulta no disponible. Ingresa tus datos manualmente.",
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

  // Submit Login
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const { error } = await signIn(loginEmail.trim(), loginPassword);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("El correo o la contraseña son incorrectos.");
        }
        if (!error.message.toLowerCase().includes("email not confirmed")) {
          throw error;
        }
      }
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setLoginError(err.message || "No se pudo iniciar sesión. Verifica tus datos.");
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
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: `${window.location.origin}/actualizar-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err) {
      setLoginError(err.message || "No se pudo enviar el enlace de recuperación.");
    } finally {
      setLoginLoading(false);
    }
  }

  // Submit Registro
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccessMessage(null);

    // Validaciones
    if (dni && !/^\d{8}$/.test(dni)) {
      setRegisterError("El DNI debe contener 8 dígitos.");
      return;
    }
    if (!firstName.trim() || !paternalSurname.trim()) {
      setRegisterError("Por favor ingresa tu nombre y apellido paterno.");
      return;
    }
    if (!/^9\d{8}$/.test(phone.trim())) {
      setRegisterError("El teléfono celular debe ser peruano y tener 9 dígitos (inicia con 9).");
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setRegisterError("Las contraseñas no coinciden.");
      return;
    }

    setRegisterLoading(true);

    const metadata = {
      first_name: firstName.trim(),
      paternal_surname: paternalSurname.trim(),
      maternal_surname: maternalSurname.trim(),
      dni: dni.trim() || null,
      phone: phone.trim(),
    };

    try {
      const { data, error } = await signUp(
        registerEmail.trim(),
        registerPassword,
        metadata
      );

      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("Este correo ya está registrado. Inicia sesión en su lugar.");
        }
        throw error;
      }

      // El usuario puede navegar directamente
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setRegisterError(err.message || "Ocurrió un error al crear la cuenta.");
    } finally {
      setRegisterLoading(false);
    }
  }

  // Atajos de desarrollo
  async function handleQuickLogin(testEmail) {
    setLoginEmail(testEmail);
    setLoginPassword("Password123*");
    setLoginError(null);
    setLoginLoading(true);

    try {
      const { error } = await signIn(testEmail, "Password123*");
      if (error) throw error;
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setLoginError(err.message || "Error en inicio rápido");
    } finally {
      setLoginLoading(false);
    }
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
            className={`py-3 text-center transition-colors ${
              activeTab === "login"
                ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
                : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setRegisterError(null);
            }}
            className={`py-3 text-center transition-colors ${
              activeTab === "register"
                ? "border-b-2 border-brand-primary text-brand-primary bg-surface-card"
                : "text-brand-muted hover:text-brand-primary bg-surface-subtle"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        <CardHeader>
          <div className="flex justify-between items-center mb-1">
            <CardTitle>
              {activeTab === "login" ? "Acceso de Clientes" : "Registro de Cuenta"}
            </CardTitle>
            <Badge variant="neutral">ERXIDI</Badge>
          </div>
          <CardDescription>
            {activeTab === "login"
              ? "Ingresa tus credenciales para acceder y gestionar tus pedidos."
              : "Regístrate con tu DNI para disfrutar de pagos contra entrega y tracking."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ========================================================= */}
          {/* TAB 1: INICIAR SESIÓN */}
          {/* ========================================================= */}
          {activeTab === "login" && (
            <div className="space-y-4">
              {loginError && (
                <div className="bg-rose-50 border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={forgotPasswordMode ? handleResetPassword : handleLoginSubmit} className="space-y-4">
                <Input
                  label="Correo Electrónico"
                  type="email"
                  placeholder="usuario@erxidi.pe"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
                {!forgotPasswordMode && (
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5">
                        Contraseña
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordMode(true)}
                        className="text-xs font-medium text-accent hover:underline mb-1.5"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                {forgotPasswordMode && resetEmailSent && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-button text-xs flex items-start gap-2">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Se ha enviado un enlace de recuperación a tu correo. Revisa también tu bandeja de spam.</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 bg-accent hover:bg-accent-hover text-white"
                  isLoading={loginLoading}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {forgotPasswordMode ? "Enviar Enlace" : "Ingresar a mi Cuenta"}
                </Button>

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

              {/* Atajos de Testing para el Equipo */}
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-secondary mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-accent" />
                  Atajos de Desarrollo (Testing):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("cliente@erxidi.pe")}
                    className="text-xs py-1.5 px-2 bg-surface-subtle border border-border rounded font-semibold text-brand-primary hover:bg-slate-200 transition-colors"
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("duena@erxidi.pe")}
                    className="text-xs py-1.5 px-2 bg-amber-50 border border-amber-200 rounded font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    Dueña
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("repartidor@erxidi.pe")}
                    className="text-xs py-1.5 px-2 bg-slate-800 border border-slate-700 rounded font-semibold text-white hover:bg-slate-900 transition-colors"
                  >
                    Repartidor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: CREAR CUENTA */}
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
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                        className="h-10 px-3.5 flex-shrink-0"
                        title="Buscar en RENIEC"
                      >
                        <Search className="w-4 h-4 text-brand-primary" />
                      </Button>
                    </div>

                    {dniFeedback && (
                      <div
                        className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                          dniFeedback.type === "success"
                            ? "text-emerald-600 font-medium"
                            : "text-amber-600"
                        }`}
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
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="reg-names"
                        className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary"
                      >
                        Nombres
                      </label>
                      {isDniLocked && (
                        <button
                          type="button"
                          onClick={() => setIsDniLocked(false)}
                          className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                      )}
                    </div>
                    <Input
                      id="reg-names"
                      placeholder="Nombres completos"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      readOnly={isDniLocked}
                      className={isDniLocked ? "bg-slate-100 text-slate-700 cursor-not-allowed" : ""}
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
                        className={isDniLocked ? "bg-slate-100 text-slate-700 cursor-not-allowed" : ""}
                        required
                      />
                      <Input
                        label="Ap. Materno"
                        id="reg-maternal"
                        placeholder="Materno"
                        value={maternalSurname}
                        onChange={(e) => setMaternalSurname(e.target.value)}
                        readOnly={isDniLocked}
                        className={isDniLocked ? "bg-slate-100 text-slate-700 cursor-not-allowed" : ""}
                      />
                    </div>
                  </div>

                  {/* Teléfono */}
                  <Input
                    label="Teléfono Celular"
                    id="reg-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    required
                  />

                  {/* Correo Electrónico */}
                  <Input
                    label="Correo Electrónico"
                    id="reg-email"
                    type="email"
                    placeholder="tu.correo@ejemplo.pe"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />

                  {/* Contraseñas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      label="Contraseña"
                      id="reg-pass"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
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

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-3 bg-accent hover:bg-accent-hover text-white"
                    isLoading={registerLoading}
                  >
                    Registrar Cuenta
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
