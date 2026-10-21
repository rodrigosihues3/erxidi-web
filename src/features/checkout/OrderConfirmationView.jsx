import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { generateReceiptPDF } from "../../utils/pdfReceiptGenerator";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(amount || 0));

export default function OrderConfirmationView() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.order) {
      setOrder(location.state.order);
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    const loadOrder = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("orders")
          .select("*, order_items(*, product_variants(color, sizes(name), products(name)))")
          .eq("order_number", orderNumber)
          .single();

        if (queryError) throw queryError;
        if (isMounted) setOrder(data);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "No se pudo cargar la información del pedido.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [location.state, orderNumber]);

  const total = Number(order?.total_amount || 0);
  const whatsappMessage = encodeURIComponent(
    `Hola ERXIDI, confirmo mi pedido ${orderNumber} por S/ ${total.toFixed(2)}.`
  );
  const whatsappUrl = `https://wa.me/51987654321?text=${whatsappMessage}`;

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-3xl items-center justify-center px-4 text-sm text-brand-secondary">
        Cargando los datos de tu pedido...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto my-12 max-w-xl space-y-4 px-4 text-center">
        <p className="text-sm text-brand-secondary">
          {error || "No encontramos los datos de este pedido."}
        </p>
        <Link to="/catalogo">
          <Button variant="outline">Volver al catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <section className="space-y-4 rounded-card border border-border bg-surface-card p-6 text-center shadow-subtle sm:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-status-success-text" />
        <Badge variant="success" className="font-mono">
          Pedido {order.order_number || orderNumber}
        </Badge>
        <h1 className="text-2xl font-bold text-brand-primary">
          Recibimos tu pedido
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-brand-secondary">
          Guarda tu código para consultar el avance de preparación y entrega.
        </p>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            <Phone className="h-4 w-4" />
            Enviar comprobante por WhatsApp
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={() => generateReceiptPDF(order)}
          >
            <FileText className="mr-2 h-4 w-4 text-accent" />
            Descargar comprobante PDF
          </Button>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-4 rounded-card border border-border bg-surface-card p-5 shadow-subtle">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-accent" />
            <h2 className="font-semibold text-brand-primary">Seguimiento</h2>
          </div>
          <p className="text-sm leading-relaxed text-brand-secondary">
            Si compraste como invitado, ingresa al rastreo con tu código y valida
            tu identidad usando el DNI o los últimos cuatro dígitos del teléfono.
          </p>
          <Link to={`/seguimiento/${encodeURIComponent(order.order_number || orderNumber)}`}>
            <Button variant="outline" className="w-full">
              Seguimiento de tu pedido
            </Button>
          </Link>
        </section>

        <section className="space-y-4 rounded-card border border-border bg-surface-card p-5 shadow-subtle">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            <h2 className="font-semibold text-brand-primary">Datos de entrega</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-brand-secondary">Destino</dt>
              <dd className="text-right font-medium text-brand-primary">
                {order.delivery_address || "Puesto Comercial ERXIDI"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-brand-secondary">Modalidad</dt>
              <dd className="text-right font-medium text-brand-primary">
                {order.delivery_type === "pickup"
                  ? "Recojo en punto"
                  : order.delivery_type === "express"
                    ? "Envío express"
                    : "Envío programado"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="font-semibold text-brand-primary">Total</dt>
              <dd className="font-mono font-bold text-brand-primary">
                {formatCurrency(total)}
              </dd>
            </div>
          </dl>
          <p className="flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-brand-secondary">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            Por motivos de higiene, la ropa interior no cuenta con cambios ni
            devoluciones.
          </p>
        </section>
      </div>

      <div className="text-center">
        <Link to="/catalogo">
          <Button variant="ghost">Volver al catálogo</Button>
        </Link>
      </div>
    </div>
  );
}
