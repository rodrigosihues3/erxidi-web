import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
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
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

export default function UpdatePasswordView() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Supabase automáticamente maneja el token en el fragmento de la URL (#access_token=...)
  // onAuthStateChange se encarga de loguear al usuario temporalmente para poder cambiar la contraseña.

  useEffect(() => {
    // Si llegamos aquí y hay un error en el hash (ej. token expirado o inválido)
    const hash = window.location.hash;
    if (hash && hash.includes("error_description")) {
      const urlParams = new URLSearchParams(hash.replace("#", "?"));
      setError(urlParams.get("error_description") || "Enlace inválido o expirado.");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
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

      if (updateError) {
        throw updateError;
      }

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
            Ingresa tu nueva contraseña para acceder a ERXIDI.
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
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Nueva Contraseña"
                type="password"
                placeholder="Mínimo 6 caracteres"
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

              <Button
                type="submit"
                variant="primary"
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
