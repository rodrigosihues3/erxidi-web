/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0F172A',   // Slate 900: Encabezados, navegación y elementos de alta jerarquía
          secondary: '#475569', // Slate 600: Textos de lectura y descripciones
          muted: '#94A3B8',     // Slate 400: Placeholders y metadatos secundarios
        },
        accent: {
          DEFAULT: '#D97706',   // Amber 600: Acciones clave de conversión (CTA)
          hover: '#B45309',     // Amber 700: Estado hover y focus activo para CTA
          light: '#FFFBEB',     // Amber 50: Fondos para avisos o sugerencias
        },
        surface: {
          app: '#FAFAFA',       // Zinc 50: Fondo base del documento (SPA)
          card: '#FFFFFF',      // Blanco: Contenedores, tarjetas y modales
          subtle: '#F4F4F5',    // Zinc 100: Hover de filas de tabla y fondos neutros
        },
        border: {
          DEFAULT: '#E4E4E7',   // Zinc 200: Bordes estructurales estándar (1px)
          strong: '#CBD5E1',    // Slate 300: Bordes con interacción o focus
        },
        status: {
          success: {
            text: '#047857',    // Emerald 700: Pedidos entregados, stock suficiente
            bg: '#ECFDF5',      // Emerald 50
            border: '#A7F3D0',  // Emerald 200
          },
          warning: {
            text: '#B45309',    // Amber 700: En camino, pendiente de pago, poco stock
            bg: '#FFFBEB',      // Amber 50
            border: '#FDE68A',  // Amber 200
          },
          danger: {
            text: '#BE123C',    // Rose 700: Cancelado, agotado, error de validación
            bg: '#FFF1F2',      // Rose 50
            border: '#FECDD3',  // Rose 200
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        button: '6px', // Constante para botones e inputs
        card: '8px',   // Constante para contenedores y modales
        badge: '9999px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        dropdown: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}