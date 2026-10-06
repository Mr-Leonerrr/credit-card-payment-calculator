import { ArrowUpRight } from "lucide-react";
import { money } from "../model/calculator.js";
import { dateLabel } from "../../../utils/date.js";
import { SummaryRow } from "./SummaryRow.jsx";
import { Legend } from "./Legend.jsx";

export function PaymentSummary({ card, calculation, current, setTab }) {
  return (
    <aside className="statement">
      <div className="statement-header">
        <span>Pago mínimo estimado</span>
        <strong>{money(current.minimum)}</strong>
        <span>{dateLabel(current.date)}</span>
      </div>
      <div className="statement-body">
        <SummaryRow
          label="Capital del saldo anterior"
          value={current.previousCapital}
        />
        <SummaryRow
          label="Capital de compras"
          value={current.purchaseCapital}
        />
        <SummaryRow label="Intereses" value={current.interest} accent />
        <SummaryRow label="Cargos" value={current.charges} />
        <SummaryRow label="Abonos registrados" value={card.payments} negative />
        <div className="statement-total">
          <span>Pago total al corte</span>
          <strong>{money(current.totalPayment)}</strong>
        </div>
        <div className="statement-total general-total">
          <span>Pago total pendiente estimad</span>
          <strong>
            {calculation.totalPending == null
              ? "Sin registrar"
              : money(calculation.totalPending)}
          </strong>
        </div>
        <div
          className="composition"
          role="img"
          aria-label={`Capital ${money(current.capital)}, intereses ${money(current.interest)}, cargos ${money(current.charges)}`}
        >
          <div className="composition-bar">
            <span style={{ flex: current.capital }} />
            <span style={{ flex: current.interest }} />
            <span style={{ flex: current.charges }} />
          </div>
          <Legend />
        </div>
        <p className="statement-note">
          Pago total: capital facturable e intereses de este corte, menos
          abonos. No incluye compras con primer corte futuro.
        </p>
        <p className="statement-note">
          Pago total pendiente: cupo total de la tarjeta menos cupo actual
          disponible, según los valores informados por tu banco. No se suman
          nuevamente compras, intereses, cargos ni abonos.
        </p>
        {current.unappliedPayment > 0 && (
          <p className="statement-note">
            Abono excedente no aplicado: {money(current.unappliedPayment)}.
          </p>
        )}
        <button
          className="button text-button"
          onClick={() => setTab("projection")}
        >
          Ver proyección <ArrowUpRight size={16} />
        </button>
      </div>
    </aside>
  );
}
