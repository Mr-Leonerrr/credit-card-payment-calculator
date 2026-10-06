import { CreditCard, ShieldCheck, Moon, Sun } from "lucide-react";
import { IconButton } from "../ui/IconButton.jsx";
import { AccountControls } from "../../features/auth/components/AccountControls.jsx";

export function Header({
  workspace,
  toggleTheme,
  auth,
  configured,
  requestLogout,
}) {
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
          <ShieldCheck size={15} />{" "}
          {auth?.user ? "Cuenta privada" : "Datos locales"}
        </span>
        {auth && (
          <AccountControls
            auth={auth}
            configured={configured}
            requestLogout={requestLogout}
          />
        )}
        <IconButton
          label={
            workspace.theme === "light"
              ? "Activar modo oscuro"
              : "Activar modo claro"
          }
          onClick={toggleTheme}
        >
          {workspace.theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
        </IconButton>
      </div>
    </header>
  );
}
