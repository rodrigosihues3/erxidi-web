import { useEffect, useState } from "react";
import { ArrowLeft, Info, MailCheck, ShieldAlert } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

/**
 * Paso de verificación de correo mediante código OTP de 6 dígitos.
 * Componente presentacional: las operaciones de Supabase llegan por props.
 *
 * @param {string} email            Correo destino del código.
 * @param {string} [notice]         Aviso informativo opcional.
 * @param {(code: string) => Promise<void>} onVerify  Debe lanzar error si el código es inválido.
 * @param {() => Promise<void>} onResend              Debe lanzar error si el reenvío falla.
 * @param {() => void} onBack       Vuelve al formulario anterior.
 */
export default function OtpVerificationPanel({
  email,
  notice = null,
  onVerify,
  onResend,
  onBack,
}) {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Temporizador de espera para reenviar (el código acaba de enviarse).
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timerId = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timerId);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (otpCode.length !== OTP_LENGTH) {
      setError(`Ingresa el código de ${OTP_LENGTH} dígitos.`);
      return;
    }
    setError(null);
    setIsVerifying(true);
    try {
      await onVerify(otpCode);
    } catch {
      setError("Código inválido o expirado. Verifica e intenta nuevamente.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending) return;
    setError(null);
    setIsResending(true);
    try {
      await onResend();
      setOtpCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err?.message || "No se pudo reenviar el código. Intenta nuevamente.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border text-brand-primary flex items-center justify-center mx-auto">
          <MailCheck className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-brand-primary">
          Verifica tu correo
        </h3>
        <p className="text-xs text-brand-secondary leading-relaxed">
          Hemos enviado un código de {OTP_LENGTH} dígitos a{" "}
          <span className="font-semibold text-brand-primary break-all">
            {email}
          </span>
        </p>
      </div>

      {notice && (
        <div className="bg-surface-subtle border border-border text-brand-secondary p-3 rounded-button text-xs flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-status-danger-border text-status-danger-text p-3 rounded-button text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          id="otp-code"
          label="Código de verificación"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          placeholder="000000"
          value={otpCode}
          onChange={(e) => {
            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
            setError(null);
          }}
          className="text-center font-mono text-lg tracking-[0.5em]"
          autoFocus
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full bg-accent hover:bg-accent-hover text-white"
          disabled={isVerifying || otpCode.length !== OTP_LENGTH}
          isLoading={isVerifying}
        >
          Verificar y Entrar
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          isLoading={isResending}
        >
          {cooldown > 0 ? (
            <>
              Reenviar código en{" "}
              <span className="font-mono ml-1">{cooldown}s</span>
            </>
          ) : (
            "Reenviar código"
          )}
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-brand-secondary hover:text-brand-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </button>
      </form>
    </div>
  );
}
