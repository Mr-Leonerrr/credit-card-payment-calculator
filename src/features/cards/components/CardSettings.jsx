import { Settings2, Trash2 } from "lucide-react";
import { integer, monthlyRate } from "../../calculator/model/calculator.js";
import { Field } from "../../../components/ui/Field.jsx";
import { FieldLabel } from "../../../components/ui/FieldLabel.jsx";
import { SectionHeading } from "../../../components/ui/SectionHeading.jsx";

export function CardSettings({
  card,
  fieldChange,
  updateCard,
  setConfirmation,
  removeCard,
}) {
  return (
    <section className="settings-view">
      <SectionHeading icon={Settings2} title="Condiciones de la tarjeta" />
      <div className="field-grid settings-grid">
        <Field
          label="Nombre de la tarjeta"
          maxLength={80}
          value={card.name}
          onChange={fieldChange("name")}
        />
        <Field
          label="Fecha de cálculo"
          type="date"
          value={card.referenceDate}
          onChange={(value) => {
            if (value && !Number.isNaN(Date.parse(value)))
              updateCard({ referenceDate: value });
          }}
        />
        <Field
          label="Día de corte"
          type="number"
          min="1"
          max="31"
          step="1"
          value={card.cutoffDay}
          onChange={(value) =>
            updateCard({ cutoffDay: String(integer(value, 1, 31)) })
          }
        />
        <Field
          label="Tasa de interés (%)"
          type="number"
          min="0"
          max={card.rateType === "annual" ? "1000" : "100"}
          step="0.001"
          value={card.rate}
          onChange={fieldChange("rate")}
        />
        <div className="field">
          <FieldLabel label="Tipo de tasa" inputId="rate-type" />
          <select
            id="rate-type"
            aria-describedby="rate-type-help"
            value={card.rateType}
            onChange={(event) => updateCard({ rateType: event.target.value })}
          >
            <option value="monthly">Mensual vencida (MV)</option>
            <option value="annual">Efectiva anual (EA)</option>
          </select>
        </div>
        <div className="rate-equivalent">
          <span>Tasa mensual equivalente</span>
          <strong>{(monthlyRate(card) * 100).toFixed(2)}%</strong>
        </div>
        <Field
          label="Capital mínimo del saldo anterior (%)"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={card.minimumPercent}
          onChange={fieldChange("minimumPercent")}
        />
        <Field
          label="Piso de capital del saldo anterior"
          type="number"
          min="0"
          step="0.01"
          value={card.minimumFloor}
          onChange={fieldChange("minimumFloor")}
          prefix="$"
        />
        <Field
          label="Cargos mensuales (manejo, seguro, etc.)"
          type="number"
          min="0"
          step="0.01"
          value={card.recurringCharges}
          onChange={fieldChange("recurringCharges")}
          prefix="$"
        />
      </div>
      <div className="toggle-row">
        <div>
          <FieldLabel
            label="Compras a una cuota sin intereses"
            inputId="interest-free-single"
          />
          <small>Según las condiciones de tu entidad</small>
        </div>
        <input
          id="interest-free-single"
          aria-describedby="interest-free-single-help"
          type="checkbox"
          role="switch"
          checked={card.interestFreeSingle}
          onChange={(event) =>
            updateCard({ interestFreeSingle: event.target.checked })
          }
        />
      </div>
      <div className="model-disclosure">
        <h3>Modelo de estimación</h3>
        <p>
          Compras diferidas: capital constante (valor ÷ cuotas) e interés
          mensual sobre el capital pendiente. Saldo anterior: el mayor entre el
          porcentaje y el piso configurados, limitado al saldo disponible, más
          sus intereses. Se suman las cuotas exigibles y los cargos. El 5%
          inicial es un supuesto editable, no una regla bancaria.
        </p>
        <p>
          Una compra realizada el día de corte se incluye en ese corte. Los
          meses cortos usan su último día. La próxima cuota es la primera no
          pagada, pero nunca se proyecta antes de la fecha de cálculo. No se
          estiman cuotas vencidas, mora ni intereses diarios.
        </p>
      </div>
      <div className="danger-zone">
        <div>
          <h3>Eliminar tarjeta</h3>
          <p>Se eliminarán también sus compras y condiciones.</p>
        </div>
        <button
          className="button danger"
          onClick={() =>
            setConfirmation({
              title: "¿Eliminar esta tarjeta?",
              text: `Se eliminarán ${card.name} y todas sus compras. Esta acción no se puede deshacer.`,
              action: removeCard,
            })
          }
        >
          <Trash2 size={16} /> Eliminar
        </button>
      </div>
    </section>
  );
}
