import { useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/Card";
import Skeleton from "../../components/ui/Skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Truck,
  Copy,
  Check,
  ShoppingBag,
} from "lucide-react";

export default function DesignSystemShowcase() {
  const [copiedId, setCopiedId] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [btnLoading, setBtnLoading] = useState(false);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-surface-app text-brand-primary p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-10 border-b border-border pb-6 flex justify-between items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Guía de Implementación UI
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-brand-primary mt-1">
            Sistema de Diseño ERXIDI
          </h1>
          <p className="text-sm text-brand-secondary mt-1">
            Componentes atómicos normalizados bajo Tailwind CSS (Flat
            Minimalista).
          </p>
        </div>
        <Badge variant="neutral">Ambiente de Desarrollo</Badge>
      </header>

      <main className="max-w-6xl mx-auto space-y-12">
        {/* SECCIÓN 1: PALETA CROMÁTICA */}
        <section>
          <h2 className="text-xl font-bold text-brand-primary mb-4">
            1. Tokens Cromáticos Semánticos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <ColorSwatch
              name="brand-primary"
              hex="#0F172A"
              usage="bg-brand-primary"
              desc="Navbars, títulos, botones autoridad"
            />
            <ColorSwatch
              name="brand-secondary"
              hex="#475569"
              usage="text-brand-secondary"
              desc="Textos descriptivos, subtítulos"
            />
            <ColorSwatch
              name="accent"
              hex="#D97706"
              usage="bg-accent"
              desc="Botones CTA primarios (comprar)"
              isAccent
            />
            <ColorSwatch
              name="surface-card"
              hex="#FFFFFF"
              usage="bg-surface-card"
              desc="Fondo de tarjetas, modales"
              hasBorder
            />
            <ColorSwatch
              name="border"
              hex="#E4E4E7"
              usage="border-border"
              desc="Líneas y separadores (1px)"
              hasBorder
            />
          </div>
        </section>

        {/* SECCIÓN 2: BOTONES */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-brand-primary">
              2. Botones (`Button.jsx`)
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBtnLoading(!btnLoading)}
            >
              Toggle Loading State
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComponentPreview
              title="Variantes de Jerarquía"
              snippet={`<Button variant="primary">Añadir al Carrito</Button>\n<Button variant="secondary">Ver Detalles</Button>\n<Button variant="outline">Filtros</Button>\n<Button variant="danger">Cancelar</Button>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="btn-variants"
            >
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" isLoading={btnLoading}>
                  Añadir al Carrito
                </Button>
                <Button variant="secondary" isLoading={btnLoading}>
                  Ver Detalles
                </Button>
                <Button variant="outline" isLoading={btnLoading}>
                  Filtros
                </Button>
                <Button variant="danger" isLoading={btnLoading}>
                  Cancelar
                </Button>
              </div>
            </ComponentPreview>

            <ComponentPreview
              title="Escala de Tamaños"
              snippet={`<Button size="sm">Pequeño (h-8)</Button>\n<Button size="md">Mediano (h-10)</Button>\n<Button size="lg">Grande (h-12)</Button>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="btn-sizes"
            >
              <div className="flex items-center gap-3">
                <Button size="sm">Pequeño</Button>
                <Button size="md">Mediano</Button>
                <Button size="lg">Grande</Button>
              </div>
            </ComponentPreview>
          </div>
        </section>

        {/* SECCIÓN 3: ENTRADAS DE FORMULARIO */}
        <section>
          <h2 className="text-xl font-bold text-brand-primary mb-4">
            3. Entradas de Formulario (`Input.jsx`)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComponentPreview
              title="Estado Estándar y Validación de Error"
              snippet={`<Input \n  label="Correo Electrónico" \n  placeholder="ejemplo@correo.pe" \n/>\n\n<Input \n  label="DNI" \n  error="El documento debe tener 8 dígitos numéricos" \n  defaultValue="123" \n/>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="input-states"
            >
              <div className="space-y-4 w-full">
                <Input
                  label="Correo Electrónico"
                  placeholder="ejemplo@correo.pe"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  helperText="Utilizado para el seguimiento de la orden."
                />
                <Input
                  label="DNI"
                  error="El documento debe tener 8 dígitos numéricos"
                  defaultValue="123"
                />
              </div>
            </ComponentPreview>

            <ComponentPreview
              title="Estado Deshabilitado"
              snippet={`<Input \n  label="Monto Fijo (S/)" \n  disabled \n  defaultValue="63.50" \n/>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="input-disabled"
            >
              <div className="w-full">
                <Input
                  label="Monto Fijo (S/)"
                  disabled
                  defaultValue="63.50"
                  helperText="Campo bloqueado por lógica de negocio."
                />
              </div>
            </ComponentPreview>
          </div>
        </section>

        {/* SECCIÓN 4: BADGES SEMÁNTICOS */}
        <section>
          <h2 className="text-xl font-bold text-brand-primary mb-4">
            4. Insignias Semánticas (`Badge.jsx`)
          </h2>
          <ComponentPreview
            title="Mapeo de Estados de Órdenes e Inventario"
            snippet={`<Badge variant="success" icon={CheckCircle2}>Entregado</Badge>\n<Badge variant="warning" icon={AlertTriangle}>Pendiente Pago / Stock Bajo</Badge>\n<Badge variant="danger" icon={XCircle}>Agotado / Cancelado</Badge>\n<Badge variant="neutral" icon={Package}>Algodón Pima</Badge>`}
            onCopy={copyToClipboard}
            copiedId={copiedId}
            id="badges"
          >
            <div className="flex flex-wrap gap-3">
              <Badge variant="success" icon={CheckCircle2}>
                Entregado
              </Badge>
              <Badge variant="warning" icon={AlertTriangle}>
                Últimas 2 Unidades
              </Badge>
              <Badge variant="danger" icon={XCircle}>
                Agotado
              </Badge>
              <Badge variant="neutral" icon={Package}>
                Algodón Pima
              </Badge>
              <Badge variant="neutral" icon={Truck}>
                En Ruta
              </Badge>
            </div>
          </ComponentPreview>
        </section>

        {/* SECCIÓN 5: CARDS Y ESTRUCTURAS COMPUESTAS */}
        <section>
          <h2 className="text-xl font-bold text-brand-primary mb-4">
            5. Tarjetas y Modales (`Card.jsx`)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComponentPreview
              title="Ficha Transaccional de Producto"
              snippet={`<Card>\n  <CardHeader>\n    <CardTitle>Bóxer Trunk Algodón</CardTitle>\n    <CardDescription>SKU: BOX-PIMA-NEG-M</CardDescription>\n  </CardHeader>\n  <CardContent>\n    <p className="text-2xl font-bold text-brand-primary">S/ 28.00</p>\n  </CardContent>\n  <CardFooter>\n    <Button variant="primary" className="w-full">Comprar</Button>\n  </CardFooter>\n</Card>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="card-product"
            >
              <Card className="w-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>Bóxer Trunk Algodón</CardTitle>
                    <Badge variant="success">Disponible</Badge>
                  </div>
                  <CardDescription>SKU: BOX-PIMA-NEG-M</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-brand-primary">
                    S/ 28.00
                  </p>
                  <p className="text-xs text-brand-secondary">
                    Confeccionado en 100% Algodón Pima con elástico reforzado
                    antialérgico.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="primary" className="w-full">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Añadir al Carrito
                  </Button>
                </CardFooter>
              </Card>
            </ComponentPreview>

            <ComponentPreview
              title="Estados de Carga (`Skeleton.jsx`)"
              snippet={`<Card>\n  <Skeleton className="h-4 w-3/4 mb-2" />\n  <Skeleton className="h-3 w-1/2 mb-4" />\n  <Skeleton className="h-8 w-1/3 mb-4" />\n  <Skeleton className="h-10 w-full" />\n</Card>`}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              id="card-skeleton"
            >
              <Card className="w-full">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-12 w-full" />
                  <div className="pt-2 border-t border-border">
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </Card>
            </ComponentPreview>
          </div>
        </section>
      </main>
    </div>
  );
}

function ColorSwatch({
  name,
  hex,
  usage,
  desc,
  hasBorder = false,
  isAccent = false,
}) {
  return (
    <div
      className={`p-3 rounded-card bg-surface-card ${hasBorder ? "border border-border" : ""}`}
    >
      <div
        className="h-14 rounded-button mb-2 flex items-end p-2"
        style={{ backgroundColor: hex }}
      >
        <span
          className={`text-[10px] font-mono px-1 rounded ${isAccent || hex === "#0F172A" ? "text-white bg-black/30" : "text-slate-900 bg-white/70"}`}
        >
          {hex}
        </span>
      </div>
      <p className="text-xs font-bold text-brand-primary truncate">{name}</p>
      <p className="text-[10px] font-mono text-brand-secondary">{usage}</p>
      <p className="text-[10px] text-brand-muted mt-1 leading-tight">{desc}</p>
    </div>
  );
}

function ComponentPreview({ title, children, snippet, onCopy, copiedId, id }) {
  return (
    <div className="bg-surface-card border border-border rounded-card overflow-hidden">
      <div className="p-4 border-b border-border flex justify-between items-center bg-surface-subtle">
        <span className="text-xs font-semibold text-brand-primary">
          {title}
        </span>
        <button
          onClick={() => onCopy(snippet, id)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-secondary hover:text-brand-primary transition-colors bg-white px-2 py-1 rounded border border-border"
        >
          {copiedId === id ? (
            <>
              <Check className="w-3.5 h-3.5 text-status-success-text" />
              <span className="text-status-success-text">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar JSX</span>
            </>
          )}
        </button>
      </div>
      <div className="p-5 flex items-center justify-center min-h-[140px] bg-white">
        {children}
      </div>
      <div className="p-3 bg-zinc-900 text-zinc-300 font-mono text-[11px] overflow-x-auto border-t border-border">
        <pre>{snippet}</pre>
      </div>
    </div>
  );
}
