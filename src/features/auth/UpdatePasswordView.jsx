import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { Lock, ShieldCheck, AlertCircle, Check } from "lucide-react";

function evaluatePasswordRules(password = "") {
  const val = String(password);
  const rules = [
    { id: "length", label: "Mínimo 8 caracteres", passed: val.length >= 8 },
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
    { id: "number", label: "Al menos un número (0-9)", passed: /\d/.test(val) },
    {
      id: "special",
      label: "Al menos un carácter especial (!@#$%^&*._-)",
      passed: /[^A-Za-z0-9]/.test(val),
    },
  ];
  const passedCount = rules.filter((r) => r.passed).length;
  return { rules, passedCount, isAllValid: passedCount === rules.length };
}

export default function UpdatePasswordView() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const passwordCheck = useMemo(
    () => evaluatePasswordRules(password),
    [password]
  );
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("error_description")) {
      const urlParams = new URLSearchParams(hash.replace("#", "?"));
      setError(
        urlParams.get("error_description") || "Enlace inválido o expirado."
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!passwordCheck.isAllValid) {
      setError("La contraseña debe cumplir todos los requisitos de seguridad.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        navigate("/mi-cuenta");
      }, 2000);
    } catch (err) {
      setError(err.message || "Ocurrió un error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex justify-between items-center mb-1">
            <CardTitle>Restablecer Contraseña</CardTitle>
            <Badge variant="neutral">Seguridad</Badge>
          </div>
          <CardDescription>
            Configura tu nueva clave segura para acceder a ERXIDI.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-card text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">¡Contraseña actualizada!</p>
                <p className="text-xs mt-1">Redirigiendo a tu cuenta...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Nueva Contraseña"
                type="password"
                placeholder="Crea una contraseña segura"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                label="Confirmar Contraseña"
                type="password"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <div className="p-3 rounded-card bg-surface-subtle border border-border space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-secondary block">
                  Reglas de seguridad ({passwordCheck.passedCount}/5)
                </span>
                <ul className="space-y-1 text-[11px]">
                  {passwordCheck.rules.map((r) => (
                    <li
                      key={r.id}
                      className={
                        "flex items-center gap-1.5 " +
                        (r.passed
                          ? "text-emerald-700 font-semibold"
                          : "text-brand-muted")
                      }
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading || !passwordCheck.isAllValid || !passwordsMatch}
                className="w-full mt-2 bg-accent hover:bg-accent-hover text-white"
                isLoading={loading}
              >
                <Lock className="w-4 h-4 mr-2" />
                Actualizar Contraseña
              </Button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-border text-center">
            <Link
              to="/login"
              className="text-xs text-brand-secondary hover:text-brand-primary transition-colors"
            >
              Volver a Iniciar Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}