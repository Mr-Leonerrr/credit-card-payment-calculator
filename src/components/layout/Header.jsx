import { CreditCard, ShieldCheck, Moon, Sun } from "lucide-react";
import { IconButton } from "../ui/IconButton.jsx";

export function Header({ workspace, setWorkspace }) {
  return (
    <header className="topbar">
      <a className="brand" href="#">
        <span className="brand-icon">
          <CreditCard size={22} />
        </span>
        <span>
          Mi corte<span className="brand-subtitle">Finanzas personales</span>
        </span>
      </a>
      <div className="topbar-actions">
        <span className="local-badge">
          <ShieldCheck size={15} /> Datos locales
        </span>
        <IconButton
          label={
            workspace.theme === "light"
              ? "Activar modo oscuro"
              : "Activar modo claro"
          }
          onClick={() =>
            setWorkspace((previous) => ({
              ...previous,
              theme: previous.theme === "light" ? "dark" : "light",
            }))
          }
        >
          {workspace.theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
        </IconButton>
      </div>
    </header>
  );
}
