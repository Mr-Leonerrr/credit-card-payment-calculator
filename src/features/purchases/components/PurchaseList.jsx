import { ReceiptText, Pencil, Trash2 } from "lucide-react";
import { money, purchaseBalance } from "../../calculator/model/calculator.js";
import { dateLabel } from "../../../utils/date.js";
import { IconButton } from "../../../components/ui/IconButton.jsx";

export function PurchaseList({
  card,
  current,
  setEditing,
  setConfirmation,
  removePurchase,
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>
          <ReceiptText size={19} /> Compras registradas
        </h2>
        <span className="count">{card.purchases.length}</span>
      </div>
      {!card.purchases.length ? (
        <div className="empty-state">
          <ReceiptText size={32} strokeWidth={1.3} />
          <p>No hay compras registradas</p>
        </div>
      ) : (
        <div className="purchase-list">
          {card.purchases.map((purchase) => {
            const total = Number(purchase.installments);
            const paid = Number(purchase.paidInstallments);
            const fromStatement = purchase.entryMode === "statement";
            const pending = fromStatement
              ? Number(purchase.statementRemaining)
              : total - paid;
            const detail = current.details.find(
              (item) => item.id === purchase.id,
            );
            return (
              <article className="purchase-row" key={purchase.id}>
                <div
                  className={`purchase-symbol ${total === 1 ? "single" : ""}`}
                >
                  <ReceiptText size={19} />
                </div>
                <div className="purchase-info">
                  <strong>{purchase.description}</strong>
                  <span>
                    {dateLabel(purchase.date)} ·{" "}
                    {total === 1 ? "Una cuota" : `${total} cuotas`}
                  </span>
                  <span className="purchase-status">
                    {fromStatement
                      ? `${pending} pendientes · Extracto`
                      : paid === total
                        ? "Pagada"
                        : `${paid} pagadas · ${pending} pendientes`}
                  </span>
                  <progress
                    aria-label={`${fromStatement ? "Avance del plazo" : "Cuotas pagadas"} de ${purchase.description}`}
                    max={total}
                    value={total - pending}
                  />
                </div>
                <div className="purchase-amount">
                  <strong>{money(purchaseBalance(purchase))}</strong>
                  <span>Capital pendiente</span>
                  <small>
                    Próximo corte:{" "}
                    {money(
                      detail
                        ? detail.capital +
                            detail.interest +
                            (detail.extraCharges || 0)
                        : 0,
                    )}
                  </small>
                </div>
                <div className="row-actions">
                  <IconButton
                    label={`Editar ${purchase.description}`}
                    onClick={() => setEditing({ ...purchase })}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Eliminar ${purchase.description}`}
                    danger
                    onClick={() =>
                      setConfirmation({
                        title: "¿Eliminar compra?",
                        text: purchase.description,
                        action: () => removePurchase(purchase.id),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
