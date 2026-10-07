import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Phone,
  Printer,
  FileText,
  MapPin,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  X,
  PackageCheck,
  Building2,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

export default function OrderConfirmationView() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Si no vino en el router state, consultar Supabase
  useEffect(() => {
    if (order) return;

    let isMounted = true;
    async function loadOrder() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('order_number', orderNumber)
          .single();

        if (error) throw error;
        if (isMounted) setOrder(data);
      } catch (err) {
        console.warn('No se pudo cargar la orden desde Supabase:', err.message);
        // Fallback mínimo
        if (isMounted) {
          setOrder({
            order_number: orderNumber,
            total_amount: 0,
            customer_name: 'Cliente ERXIDI',
            customer_phone: '987654321',
            status: 'pending',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderNumber, order]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount || 0);

  const totalAmount = order?.total_amount || 0;
  const whatsappPhone = '51987654321';
  const whatsappMessage = encodeURIComponent(
    `Hola ERXIDI, confirmo mi pedido ${orderNumber} por S/ ${Number(totalAmount).toFixed(2)}.`
  );
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`;

  // Desglose tributario para comprobante digital
  const subtotalBeforeIgv = Number((totalAmount / 1.18).toFixed(2));
  const igvAmount = Number((totalAmount - subtotalBeforeIgv).toFixed(2));
  const docNumber =
    order?.invoice_data?.doc_number ||
    (order?.invoice_type === 'factura'
      ? `F001-${orderNumber?.slice(-6) || '000001'}`
      : `B001-${orderNumber?.slice(-6) || '000001'}`);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-200">
      {/* 1. Alerta de Éxito / Banner Principal */}
      <div className="bg-surface-card border border-border rounded-card p-6 sm:p-8 text-center space-y-4 shadow-subtle">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <Badge variant="success" className="font-mono text-xs px-3 py-1">
            Código: {orderNumber}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-primary">
            ¡Tu pedido ha sido registrado con éxito!
          </h1>
          <p className="text-xs sm:text-sm text-brand-secondary max-w-lg mx-auto leading-relaxed">
            Hemos recibido los detalles de tu compra. Para acelerar el despacho, confirma tu transferencia por WhatsApp.
          </p>
        </div>

        {/* Acción Inmediata WhatsApp */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center font-semibold rounded-button transition-colors px-6 h-11 text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <Phone className="w-4 h-4 mr-2" />
            Enviar comprobante por WhatsApp
          </a>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setIsReceiptModalOpen(true)}
            className="w-full sm:w-auto h-11 text-xs"
          >
            <FileText className="w-4 h-4 mr-1.5 text-accent" />
            Ver Comprobante
          </Button>
        </div>
      </div>

      {/* 2. Tarjeta de Seguimiento (Tracking) y Detalles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta de Tracking para Invitados */}
        <div className="bg-surface-card border border-border rounded-card p-6 space-y-4 shadow-subtle flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-primary">
              <PackageCheck className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Seguimiento de tu Pedido
              </h2>
            </div>
            <p className="text-xs text-brand-secondary leading-relaxed">
              Puedes consultar el estado de preparación y despacho de tu orden en cualquier momento desde nuestra sección de rastreo.
            </p>

            <div className="p-3 bg-surface-subtle border border-border rounded text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-brand-muted">Código de Orden:</span>
                <span className="font-bold text-brand-primary">{orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Teléfono asociado:</span>
                <span className="font-bold text-brand-primary">
                  {order?.customer_phone || '987 654 321'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link to="/mis-pedidos">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Ir a Seguimiento de Pedidos
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Resumen del Envío y Entrega */}
        <div className="bg-surface-card border border-border rounded-card p-6 space-y-4 shadow-subtle">
          <div className="flex items-center gap-2 text-brand-primary">
            <MapPin className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Información de Despacho
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-secondary">Receptor:</span>
              <span className="font-bold text-brand-primary">
                {order?.customer_name || 'Cliente'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-secondary">Modalidad:</span>
              <span className="font-bold text-brand-primary uppercase">
                {order?.delivery_type === 'pickup'
                  ? 'Recojo en Stand Comercial'
                  : order?.delivery_type === 'express'
                  ? 'Envío Express Mismo Día'
                  : 'Envío Programado Día Siguiente'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-secondary">Destino / Punto:</span>
              <span className="font-semibold text-brand-primary text-right max-w-[220px] truncate">
                {order?.delivery_address || 'Puesto Comercial ERXIDI'}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm">
              <span className="font-bold text-brand-primary">Total Pagado:</span>
              <span className="font-mono font-extrabold text-brand-primary">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-surface-subtle border border-border rounded text-[11px] text-brand-secondary flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              Prendas en empaque sellado de fábrica. Por salud pública no cuentan con cambios ni devoluciones.
            </span>
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <Link to="/catalogo">
          <Button variant="outline" size="md">
            Volver a la Tienda
          </Button>
        </Link>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL DE COMPROBANTE DIGITAL SIMULADO */}
      {/* ========================================================= */}
      {isReceiptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante digital de pago"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0"
            onClick={() => setIsReceiptModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-xl bg-white border border-border rounded-card shadow-dropdown p-6 max-h-[92vh] overflow-y-auto space-y-5 text-brand-primary">
            {/* Header del Comprobante */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-xl font-extrabold tracking-tight block">
                  ERXIDI
                </span>
                <span className="text-xs text-brand-secondary block font-semibold">
                  ERXIDI TEXTIL S.A.C.
                </span>
                <span className="text-[11px] text-brand-muted block font-mono">
                  RUC: 20612345678
                </span>
                <span className="text-[11px] text-brand-muted block">
                  Lima Metropolitana, Perú
                </span>
              </div>

              <div className="text-right">
                <div className="p-2 bg-surface-subtle border border-border rounded text-center">
                  <span className="text-[11px] font-bold block uppercase tracking-wider">
                    {order?.invoice_type === 'factura'
                      ? 'FACTURA ELECTRÓNICA'
                      : 'BOLETA DE VENTA ELECTRÓNICA'}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-brand-primary">
                    {docNumber}
                  </span>
                </div>
                <span className="text-[10px] text-brand-muted block mt-1">
                  Fecha: {new Date().toLocaleDateString('es-PE')}
                </span>
              </div>
            </div>

            {/* Datos del Cliente Receptor */}
            <div className="p-3 bg-surface-subtle border border-border rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-brand-secondary font-semibold">Cliente:</span>
                <span className="font-bold">
                  {order?.invoice_data?.legal_name || order?.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-secondary font-semibold">
                  {order?.invoice_type === 'factura' ? 'RUC:' : 'Documento / DNI:'}
                </span>
                <span className="font-mono">
                  {order?.invoice_data?.tax_id || 'Sin doc.'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-secondary font-semibold">Dirección:</span>
                <span className="text-right max-w-xs truncate">
                  {order?.invoice_data?.fiscal_address || order?.delivery_address}
                </span>
              </div>
            </div>

            {/* Ítems del Comprobante */}
            <div className="space-y-2 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-brand-secondary text-[11px] uppercase">
                    <th className="py-1">Cant.</th>
                    <th className="py-1">Descripción</th>
                    <th className="py-1 text-right">P. Unit</th>
                    <th className="py-1 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(order?.items || []).length > 0 ? (
                    order.items.map((item, idx) => (
                      <tr key={idx} className="py-1.5">
                        <td className="py-1 font-mono">{item.quantity}</td>
                        <td className="py-1 font-medium">
                          {item.name || 'Prenda íntima'} ({item.size})
                        </td>
                        <td className="py-1 text-right font-mono">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="py-1 text-right font-mono font-bold">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-2 text-center text-brand-muted">
                        Prendas íntimas ERXIDI
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cuadro de Totales e Impuestos */}
            <div className="border-t border-border pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-brand-secondary">
                <span>Subtotal (Op. Gravada):</span>
                <span className="font-mono">{formatCurrency(subtotalBeforeIgv)}</span>
              </div>
              <div className="flex justify-between text-brand-secondary">
                <span>I.G.V. (18%):</span>
                <span className="font-mono">{formatCurrency(igvAmount)}</span>
              </div>
              {order?.delivery_cost > 0 && (
                <div className="flex justify-between text-brand-secondary">
                  <span>Costo de Envío:</span>
                  <span className="font-mono">{formatCurrency(order.delivery_cost)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-bold text-sm">
                <span>IMPORTE TOTAL:</span>
                <span className="font-mono font-extrabold text-base">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Imprimir Comprobante
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsReceiptModalOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
