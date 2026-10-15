# ERXIDI — Plataforma E-Commerce

Plataforma web de comercio electrónico y gestión logística desarrollada para la digitalización de venta minorista independiente de ropa interior y calcetería.

---

## 1. Contexto y Dominio del Negocio

### 1.1 Naturaleza Comercial
ERXIDI no es una fábrica textil, taller de confección ni manufactura industrial. Es un negocio unipersonal de **comercio minorista y reventa directa** que opera tradicionalmente en venta ambulatoria / puestos comerciales y se encuentra en proceso de transición hacia un canal digital estructurado.

* **Origen del Inventario:** La comerciante adquiere mercadería al por mayor en centros de distribución comercial (mercados mayoristas como Gamarra, distribuidores independientes y marcas peruanas comerciales), así como prendas réplicas/genéricas de alta rotación.
* **Flujo Operativo Real:** La dueña compra bultos o docenas de prendas, las clasifica manualmente por modelo, color y talla, y las vende con margen directo. No existen órdenes de producción, fichas técnicas de corte ni control de hilados industriales.
* **Objetivo de la Plataforma:** Dotar a la comerciante de una herramienta digital para centralizar pedidos, controlar el stock real de sus existencias físicas, procesar cobros digitales o coordinados y gestionar entregas a domicilio mediante repartidor local, reduciendo su dependencia del comercio informal en vía pública.

### 1.2 Reglas de Negocio Clave
1. **Política de Higiene Sanitaria e Inmutabilidad de Devoluciones:** Al tratarse exclusivamente de prendas íntimas (bóxers, trusas, medias, bividís, tops), por normas sanitarias de salud pública **no existen cambios ni devoluciones** una vez despachado el producto. Toda la interfaz del cliente debe advertir esta condición de forma transparente.
2. **Recomendación Anatómica Preventiva (SizeMatcher):** Dado que no hay devoluciones por error de talla, el storefront incorpora un calculador antropométrico de medidas para que el comprador contraste sus medidas corporales (cintura/cadera) contra los rangos de confección estándar del lote antes de comprar.
3. **Gestión de Stock por Rotación Rápida:** Las existencias dependen de compras semanales de lotes. La matriz administrativa (`VariantMatrix`) debe permitir registrar y dar de baja variantes rápidamente sin corromper pedidos antiguos.
4. **Despacho Local y Reparto:** Las entregas se realizan dentro del área metropolitana mediante mensajería local o repartidor propio, requiriendo validación de dirección sobre mapa para determinar el costo de flete métrico.

---

## 2. Arquitectura de Módulos del Sistema

La solución se estructura en cinco módulos funcionales desacoplados:

* **Módulo A — Storefront B2C (`/`, `/catalogo`):** Catálogo público responsivo con filtros por público (`target_gender`: hombre, mujer, niño, niña) y categoría de prenda. Dispone de cálculo reactivo de stock remanente (`stockAfterCart - quantity`) para evitar sobreventa de existencias físicas limitadas.
* **Módulo B — Checkout Transaccional (`/checkout`):** Captura de datos del comprador, autocompletado mediante API de DNI, geocodificación inversa con mapa interactivo (Leaflet/OSM), tarifación de flete por distancia métrica (algoritmo de Haversine) e integración con Culqi v4 para cobros con tarjeta o Yape.
* **Módulo C — Backoffice de la Dueña (`/admin`):** Panel restringido por roles (RBAC) para auditar ventas, actualizar estados de despacho y administrar la matriz de productos (tallas, códigos SKU generados y tonos de color capturados mediante selector nativo y pipeta EyeDropper).
* **Módulo D — Portal Móvil para Repartidor (`/reparto`):** Interfaz optimizada para teléfonos móviles donde el repartidor visualiza órdenes asignadas, accede a la geolocalización de entrega para navegación en calle y actualiza el estado logístico (`received`, `in_transit`, `delivered`).
* **Módulo E — Seguimiento en Tiempo Real (`/seguimiento/:orderNumber`):** Vista pública donde el cliente consulta el estado de su pedido mediante su código único de orden sin necesidad de crear una cuenta en el sistema.

---

## 3. Requisitos Previos

Antes de ejecutar el proyecto, confirma contar con el siguiente software instalado:
* **Node.js**: Versión `18.x` o `20.x` LTS.
* **npm**: Versión `9.x` o superior.
* **Git**: Instalado y configurado en tu entorno local.

---

## 4. Puesta en Marcha Local

### Paso 1: Clonar el repositorio
```bash
git clone [https://github.com/rodrigosihues3/erxidi-web.git](https://github.com/rodrigosihues3/erxidi-web.git)
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

## 5. Rutas Principales Disponibles

* `/`: Vista inicial de la plataforma.
* `/ui`: **Catálogo interactivo del Sistema de Diseño**. Consulta obligatoria para reutilizar botones, inputs, badges, cards y skeletons respetando la coherencia visual del proyecto.
* `/checkout`: Módulo B (Checkout, flete por zona y carga de comprobantes).
* `/admin`: Módulo C (Backoffice administrativo de la dueña).
* `/reparto`: Módulo D (Portal móvil para repartidores).
* `/seguimiento/:orderNumber`: Módulo E (Tracking reactivo en tiempo real con WebSockets).

---

## 6. Reglas de Desarrollo y Sistema de Diseño

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

## 7. Flujo de Trabajo en Git (Git Flow Simplificado)

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