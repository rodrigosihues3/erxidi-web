import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { Lock, Mail, ShieldAlert, UserCheck } from "lucide-react";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/";

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

  // Atajo de desarrollo para el equipo
  async function handleQuickLogin(testEmail) {
    setEmail(testEmail);
    setPassword("Password123*");
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await signIn(testEmail, "Password123*");
      if (error) throw error;
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || "Error en inicio rápido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex justify-between items-center mb-1">
            <CardTitle>Iniciar Sesión</CardTitle>
            <Badge variant="neutral">ERXIDI Auth</Badge>
          </div>
          <CardDescription>
            Ingresa tus credenciales para acceder a la plataforma.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMsg && (
            <div className="bg-status-danger-bg border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="usuario@erxidi.pe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={loading}
            >
              <Mail className="w-4 h-4 mr-2" />
              Ingresar con Email
            </Button>
          </form>

          {/* ACCESO RÁPIDO PARA DESARROLLADORES (EQUIPO) */}
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
        </CardContent>
      </Card>
    </div>
  );
}
