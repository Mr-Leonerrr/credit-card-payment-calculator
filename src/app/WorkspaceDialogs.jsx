import { Check, Plus } from "lucide-react";
import { Modal } from "../components/ui/Modal.jsx";
import { Field } from "../components/ui/Field.jsx";
import { PurchaseFields } from "../features/purchases/components/PurchaseFields.jsx";

export function WorkspaceDialogs({
  editing,
  setEditing,
  savePurchase,
  current,
  creatingCard,
  setCreatingCard,
  addCard,
  cardName,
  setCardName,
  confirmation,
  setConfirmation,
}) {
  return (
    <>
      {" "}
      {editing && (
        <Modal title="Editar compra" onClose={() => setEditing(null)}>
          <form onSubmit={savePurchase}>
            <PurchaseFields
              purchase={editing}
              onChange={setEditing}
              editing
              nextDate={current.date}
            />
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="button primary" type="submit">
                <Check size={17} /> Guardar cambios
              </button>
            </div>
          </form>
        </Modal>
      )}
      {creatingCard && (
        <Modal title="Nueva tarjeta" onClose={() => setCreatingCard(false)}>
          <form onSubmit={addCard}>
            <Field
              label="Nombre"
              value={cardName}
              onChange={setCardName}
              required
              maxLength={80}
              placeholder="Ej. Tarjeta principal"
            />
            <div className="form-actions">
              <button type="submit" className="button primary">
                <Plus size={17} /> Crear tarjeta
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="confirmation-text">{confirmation.text}</p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
