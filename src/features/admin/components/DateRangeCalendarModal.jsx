import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import Button from "../../../components/ui/Button";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function normalizeDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatFullDate(date) {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function formatShortDayMonth(date) {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Modal de calendario mensual para selección de fecha única o rango de fechas,
 * con indicadores visuales de días con ventas pagadas y límite en la fecha actual.
 */
export default function DateRangeCalendarModal({
  open,
  onClose,
  initialStartDate,
  initialEndDate,
  viewYear,
  viewMonth,
  onMonthChange,
  salesByDate = {},
  loadingActivity = false,
  onApply,
}) {
  const today = useMemo(() => normalizeDay(new Date()), []);
  const [draftStart, setDraftStart] = useState(() =>
    initialStartDate ? normalizeDay(initialStartDate) : today,
  );
  const [draftEnd, setDraftEnd] = useState(() =>
    initialEndDate
      ? normalizeDay(initialEndDate)
      : initialStartDate
        ? normalizeDay(initialStartDate)
        : today,
  );

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Lunes = 0, Domingo = 6
    const leadingEmpty = (firstOfMonth.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < leadingEmpty; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(viewYear, viewMonth, day));
    }
    return cells;
  }, [viewYear, viewMonth]);

  if (!open) return null;

  const canGoNextMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  function handlePrevMonth() {
    if (viewMonth === 0) {
      onMonthChange(viewYear - 1, 11);
    } else {
      onMonthChange(viewYear, viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      onMonthChange(viewYear + 1, 0);
    } else {
      onMonthChange(viewYear, viewMonth + 1);
    }
  }

  function handleDayClick(dayDate) {
    if (dayDate > today) return;

    // 1er clic o reinicio tras un rango previo: día único
    if (!draftStart || (draftEnd && !isSameDay(draftStart, draftEnd))) {
      setDraftStart(dayDate);
      setDraftEnd(dayDate);
      return;
    }

    // 2do clic sobre el mismo día: mantener día único
    if (isSameDay(draftStart, dayDate)) {
      return;
    }

    // 2do clic en otro día: completar rango ordenado
    if (dayDate < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(dayDate);
    } else {
      setDraftEnd(dayDate);
    }
  }

  const hasSingleDay = draftStart && draftEnd && isSameDay(draftStart, draftEnd);
  const applyLabel = !draftStart
    ? "Aplicar"
    : hasSingleDay
      ? `Aplicar (${formatFullDate(draftStart)})`
      : `Aplicar rango (${formatShortDayMonth(draftStart)} – ${formatShortDayMonth(draftEnd)})`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card border border-border bg-surface-card p-5 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-button border border-border bg-surface-subtle text-accent">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-primary">
                Seleccionar fecha o rango
              </h3>
              <p className="text-[11px] text-brand-secondary">
                1 clic para un día, 2 clics para un rango
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar calendario"
            className="rounded-button p-1 text-brand-muted hover:bg-surface-subtle hover:text-brand-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navegación de mes */}
        <div className="mt-4 flex items-center justify-between rounded-button border border-border bg-surface-subtle px-2 py-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
            className="rounded-button p-1 text-brand-secondary hover:bg-surface-card hover:text-brand-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-bold text-brand-primary capitalize">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNextMonth}
            aria-label="Mes siguiente"
            className="rounded-button p-1 text-brand-secondary hover:bg-surface-card hover:text-brand-primary transition-colors disabled:opacity-35 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Cabecera de días */}
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="py-1 text-[11px] font-bold uppercase tracking-wider text-brand-muted"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarDays.map((dayDate, index) => {
            if (!dayDate) {
              return <div key={`empty-${index}`} className="h-9" />;
            }

            const dateKey = toDateKey(dayDate);
            const salesCount = salesByDate[dateKey] || 0;
            const isFuture = dayDate > today;
            const isToday = isSameDay(dayDate, today);
            const isStart = isSameDay(dayDate, draftStart);
            const isEnd = isSameDay(dayDate, draftEnd);
            const isEdge = isStart || isEnd;
            const isInRange =
              draftStart &&
              draftEnd &&
              dayDate > draftStart &&
              dayDate < draftEnd;

            const tooltipText = isFuture
              ? "Fecha futura no disponible"
              : salesCount > 0
                ? `${salesCount} ${salesCount === 1 ? "pedido pagado" : "pedidos pagados"}`
                : "Sin pedidos pagados";

            let cellClasses =
              "relative flex h-9 flex-col items-center justify-center rounded-button text-xs font-mono transition-colors ";

            if (isFuture) {
              cellClasses +=
                "text-brand-muted/40 cursor-not-allowed bg-transparent";
            } else if (isEdge) {
              cellClasses += "bg-accent text-white font-bold shadow-xs";
            } else if (isInRange) {
              cellClasses +=
                "bg-accent/15 text-brand-primary font-semibold hover:bg-accent/25";
            } else if (salesCount > 0) {
              cellClasses +=
                "bg-accent/10 text-brand-primary font-semibold hover:bg-accent/20 border border-accent/25";
            } else {
              cellClasses +=
                "text-brand-secondary hover:bg-surface-subtle hover:text-brand-primary";
            }

            if (isToday && !isEdge) {
              cellClasses += " ring-1 ring-border-strong";
            }

            return (
              <button
                key={dateKey}
                type="button"
                disabled={isFuture}
                title={tooltipText}
                onClick={() => handleDayClick(dayDate)}
                className={cellClasses}
              >
                <span>{dayDate.getDate()}</span>
                {salesCount > 0 && !isFuture && (
                  <span
                    className={`mt-0.5 h-1 w-1 rounded-full ${
                      isEdge ? "bg-white" : "bg-accent"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-brand-secondary">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>Días con pedidos pagados</span>
          </div>
          {loadingActivity && (
            <span className="font-mono text-[10px] text-brand-muted">
              Cargando...
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!draftStart || !draftEnd}
            onClick={() => {
              onApply({ startDate: draftStart, endDate: draftEnd });
              onClose();
            }}
          >
            {applyLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
