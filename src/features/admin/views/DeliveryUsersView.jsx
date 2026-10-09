import { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  UserCircle,
  Phone,
  Mail,
  CreditCard,
  Pencil,
  Trash2,
} from "lucide-react";

import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import {
  listDeliveryUsers,
  deleteDeliveryStaff,
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

  const [search, setSearch] = useState("");

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

  const handleDelete = async (staffId) => {
    if (!window.confirm("¿Seguro que deseas eliminar a este repartidor?")) return;
    try {
      await deleteDeliveryStaff(staffId);
      // Actualización reactiva inmediata del estado local para que la fila desaparezca
      setDeliveryUsers((prev) => prev.filter((item) => item.id !== staffId));
      setFilteredUsers((prev) => prev.filter((item) => item.id !== staffId));
    } catch (err) {
      window.alert("Error al eliminar repartidor: " + (err.message || err));
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
      const { surname, modality } = parseStaffModality(user.paternal_surname);
      const fullName = [user.first_name, surname, user.maternal_surname]
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
    const { surname } = parseStaffModality(user.paternal_surname);
    return [user.first_name, surname, user.maternal_surname]
      .filter(Boolean)
      .join(" ");
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

      {/* SEARCH */}
      <div className="bg-white border border-border rounded-card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI, teléfono o email..."
            className="w-full h-10 pl-10 pr-3 border border-border rounded-button text-sm outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="bg-white border border-border rounded-card p-10 text-center text-sm text-brand-secondary">
          Cargando repartidores...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-border rounded-card p-12 text-center">
          <Truck className="w-10 h-10 mx-auto text-brand-muted mb-3" />

          <h3 className="font-semibold text-brand-primary">
            No hay repartidores
          </h3>

          <p className="text-sm text-brand-secondary mt-1">
            Registra el primer repartidor desde el botón "Nuevo repartidor".
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle border-b border-border">
                <tr>
                  <th className="text-left px-5 py-4 font-semibold">
                    Repartidor
                  </th>

                  <th className="text-left px-5 py-4 font-semibold">DNI</th>

                  <th className="text-left px-5 py-4 font-semibold">
                    Contacto
                  </th>

                  <th className="text-left px-5 py-4 font-semibold">Rol</th>

                  <th className="text-left px-5 py-4 font-semibold">
                    Registro
                  </th>

                  <th className="text-right px-5 py-4 font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const { modality } = parseStaffModality(
                    user.paternal_surname,
                  );

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-subtle transition"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-surface-subtle flex items-center justify-center flex-shrink-0">
                            <UserCircle className="w-5 h-5 text-brand-secondary" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-brand-primary">
                                {getCleanFullName(user) || "Sin nombre"}
                              </p>

                              {modality === "express" ? (
                                <Badge variant="warning">Express</Badge>
                              ) : (
                                <Badge
                                  variant="neutral"
                                  className="bg-sky-50 text-sky-800 border-sky-200"
                                >
                                  Programado
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-brand-muted mt-0.5">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-brand-secondary">
                          <CreditCard className="w-4 h-4" />
                          {user.dni || "—"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-brand-secondary">
                            <Phone className="w-3.5 h-3.5" />
                            {user.phone || "—"}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-brand-secondary">
                            <Mail className="w-3.5 h-3.5" />
                            {user.email || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase">
                          Delivery
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-brand-secondary whitespace-nowrap">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString(
                              "es-PE",
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
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
