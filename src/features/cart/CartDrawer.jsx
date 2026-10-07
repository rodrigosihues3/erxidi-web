import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  X,
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

export default function CartDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { items, totalUnits, subtotal, updateQuantity, removeItem } = useCart();

  // Handle ESC key to close drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formattedSubtotal = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(subtotal || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito de compras"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Lateral Panel */}
      <div className="relative z-10 w-full max-w-md bg-surface-card border-l border-border shadow-dropdown flex flex-col h-full text-brand-primary animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-brand-primary">
              Tu Carrito
            </h2>
            <Badge variant="neutral" className="font-mono text-xs px-2 py-0.5">
              {totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'}
            </Badge>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-button text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors focus:outline-none"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-brand-muted">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-brand-primary">
                  Tu carrito está vacío
                </h3>
                <p className="text-xs text-brand-secondary max-w-xs">
                  Añade prendas anatómicas confeccionadas en fino algodón pima para iniciar tu compra.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose?.();
                  navigate('/catalogo');
                }}
              >
                Explorar Catálogo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-3 p-3 rounded-card border border-border bg-surface-card hover:border-border-strong transition-colors"
                >
                  {/* Product Thumbnail */}
                  <div className="w-16 h-20 rounded bg-surface-subtle border border-border overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-brand-muted">
                        Prenda
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold text-brand-primary truncate">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="text-brand-muted hover:text-rose-500 transition-colors p-0.5 focus:outline-none"
                          title="Eliminar prenda"
                          aria-label="Eliminar prenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-brand-secondary">
                        <span>
                          Talla:{' '}
                          <strong className="font-mono text-brand-primary">
                            {item.size}
                          </strong>
                        </span>
                        {item.color && <span>&bull; {item.color}</span>}
                      </div>
                    </div>

                    {/* Quantity and Price */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center border border-border rounded-button bg-surface-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle transition-colors focus:outline-none"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono text-xs font-bold text-brand-primary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.stock}
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-brand-secondary hover:text-brand-primary hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-xs text-brand-primary">
                        S/ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-border bg-surface-subtle space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-brand-secondary">
                Subtotal ({totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'})
              </span>
              <span className="font-bold text-base text-brand-primary">
                {formattedSubtotal}
              </span>
            </div>

            <div className="flex items-start gap-2 p-2 rounded bg-white border border-border text-[11px] text-brand-secondary leading-snug">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Por motivos de higiene, la ropa interior no cuenta con cambios ni
                devoluciones.
              </span>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose?.();
                navigate('/checkout');
              }}
              className="w-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold h-10"
            >
              Continuar al Checkout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
