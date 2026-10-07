import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api-decolecta": {
        target: "https://api.decolecta.com/v1",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-decolecta/, ""),
        headers: {
          // Si el servidor requiere el token inyectado a nivel de cabecera de transporte:
          // 'Authorization': `Bearer ${process.env.VITE_DNI_API_TOKEN}`
        },
      },
    },
  },
});
