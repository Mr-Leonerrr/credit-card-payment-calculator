import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import { IconButton } from "../../../components/ui/IconButton.jsx";

export function CardSidebar({ workspace, card, selectCard, setCreatingCard }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <h2>Mis tarjetas</h2>
        <IconButton
          label="Agregar tarjeta"
          onClick={() => setCreatingCard(true)}
        >
          <Plus size={18} />
        </IconButton>
      </div>
      <nav className="card-nav" aria-label="Tarjetas guardadas">
        {workspace.cards.map((item, index) => (
          <button
            key={item.id}
            className={`card-selector ${item.id === card.id ? "active" : ""}`}
            aria-pressed={item.id === card.id}
            onClick={() => selectCard(item.id)}
          >
            <CreditCard size={22} />
            <span>
              <strong>{item.name}</strong>
              <small>Tarjeta {String(index + 1).padStart(2, "0")} · COP</small>
            </span>
            {item.id === card.id && <span className="selected-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <ShieldCheck size={17} />
        <p>
          Guardado en este navegador.
          <br />
          Sin números de tarjeta ni datos bancarios.
        </p>
      </div>
    </aside>
  );
}
