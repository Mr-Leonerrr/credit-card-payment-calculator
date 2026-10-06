import { LogIn, LogOut } from "lucide-react";

export function AccountControls({ auth, configured, requestLogout }) {
  if (!configured) return null;
  return auth.user ? (
    <div className="account-controls">
      <span className="account-email" title={auth.user.email}>
        {auth.user.email}
      </span>
      <button
        type="button"
        className="button secondary"
        disabled={auth.loading}
        onClick={requestLogout}
      >
        <LogOut size={16} /> Salir
      </button>
    </div>
  ) : (
    <button
      type="button"
      className="button secondary"
      disabled={auth.loading}
      onClick={auth.signIn}
    >
      <LogIn size={16} /> {auth.loading ? "Conectando…" : "Entrar con Google"}
    </button>
  );
}
