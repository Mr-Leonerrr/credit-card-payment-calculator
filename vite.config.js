import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages: para un repo llamado "mi-calculador", usa "/mi-calculador/".
  // Puedes sobrescribirlo con VITE_BASE al desplegar.
  base: process.env.VITE_BASE || "/",
});