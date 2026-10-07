import { integer } from "../../calculator/model/calculator.js";
import { Field } from "../../../components/ui/Field.jsx";
import { FieldLabel } from "../../../components/ui/FieldLabel.jsx";

export function PurchaseFields({
  purchase,
  onChange,
  editing = false,
  nextDate,
}) {
  const fromStatement = purchase.entryMode === "statement";
  const change = (field, value) =>
    onChange((previous) => {
      const updated = { ...previous, [field]: value };
      if (field === "installments" && value !== "") {
        updated.paidInstallments = String(
          Math.min(integer(previous.paidInstallments, 0, 120), integer(value)),
        );
        updated.statementRemaining = String(
          Math.min(
            integer(previous.statementRemaining ?? 1, 0, 120),
            integer(value),
          ),
        );
      }
      if (field === "entryMode") {
        updated.rateOverride = "";
        updated.rateOverrideType = value === "statement" ? "annual" : "monthly";
        updated.statementNextDate = previous.statementNextDate || nextDate;
      }
      if (field === "statementIncludesExtras" && !value) {
        updated.statementExtraAmount = "";
      }
      return updated;
    });
  const total = integer(purchase.installments);
  const paid = integer(purchase.paidInstallments, 0, total);
  return (
    <div className="purchase-fields">
      <div
        className="segmented purchase-mode"
        aria-label="Origen del movimiento"
      >
        <button
          type="button"
          aria-pressed={!fromStatement}
          className={!fromStatement ? "active" : ""}
          onClick={() => change("entryMode", "purchase")}
        >
          Nueva compra
        </button>
        <button
          type="button"
          aria-pressed={fromStatement}
          className={fromStatement ? "active" : ""}
          onClick={() => change("entryMode", "statement")}
        >
          Desde extracto
        </button>
      </div>
      {!fromStatement && (
        <div className="segmented purchase-mode" aria-label="Tipo de compra">
          <button
            type="button"
            aria-pressed={total === 1}
            className={total === 1 ? "active" : ""}
            onClick={() => change("installments", "1")}
          >
            Una cuota
          </button>
          <button
            type="button"
            aria-pressed={total > 1}
            className={total > 1 ? "active" : ""}
            onClick={() => change("installments", "3")}
          >
            Diferida
          </button>
        </div>
      )}
      <div className="field-grid two">
        <Field
          label="Descripción"
          value={purchase.description}
          onChange={(value) => change("description", value)}
          required
          maxLength={120}
          placeholder="Ej. Mercado"
        />
        <Field
          label={
            fromStatement
              ? "Valor compra del extracto"
              : "Valor original de la compra"
          }
          type="number"
          min="0.01"
          max="1000000000000"
          step="0.01"
          value={purchase.amount}
          onChange={(value) => change("amount", value)}
          prefix="$"
          required
        />
        <Field
          label={fromStatement ? "Fecha de transacción" : "Fecha de compra"}
          type="date"
          value={purchase.date}
          onChange={(value) => change("date", value)}
          required
        />
        {fromStatement && (
          <Field
            label="Fecha de proceso (opcional)"
            type="date"
            value={purchase.processDate || ""}
            onChange={(value) => change("processDate", value)}
          />
        )}
        <Field
          label={fromStatement ? "Plazo del extracto" : "Cuotas totales"}
          type="number"
          min="1"
          max="120"
          step="1"
          value={purchase.installments}
          onChange={(value) => change("installments", value)}
          required
        />
        {fromStatement ? (
          <>
            <Field
              label="Cuotas pendientes del extracto"
              type="number"
              min={Number(purchase.statementBalance) > 0 ? "1" : "0"}
              max={total}
              step="1"
              clampOnBlur={false}
              value={purchase.statementRemaining ?? "1"}
              onChange={(value) => change("statementRemaining", value)}
              required
            />
            <Field
              label="Saldo pendiente del extracto"
              type="number"
              min={Number(purchase.statementRemaining) > 0 ? "0.01" : "0"}
              step="0.01"
              clampOnBlur={false}
              value={purchase.statementBalance ?? ""}
              onChange={(value) => change("statementBalance", value)}
              prefix="$"
              required
            />
            <Field
              label="Valor cuota mes total reportado"
              type="number"
              min="0.01"
              step="0.01"
              value={purchase.statementPayment ?? ""}
              onChange={(value) => change("statementPayment", value)}
              prefix="$"
              placeholder="Incluye el interés E.A. del mes"
              required={purchase.statementIncludesExtras}
            />
            <div className="statement-extra-option">
              <div>
                <FieldLabel
                  label="¿Incluye mora u otros adicionales?"
                  inputId={`statement-extra-${purchase.id}`}
                />
                <small>Desglosa el valor para no contarlo como capital</small>
              </div>
              <input
                id={`statement-extra-${purchase.id}`}
                type="checkbox"
                role="switch"
                checked={purchase.statementIncludesExtras === true}
                onChange={(event) =>
                  change("statementIncludesExtras", event.target.checked)
                }
              />
            </div>
            {purchase.statementIncludesExtras && (
              <Field
                label="Valor adicional incluido en la cuota"
                type="number"
                min="0"
                step="0.01"
                value={purchase.statementExtraAmount ?? ""}
                onChange={(value) => change("statementExtraAmount", value)}
                prefix="$"
                required
                placeholder="Ej.: mora incluida en la cuota"
              />
            )}
            <Field
              label="Tasa E.A. del extracto (%)"
              type="number"
              min="0"
              max="1000"
              step="0.001"
              value={purchase.rateOverride}
              onChange={(value) => change("rateOverride", value)}
              placeholder="Tasa de la tarjeta"
            />
            <Field
              label="Primer corte a proyectar"
              type="date"
              value={purchase.statementNextDate || nextDate}
              onChange={(value) => change("statementNextDate", value)}
              required
            />
          </>
        ) : (
          <>
            <div className="statement-extra-option">
              <div>
                <FieldLabel
                  label="Esta compra tiene interés 0%"
                  inputId={`purchase-interest-free-${purchase.id}`}
                />
                <small>
                  Actívalo para promociones sin interés, según las condiciones
                  del comercio.
                </small>
              </div>
              <input
                id={`purchase-interest-free-${purchase.id}`}
                type="checkbox"
                role="switch"
                checked={purchase.interestFree === true}
                onChange={(event) =>
                  change("interestFree", event.target.checked)
                }
              />
            </div>
            <Field
              label="Cuotas pagadas"
              type="number"
              min="0"
              max={total}
              step="1"
              value={purchase.paidInstallments}
              onChange={(value) => change("paidInstallments", value)}
              required
            />
            <Field
              label="Cuotas pendientes"
              type="number"
              min="0"
              max={total}
              step="1"
              value={total - paid}
              onChange={(value) =>
                change(
                  "paidInstallments",
                  String(total - integer(value, 0, total)),
                )
              }
              required
            />
            {purchase.interestFree !== true && (
              <Field
                label="Tasa particular (% MV, opcional)"
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={purchase.rateOverride}
                onChange={(value) => change("rateOverride", value)}
                placeholder="Tasa de la tarjeta"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
