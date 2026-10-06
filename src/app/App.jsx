import {
  CalendarDays,
  Download,
  FileDown,
  X,
  Wallet,
  ChartNoAxesCombined,
  Settings2,
  HandCoins,
} from "lucide-react";
import { dateLabel } from "../utils/date.js";
import { IconButton } from "../components/ui/IconButton.jsx";
import { Header } from "../components/layout/Header.jsx";
import { CardSidebar } from "../features/cards/components/CardSidebar.jsx";
import { CardSettings } from "../features/cards/components/CardSettings.jsx";
import { Overview } from "../features/calculator/components/Overview.jsx";
import { Projection } from "../features/calculator/components/Projection.jsx";
import { WorkspaceDialogs } from "./WorkspaceDialogs.jsx";
import { useWorkspace } from "./useWorkspace.js";
import { SyncStatus } from "../features/sync/SyncStatus.jsx";
import { Payments } from "../features/cards/components/Payments.jsx";

export function App() {
  const controller = useWorkspace();
  const {
    workspace,
    setWorkspace,
    notice,
    setNotice,
    saveError,
    storageBlocked,
    setStorageBlocked,
    tab,
    setTab,
    setCreatingCard,
    setConfirmation,
    card,
    calculation,
    current,
    selectCard,
    exportCalculation,
  } = controller;
  return (
    <div className="app-shell">
      <Header
        workspace={workspace}
        toggleTheme={controller.toggleTheme}
        auth={controller.auth}
        configured={controller.configured}
        requestLogout={controller.requestLogout}
      />
      <div className="workspace">
        <CardSidebar
          workspace={workspace}
          card={card}
          selectCard={selectCard}
          setCreatingCard={setCreatingCard}
          canEdit={controller.canEdit}
          cloudAccount={Boolean(controller.auth.user)}
        />
        <main className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">ESTADO ESTIMADO</p>
              <h1>{card.name}</h1>
              <p className="muted">
                <CalendarDays size={15} /> Próximo corte:{" "}
                {dateLabel(current.date)}
              </p>
            </div>
            <div className="export-actions">
              <button
                className="button secondary"
                onClick={() => exportCalculation("csv")}
              >
                <Download size={16} /> CSV
              </button>
              <button
                className="button secondary"
                onClick={() => exportCalculation("pdf")}
              >
                <FileDown size={16} /> PDF
              </button>
            </div>
          </div>
          <SyncStatus {...controller} />
          {(notice || saveError) && (
            <div className={`notice ${saveError ? "error" : ""}`} role="status">
              <span>{saveError || notice}</span>
              {!saveError && (
                <IconButton label="Cerrar aviso" onClick={() => setNotice("")}>
                  <X size={16} />
                </IconButton>
              )}
            </div>
          )}
          {storageBlocked && (
            <div className="notice error">
              <span>
                El guardado está pausado para conservar los datos originales.
              </span>
              <button
                className="button secondary"
                onClick={() =>
                  setConfirmation({
                    title: "¿Reemplazar los datos guardados?",
                    text: "Los datos anteriores no se pudieron leer. Se reemplazarán por las tarjetas actuales.",
                    action: () => {
                      setStorageBlocked(false);
                      setNotice("");
                    },
                  })
                }
              >
                Guardar datos nuevos
              </button>
            </div>
          )}
          <nav className="tabs" aria-label="Vistas de la tarjeta">
            {[
              { id: "overview", label: "Resumen", icon: Wallet },
              { id: "payments", label: "Pagos", icon: HandCoins },
              {
                id: "projection",
                label: "Proyección",
                icon: ChartNoAxesCombined,
              },
              { id: "settings", label: "Configuración", icon: Settings2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <fieldset
              className="workspace-edit-boundary"
              disabled={!controller.canEdit}
            >
              <Overview {...controller} />
            </fieldset>
          )}
          {tab === "projection" && (
            <Projection
              workspace={workspace}
              setWorkspace={setWorkspace}
              calculation={calculation}
            />
          )}
          {tab === "payments" && (
            <fieldset
              className="workspace-edit-boundary"
              disabled={!controller.canEdit}
            >
              <Payments
                card={card}
                recordPayment={controller.recordPayment}
                removePayment={controller.removePayment}
              />
            </fieldset>
          )}
          {tab === "settings" && (
            <fieldset
              className="workspace-edit-boundary"
              disabled={!controller.canEdit}
            >
              <CardSettings {...controller} />
            </fieldset>
          )}
          <footer className="app-footer">
            Estimación orientativa, no un extracto bancario. Los intereses, el
            pago mínimo y la fecha de contabilización dependen de tu entidad.
          </footer>
        </main>
      </div>
      {controller.canEdit || controller.confirmation ? (
        <WorkspaceDialogs {...controller} />
      ) : null}
    </div>
  );
}
