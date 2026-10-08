import { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  UserCircle,
  Phone,
  Mail,
  CreditCard,
  X,
} from "lucide-react";

import { listDeliveryUsers } from "../services/adminDelivery.service";

export default function DeliveryUsersView() {
  const [deliveryUsers, setDeliveryUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  async function loadDeliveryUsers() {
    try {
      setLoading(true);
      setError("");

      const data = await listDeliveryUsers();

      setDeliveryUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "No se pudieron cargar los repartidores."
      );
    } finally {
      setLoading(false);
    }
  }

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
      const fullName = [
        user.first_name,
        user.paternal_surname,
        user.maternal_surname,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.dni?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term)
      );
    });

    setFilteredUsers(filtered);
  }, [search, deliveryUsers]);

  function getFullName(user) {
    return [
      user.first_name,
      user.paternal_surname,
      user.maternal_surname,
    ]
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
            Administra los usuarios encargados de las entregas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-button bg-brand-primary text-white text-sm font-semibold hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Nuevo repartidor
        </button>

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
            Registra el primer repartidor desde el botón
            "Nuevo repartidor".
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

                  <th className="text-left px-5 py-4 font-semibold">
                    DNI
                  </th>

                  <th className="text-left px-5 py-4 font-semibold">
                    Contacto
                  </th>

                  <th className="text-left px-5 py-4 font-semibold">
                    Rol
                  </th>

                  <th className="text-left px-5 py-4 font-semibold">
                    Registro
                  </th>
                </tr>

              </thead>

              <tbody className="divide-y divide-border">

                {filteredUsers.map((user) => (

                  <tr
                    key={user.id}
                    className="hover:bg-surface-subtle transition"
                  >

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="w-9 h-9 rounded-full bg-surface-subtle flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-brand-secondary" />
                        </div>

                        <div>
                          <p className="font-semibold text-brand-primary">
                            {getFullName(user) || "Sin nombre"}
                          </p>

                          <p className="text-xs text-brand-muted">
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

                    <td className="px-5 py-4 text-xs text-brand-secondary">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString(
                            "es-PE"
                          )
                        : "—"}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {/* MODAL CREAR */}
      {showCreate && (
        <CreateDeliveryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadDeliveryUsers();
          }}
        />
      )}

    </div>
  );
}


/* =========================================================
   MODAL NUEVO REPARTIDOR
========================================================= */

function CreateDeliveryModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    first_name: "",
    paternal_surname: "",
    maternal_surname: "",
    dni: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!form.first_name.trim()) {
      setError("Ingresa el nombre.");
      return;
    }

    if (!form.paternal_surname.trim()) {
      setError("Ingresa el apellido paterno.");
      return;
    }

    if (!form.email.trim()) {
      setError("Ingresa el correo electrónico.");
      return;
    }

    if (!form.dni.trim()) {
      setError("Ingresa el DNI.");
      return;
    }

    try {
      setLoading(true);

      /*
       *llamaremos a la Edge Function de Supabase.
       
       */

      const { supabase } = await import(
        "../../../services/supabase"
      );

      const { data, error } =
        await supabase.functions.invoke(
          "create-delivery-user",
          {
            body: {
              first_name: form.first_name,
              paternal_surname: form.paternal_surname,
              maternal_surname: form.maternal_surname,
              dni: form.dni,
              email: form.email,
              phone: form.phone,
            },
          }
        );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      onCreated();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo crear el repartidor."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">

      <div className="w-full max-w-lg bg-white rounded-card shadow-xl">

        {/* HEADER */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">

          <div>
            <h2 className="font-bold text-brand-primary">
              Nuevo repartidor
            </h2>

            <p className="text-xs text-brand-secondary mt-1">
              Se enviará una invitación de acceso.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-surface-subtle rounded-button"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4"
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <Field
              label="Nombres"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
            />

            <Field
              label="Apellido paterno"
              name="paternal_surname"
              value={form.paternal_surname}
              onChange={handleChange}
              required
            />

            <Field
              label="Apellido materno"
              name="maternal_surname"
              value={form.maternal_surname}
              onChange={handleChange}
            />

            <Field
              label="DNI"
              name="dni"
              value={form.dni}
              onChange={handleChange}
              required
              maxLength={8}
            />

            <Field
              label="Teléfono"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            <Field
              label="Correo electrónico"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />

          </div>

          {error && (
            <div className="p-3 rounded-button bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-border">

            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-button border border-border text-sm font-semibold"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="h-10 px-4 rounded-button bg-brand-primary text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading
                ? "Creando..."
                : "Crear repartidor"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}


/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
}) {
  return (
    <label className="block">

      <span className="block text-xs font-semibold text-brand-secondary mb-1.5">
        {label}
        {required && (
          <span className="text-red-500"> *</span>
        )}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        className="w-full h-10 px-3 border border-border rounded-button text-sm outline-none focus:ring-2 focus:ring-accent/20"
      />

    </label>
  );
}