import { useState } from "react";
import { HandCoins, Trash2 } from "lucide-react";
import { Field } from "../../../components/ui/Field.jsx";
import { IconButton } from "../../../components/ui/IconButton.jsx";
import { SectionHeading } from "../../../components/ui/SectionHeading.jsx";
import { dateLabel } from "../../../utils/date.js";
import { money, today } from "../../calculator/model/calculator.js";

export function Payments({ card, recordPayment, removePayment }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const total = card.paymentHistory.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const submit = (event) => {
    event.preventDefault();
    if (recordPayment({ amount, date })) {
      setAmount("");
      setDate(today());
    }
  };

  return (
    <section className="section payment-history-section">
      <SectionHeading icon={HandCoins} title="Pagos y abonos" />
      <p className="disclosure">
        Cada pago se suma a los abonos del próximo corte y aumenta el cupo
        disponible registrado, sin superar el cupo total.
      </p>
      <form className="field-grid two payment-entry" onSubmit={submit}>
        <Field
          label="Valor del pago"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={setAmount}
          prefix="$"
          required
        />
        <Field
          label="Fecha del pago"
          type="date"
          value={date}
          onChange={setDate}
          required
        />
        <div className="form-actions">
          <button className="button primary" type="submit">
            <HandCoins size={16} /> Registrar pago
          </button>
        </div>
      </form>
      {!card.paymentHistory.length ? (
        <div className="empty-state payment-empty">
          <HandCoins size={30} strokeWidth={1.4} />
          <p>No hay pagos registrados</p>
        </div>
      ) : (
        <div className="payment-history">
          <div className="payment-history-heading">
            <h3>Historial de pagos</h3>
            <strong>{money(total)}</strong>
          </div>
          {card.paymentHistory
            .slice()
            .reverse()
            .map((payment) => (
              <article className="payment-row" key={payment.id}>
                <div>
                  <strong>{money(payment.amount)}</strong>
                  <span>{dateLabel(payment.date)}</span>
                  <small>
                    {payment.availableApplied
                      ? "Cupo disponible actualizado"
                      : "Cupo sin modificar"}
                  </small>
                </div>
                <IconButton
                  label={`Eliminar pago de ${money(payment.amount)}`}
                  danger
                  onClick={() => removePayment(payment.id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
