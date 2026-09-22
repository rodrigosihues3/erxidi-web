# ERXIDI — Plataforma E-Commerce (Frontend)

Repositorio oficial del frontend web para ERXIDI, desarrollado con React (Vite), Tailwind CSS v3 y Supabase (PostgreSQL / GoTrue / Storage / Realtime).

---

## 1. Requisitos Previos

Antes de ejecutar el proyecto, confirma contar con el siguiente software instalado:
* **Node.js**: Versión `18.x` o `20.x` LTS.
* **npm**: Versión `9.x` o superior.
* **Git**: Instalado y configurado en tu entorno local.

---

## 2. Puesta en Marcha Local

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/rodrigosihues3/erxidi-web.git
cd erxidi-web
```

### Paso 2: Instalar dependencias
Instala los paquetes versionados en `package.json`:
```bash
npm install
```

### Paso 3: Configurar variables de entorno
Crea una copia local del archivo `.env.example` y nómbrala `.env.local`:

En Windows (CMD / PowerShell):
```cmd
copy .env.example .env.local
```

En Git Bash / Linux / macOS:
```bash
cp .env.example .env.local
```

Verifica que `.env.local` contenga las credenciales asignadas de Supabase:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Paso 4: Iniciar servidor de desarrollo
Ejecuta el servidor de Vite con reemplazo en caliente (HMR):
```bash
npm run dev
```
La aplicación iniciará en `http://localhost:5173`.

---

## 3. Rutas Principales Disponibles

* `/`: Vista inicial de la plataforma.
* `/ui`: **Catálogo interactivo del Sistema de Diseño**. Consulta obligatoria para reutilizar botones, inputs, badges, cards y skeletons respetando la coherencia visual del proyecto.
* `/checkout`: Módulo B (Checkout, flete por zona y carga de comprobantes).
* `/admin`: Módulo C (Backoffice administrativo de la dueña).
* `/reparto`: Módulo D (Portal móvil para repartidores).
* `/seguimiento/:orderNumber`: Módulo E (Tracking reactivo en tiempo real con WebSockets).

---

## 4. Reglas de Desarrollo y Sistema de Diseño

1. **Tokens y Paleta de Colores:** No emplear clases de colores arbitrarias (`bg-blue-500`, `bg-red-400`, etc.). Utilizar los tokens semánticos definidos en `tailwind.config.js`:
   * **Primario / Autoridad:** `bg-brand-primary` (`#0F172A`), `text-brand-secondary` (`#475569`).
   * **Acción / Conversión (CTA):** `bg-accent` (`#D97706`), hover `bg-accent-hover` (`#B45309`).
   * **Superficies:** Fondo general `bg-surface-app` (`#FAFAFA`), tarjetas y modales `bg-surface-card` (`#FFFFFF`).
   * **Líneas y Bordes:** `border-border` (`#E4E4E7`).
   * **Semántica:** Éxito (`status-success`), Advertencia/Poco Stock (`status-warning`), Error/Agotado (`status-danger`).

2. **Componentes Atómicos:** Consumir siempre los componentes modulares ubicados en `src/components/ui/` (`Button`, `Input`, `Badge`, `Card`, `Skeleton`).

3. **Estado Global:**
   * **Sesión y Perfiles:** Consumir mediante el hook `useAuth()` desde `src/context/AuthContext.jsx`.
   * **Carrito de Compras:** Consumir mediante el hook `useCart()` desde `src/context/CartContext.jsx`.

---

## 5. Flujo de Trabajo en Git (Git Flow Simplificado)

Para evitar colisiones en la rama troncal:
1. La rama `main` contiene únicamente código estable y probado.
2. Cada integrante debe trabajar en su respectiva rama por módulo:
   * Módulo A: `git checkout -b feature/modulo-a-catalogo`
   * Módulo B: `git checkout -b feature/modulo-b-checkout`
   * Módulo C: `git checkout -b feature/modulo-c-admin`
   * Módulo D: `git checkout -b feature/modulo-d-delivery`
   * Módulo E: `git checkout -b feature/modulo-e-tracking`
3. Antes de solicitar revisión (Pull Request), verificar que el proyecto compile de forma limpia ejecutando localmente:
```bash
npm run build
```