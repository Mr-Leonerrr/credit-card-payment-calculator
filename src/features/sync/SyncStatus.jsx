const labels = {
  loading: "Cargando cálculos…",
  "needs-choice": "Elige cómo iniciar tus cálculos en esta cuenta.",
  synced: "Guardado en tu cuenta",
  saving: "Guardando cambios…",
  offline: "Sin conexión · Solo consulta",
  conflict:
    "Otro dispositivo cambió estos cálculos. Exporta tus cambios antes de cargar la versión guardada.",
  error: "No se pudo sincronizar · Solo consulta",
};

export function SyncStatus({ auth, cloud, requestReload, requestImport }) {
  if (auth.error)
    return (
      <div className="notice error" role="alert">
        No se pudo conectar la cuenta. Revisa la configuración o intenta iniciar
        sesión nuevamente.
      </div>
    );
  if (!auth.user) return null;
  return (
    <section className="notice sync-status" role="status">
      <span>
        {cloud.error === "INVALID_DRAFT"
          ? "Completa los campos para guardar. Los cambios aún no se han sincronizado."
          : labels[cloud.status] || "Conectando…"}
      </span>
      <div className="sync-actions">
        {cloud.status === "needs-choice" && (
          <button
            type="button"
            className="button secondary"
            onClick={() => cloud.importLocal(false)}
          >
            Empezar vacío
          </button>
        )}
        {cloud.importAvailable &&
          ["needs-choice", "synced"].includes(cloud.status) && (
            <button
              type="button"
              className="button secondary"
              onClick={requestImport}
            >
              Importar datos locales
            </button>
          )}
        {["error", "conflict", "offline"].includes(cloud.status) && (
          <button
            type="button"
            className="button secondary"
            onClick={requestReload}
          >
            Cargar versión guardada
          </button>
        )}
      </div>
    </section>
  );
}
