import { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  CreditCard,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
  Power,
  RotateCcw,
} from "lucide-react";

import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import {
  listDeliveryUsers,
  deleteDeliveryStaff,
  toggleDeliveryStaffActive,
} from "../services/adminDelivery.service";
import DeliveryStaffModal, {
  parseStaffModality,
  formatPaternalSurnameWithModality,
} from "./DeliveryStaffModal";

export default function DeliveryUsersView() {
  const [deliveryUsers, setDeliveryUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const [staffModal, setStaffModal] = useState({
    isOpen: false,
    staff: null,
  });

  async function loadDeliveryUsers() {
    try {
      setLoading(true);
      setError("");

      const data = await listDeliveryUsers();

      setDeliveryUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron cargar los repartidores.");
    } finally {
      setLoading(false);
    }
  }

  const handleToggleActive = async (user) => {
    try {
      setTogglingId(user.id);
      setError("");
      const currentStatus = user.is_active !== false;
      const updated = await toggleDeliveryStaffActive(user.id, currentStatus);
      setDeliveryUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, ...updated } : item)),
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || "No se pudo actualizar el estado del repartidor.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm("¿Seguro que deseas eliminar a este repartidor?"))
      return;
    try {
      setError("");
      await deleteDeliveryStaff(staffId);
      setDeliveryUsers((prev) => prev.filter((item) => item.id !== staffId));
      setFilteredUsers((prev) => prev.filter((item) => item.id !== staffId));
    } catch (err) {
      setError("Error al eliminar repartidor: " + (err.message || err));
    }
  };

  useEffect(() => {
    loadDeliveryUsers();
  }, []);

  useEffect(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      setFilteredUsers(deliveryUsers);
      return;
    }

    const filtered = deliveryUsers.filter((user) => {
      const cleanPaternal = (user.paternal_surname || "")
        .replace(/\[.*?\]/g, "")
        .trim();
      const modality = user.delivery_type || "scheduled";
      const fullName = [user.first_name, cleanPaternal, user.maternal_surname]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.dni?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term) ||
        modality.toLowerCase().includes(term)
      );
    });

    setFilteredUsers(filtered);
  }, [search, deliveryUsers]);

  function getCleanFullName(user) {
    const cleanPaternal = (user.paternal_surname || "")
      .replace(/\[.*?\]/g, "")
      .trim();
    return [user.first_name, cleanPaternal, user.maternal_surname]
      .filter(Boolean)
      .join(" ");
  }

  function getInitials(user) {
    const first = (user.first_name || "").trim().charAt(0);
    const cleanPaternal = (user.paternal_surname || "")
      .replace(/\[.*?\]/g, "")
      .trim()
      .charAt(0);
    return (first + cleanPaternal).toUpperCase() || "RP";
  }

  function renderDeliveryTypeBadge(user) {
    const type = user.delivery_type || "scheduled";
    if (type === "express") {
      return (
        <Badge
          variant="warning"
          className="bg-amber-50 text-amber-800 border-amber-200"
        >
          ⚡ Express
        </Badge>
      );
    }
    return (
      <Badge
        variant="neutral"
        className="bg-sky-50 text-sky-800 border-sky-200"
      >
        📅 Programado
      </Badge>
    );
  }

  function renderOperationalBadge(user) {
    const status = user.operational_status || "available";
    const isOnDuty = user.is_on_duty !== false;

    if (!isOnDuty || status === "paused" || status === "en_pausa") {
      return <Badge variant="neutral">En Pausa</Badge>;
    }
    if (status === "in_route" || status === "en_ruta" || status === "busy") {
      return <Badge variant="warning">En Ruta</Badge>;
    }
    return <Badge variant="success">Disponible</Badge>;
  }

  const activeUsers = filteredUsers.filter((u) => u.is_active !== false);
  const inactiveUsers = filteredUsers.filter((u) => u.is_active === false);

  function renderGridCards(users, isInactiveSection = false) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => {
          const isActive = user.is_active !== false;
          const isToggling = togglingId === user.id;

          return (
            <Card
              key={user.id}
              className={`flex flex-col justify-between p-4 ${
                isInactiveSection ? "opacity-75" : ""
              }`}
            >
              <div className="space-y-3">
                {/* CABECERA */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-primary">
                    {getInitials(user)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-brand-primary truncate">
                      {getCleanFullName(user) || "Sin nombre"}
                    </h3>
                    <p className="text-xs text-brand-secondary font-mono mt-0.5">
                      DNI: {user.dni || "—"}
                    </p>
                  </div>
                </div>

                {/* BADGES */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {renderDeliveryTypeBadge(user)}
                  {renderOperationalBadge(user)}
                </div>

                {/* CONTACTO */}
                <div className="space-y-1.5 pt-2 border-t border-border text-xs text-brand-secondary">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
                    {user.phone ? (
                      <a
                        href={`tel:${user.phone}`}
                        className="font-mono hover:text-brand-primary underline-offset-2 hover:underline"
                      >
                        {user.phone}
                      </a>
                    ) : (
                      <span className="font-mono">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
                    <span className="truncate" title={user.email || ""}>
                      {user.email || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* BARRA DE ACCIONES INFERIOR */}
              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setStaffModal({ isOpen: true, staff: user })
                    }
                    className="inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isToggling}
                    onClick={() => handleToggleActive(user)}
                    className="inline-flex items-center gap-1.5"
                  >
                    {isActive ? (
                      <>
                        <Power className="w-3.5 h-3.5 text-amber-600" />
                        <span>Desactivar</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Reactivar</span>
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(user.id)}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 px-2.5"
                  title="Eliminar repartidor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  function renderTable(users, isInactiveSection = false) {
    return (
      <div className="bg-surface-card border border-border rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-brand-primary">
                  Repartidor
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-brand-primary">
                  DNI
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-brand-primary">
                  Modalidad / Estado
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-brand-primary">
                  Contacto
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-brand-primary">
                  Registro
                </th>
                <th className="text-right px-5 py-3.5 font-semibold text-brand-primary">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const isActive = user.is_active !== false;
                const isToggling = togglingId === user.id;

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-surface-subtle transition ${
                      isInactiveSection ? "opacity-75" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-subtle border border-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-primary">
                          {getInitials(user)}
                        </div>

                        <div>
                          <p className="font-semibold text-brand-primary">
                            {getCleanFullName(user) || "Sin nombre"}
                          </p>
                          <p className="text-xs text-brand-muted mt-0.5">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 text-brand-secondary font-mono text-xs">
                        <CreditCard className="w-4 h-4 text-brand-muted" />
                        {user.dni || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderDeliveryTypeBadge(user)}
                        {renderOperationalBadge(user)}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-brand-secondary font-mono">
                          <Phone className="w-3.5 h-3.5 text-brand-muted" />
                          {user.phone ? (
                            <a
                              href={`tel:${user.phone}`}
                              className="hover:text-brand-primary hover:underline"
                            >
                              {user.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-brand-secondary">
                          <Mail className="w-3.5 h-3.5 text-brand-muted" />
                          <span className="truncate max-w-[200px]">
                            {user.email || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-brand-secondary font-mono whitespace-nowrap">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("es-PE")
                        : "—"}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setStaffModal({ isOpen: true, staff: user })
                          }
                          className="inline-flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isToggling}
                          onClick={() => handleToggleActive(user)}
                          className="inline-flex items-center gap-1.5"
                        >
                          {isActive ? (
                            <>
                              <Power className="w-3.5 h-3.5 text-amber-600" />
                              <span>Desactivar</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Reactivar</span>
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-muted">
            Logística
          </p>

          <h1 className="text-2xl font-bold text-brand-primary">
            Repartidores
          </h1>

          <p className="text-sm text-brand-secondary mt-1">
            Administra los usuarios encargados de las entregas y su modalidad
            operativa.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setStaffModal({ isOpen: true, staff: null })}
          className="inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo repartidor</span>
        </Button>
      </div>

      {/* SEARCH & VIEW SELECTOR */}
      <div className="bg-surface-card border border-border rounded-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI, teléfono o email..."
            className="w-full h-10 pl-10 pr-3 border border-border rounded-button text-sm outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="inline-flex items-center gap-1 bg-surface-subtle p-1 rounded-button border border-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold transition ${
              viewMode === "grid"
                ? "bg-surface-card text-brand-primary border border-border"
                : "text-brand-secondary hover:text-brand-primary"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cuadrícula</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold transition ${
              viewMode === "table"
                ? "bg-surface-card text-brand-primary border border-border"
                : "text-brand-secondary hover:text-brand-primary"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Filas</span>
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div className="bg-surface-card border border-border rounded-card p-10 text-center text-sm text-brand-secondary">
          Cargando repartidores...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-card p-12 text-center">
          <Truck className="w-10 h-10 mx-auto text-brand-muted mb-3" />

          <h3 className="font-semibold text-brand-primary">
            No hay repartidores
          </h3>

          <p className="text-sm text-brand-secondary mt-1">
            Registra el primer repartidor desde el botón "Nuevo repartidor".
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECCIÓN 1: REPARTIDORES ACTIVOS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-brand-primary">
                Repartidores Activos
              </h2>
              <Badge variant="success" className="font-mono">
                {activeUsers.length}
              </Badge>
            </div>

            {activeUsers.length === 0 ? (
              <div className="bg-surface-card border border-border rounded-card p-6 text-center text-sm text-brand-secondary">
                No hay repartidores activos que coincidan con la búsqueda.
              </div>
            ) : viewMode === "grid" ? (
              renderGridCards(activeUsers, false)
            ) : (
              renderTable(activeUsers, false)
            )}
          </div>

          {/* SECCIÓN 2: REPARTIDORES INACTIVOS */}
          {inactiveUsers.length > 0 && (
            <div className="bg-slate-50 border border-dashed border-border p-4 rounded-card space-y-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-brand-secondary">
                  Repartidores Inactivos / De Baja
                </h2>
                <Badge variant="neutral" className="font-mono">
                  {inactiveUsers.length}
                </Badge>
              </div>

              {viewMode === "grid"
                ? renderGridCards(inactiveUsers, true)
                : renderTable(inactiveUsers, true)}
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {staffModal.isOpen && (
        <DeliveryStaffModal
          staffToEdit={staffModal.staff}
          onClose={() => setStaffModal({ isOpen: false, staff: null })}
          onSaved={() => {
            setStaffModal({ isOpen: false, staff: null });
            loadDeliveryUsers();
          }}
        />
      )}
    </div>
  );
}

export {
  DeliveryStaffModal,
  DeliveryUsersView as DeliveryStaffView,
  parseStaffModality,
  formatPaternalSurnameWithModality,
};
