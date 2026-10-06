import { CloudUpload, RotateCcw, LoaderCircle } from "lucide-react";

const labels = {
  loading: "Cargando cálculos…",
  "needs-choice": "Elige cómo iniciar tus cálculos en esta cuenta.",
  synced: "Guardado en tu cuenta",
  saving: "Guardando cambios…",
  offline: "Sin conexión · Solo consulta",
  "remote-update": "Hay cambios nuevos en la nube. Actualiza para verlos.",
  conflict:
    "Otro dispositivo cambió estos cálculos. Exporta tus cambios antes de cargar la versión guardada.",
  error: "No se pudo sincronizar. Los cambios se conservan; puedes reintentar.",
};

export function SyncStatus({
  auth,
  cloud,
  requestReload,
  requestImport,
  requestDiscard,
}) {
  if (auth.error)
    return (
      <div className="notice error" role="alert">
        No se pudo conectar la cuenta. Revisa la configuración o intenta iniciar
        sesión nuevamente.
      </div>
    );
  if (!auth.user) return null;
  return (
    <>
      <section className="notice sync-status" role="status">
        <span>
          {cloud.error === "INVALID_DRAFT"
            ? "Completa los campos para guardar. Los cambios aún no se han sincronizado."
            : cloud.dirty && cloud.status === "synced"
              ? "Cambios pendientes de sincronizar"
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
            !cloud.dirty &&
            ["needs-choice", "synced"].includes(cloud.status) && (
              <button
                type="button"
                className="button secondary"
                onClick={requestImport}
              >
                Importar datos locales
              </button>
            )}
          {cloud.status === "remote-update" && (
            <button
              type="button"
              className="button primary"
              onClick={requestReload}
            >
              Actualizar ahora
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
      {cloud.dirty && (
        <section className="manual-sync-bar" aria-label="Cambios pendientes">
          <span>
            {cloud.status === "saving"
              ? "Sincronizando cambios…"
              : "Hay cambios sin sincronizar"}
          </span>
          <div className="sync-actions">
            <button
              type="button"
              className="button secondary"
              disabled={cloud.status === "saving" || cloud.status === "loading"}
              onClick={requestDiscard}
            >
              <RotateCcw size={16} /> Descartar
            </button>
            <button
              type="button"
              className="button primary"
              disabled={
                !cloud.canEdit ||
                cloud.status === "saving" ||
                cloud.error === "INVALID_DRAFT"
              }
              onClick={() => cloud.synchronize()}
            >
              {cloud.status === "saving" ? (
                <LoaderCircle size={16} className="sync-spinner" />
              ) : (
                <CloudUpload size={16} />
              )}{" "}
              Sincronizar cambios
            </button>
          </div>
        </section>
      )}
      {cloud.status === "remote-update" && !cloud.dirty && (
        <section className="remote-update-bar" aria-label="Actualización disponible" role="status">
          <span>Hay cambios nuevos en la nube. Tu formulario actual se conservará hasta que actualices.</span>
          <button type="button" className="button primary" onClick={requestReload}>
            <CloudUpload size={16} /> Actualizar ahora
          </button>
        </section>
      )}
    </>
  );
}
