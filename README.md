# Calculador de cuota de tarjeta

Aplicación sencilla hecha con React, Vite y Tailwind CSS para estimar el valor del próximo corte de una tarjeta de crédito.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abre la URL que indique Vite.

## Crear build

```bash
npm run build
npm run preview
```

## GitHub Pages

1. Crea un repositorio llamado `tarjeta-cuota-calculador` (o el nombre que prefieras).
2. Sube el proyecto a la rama `main`.
3. En GitHub ve a **Settings → Pages**.
4. En **Build and deployment → Source**, selecciona **GitHub Actions**.
5. El workflow de `.github/workflows/deploy.yml` hará el build y despliegue.
6. Si cambiaste el nombre del repositorio, cambia `VITE_BASE` en el workflow para que coincida:
   `/NOMBRE-DEL-REPOSITORIO/`

La aplicación usa `localStorage` para conservar los datos introducidos en ese navegador y no necesita backend.
