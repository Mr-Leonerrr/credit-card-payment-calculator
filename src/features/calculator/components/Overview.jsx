import { CreditCard, Wallet, Plus } from "lucide-react";
import { Field } from "../../../components/ui/Field.jsx";
import { FieldLabel } from "../../../components/ui/FieldLabel.jsx";
import { Metric } from "../../../components/ui/Metric.jsx";
import { SectionHeading } from "../../../components/ui/SectionHeading.jsx";
import { PurchaseFields } from "../../purchases/components/PurchaseFields.jsx";
import { PurchaseList } from "../../purchases/components/PurchaseList.jsx";
import { CreditLimitField } from "../../cards/components/CreditLimitField.jsx";
import { PaymentSummary } from "./PaymentSummary.jsx";

export function Overview({
  card,
  calculation,
  current,
  fieldChange,
  draft,
  setDraft,
  addPurchase,
  setEditing,
  setConfirmation,
  updateCard,
  setTab,
  setAvailableCredit,
  removePurchase,
}) {
  return (
    <>
      <div className="balance-strip">
        <Metric
          label="Cupo total de la tarjeta"
          value={card.creditLimit === "" ? null : card.creditLimit}
        />
        <Metric
          label="Cupo actual disponible"
          value={card.availableCredit === "" ? null : card.availableCredit}
        />
        <Metric
          label="Pago total pendiente estimado"
          value={calculation.totalPending}
        />
      </div>
      <div className="balance-strip">
        <Metric
          label="Capital pendiente total"
          value={calculation.previousBalance + calculation.purchaseBalance}
        />
        <Metric
          label="Saldo de compras anteriores"
          value={calculation.previousBalance}
        />
        <Metric
          label="Capital de cuotas pendientes"
          value={calculation.purchaseBalance}
        />
      </div>
      <div className="overview-grid">
        <div className="overview-body">
          <section className="section">
            <SectionHeading icon={CreditCard} title="Cupo de la tarjeta" />
            <div className="field-grid two">
              <CreditLimitField
                label="Cupo total de la tarjeta"
                value={card.creditLimit}
                onChange={fieldChange("creditLimit")}
              />
              <CreditLimitField
                label="Cupo actual disponible"
                value={card.availableCredit}
                onChange={setAvailableCredit}
              />
            </div>
            <p className="disclosure">
              Los cupos informados quedan bloqueados. Las compras nuevas los
              reducen y los pagos registrados los aumentan automáticamente.
            </p>
            {card.creditLimit !== "" &&
              card.availableCredit !== "" &&
              Number(card.availableCredit) > Number(card.creditLimit) && (
                <p className="disclosure interest-text" role="status">
                  El cupo disponible supera el cupo total. Revisa los valores
                  registrados.
                </p>
              )}
          </section>
          <section className="section">
            <SectionHeading icon={Wallet} title="Saldo anterior y abonos" />
            <div className="field-grid three">
              <Field
                label="Saldo anterior (sin cuotas registradas)"
                type="number"
                min="0"
                step="0.01"
                value={card.previousBalance}
                onChange={fieldChange("previousBalance")}
                prefix="$"
              />
              <div className="statement-extra-option">
                <div>
                  <FieldLabel
                    label="¿Este saldo ya incluye intereses o cargos?"
                    inputId="previous-balance-includes-charges"
                  />
                  <small>
                    Sepáralos del capital para no volver a calcularles interés.
                  </small>
                </div>
                <input
                  id="previous-balance-includes-charges"
                  type="checkbox"
                  role="switch"
                  checked={card.previousBalanceIncludesCharges === true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateCard({
                      previousBalanceIncludesCharges: checked,
                      previousBalanceIncludedCharges: checked
                        ? card.previousBalanceIncludedCharges
                        : "",
                    });
                  }}
                />
              </div>
              {card.previousBalanceIncludesCharges && (
                <Field
                  label="Intereses/cargos ya incluidos en el saldo"
                  type="number"
                  min="0"
                  max={card.previousBalance || undefined}
                  step="0.01"
                  value={card.previousBalanceIncludedCharges}
                  onChange={fieldChange("previousBalanceIncludedCharges")}
                  prefix="$"
                  placeholder="Importe ya facturado"
                  required
                />
              )}
              <Field
                label="Cargos adicionales de este corte"
                type="number"
                min="0"
                step="0.01"
                value={card.extraCharges}
                onChange={fieldChange("extraCharges")}
                prefix="$"
              />
              <Field
                label="Otros abonos para el próximo corte"
                type="number"
                min="0"
                step="0.01"
                value={card.payments}
                onChange={fieldChange("payments")}
                prefix="$"
              />
            </div>
            <p className="disclosure">
              Los pagos registrados en la pestaña Pagos se suman aquí; ingresa
              solo otros abonos que no estén en el historial.
            </p>
            <details className="assumptions">
              <summary>Condiciones del cálculo</summary>
              <p>
                El saldo anterior es capital no registrado en la lista de
                compras. No lo ingreses dos veces. Los abonos se descuentan solo
                del próximo corte; el exceso reduce primero el saldo anterior y
                después las compras. Las cuotas pagadas deben reflejar los pagos
                de cortes anteriores.
              </p>
            </details>
          </section>
          <section className="section purchase-entry">
            <SectionHeading icon={Plus} title="Agregar movimiento" />
            <form onSubmit={addPurchase}>
              <PurchaseFields
                purchase={draft}
                onChange={setDraft}
                nextDate={current.date}
              />
              <div className="form-actions">
                <button className="button primary" type="submit">
                  <Plus size={17} /> Agregar compra
                </button>
              </div>
            </form>
          </section>
          <PurchaseList
            card={card}
            current={current}
            setEditing={setEditing}
            setConfirmation={setConfirmation}
            removePurchase={removePurchase}
          />
        </div>
        <PaymentSummary
          card={card}
          calculation={calculation}
          current={current}
          setTab={setTab}
        />
      </div>
    </>
  );
}
