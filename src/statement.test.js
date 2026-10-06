import test from "node:test";
import assert from "node:assert/strict";
import { project, purchaseBalance, purchaseMonthlyRate } from "./calculator.js";

const refinance = {
  id: "refinance", description: "REFINANCIAR DEUDA", entryMode: "statement",
  amount: "4681344", installments: "6", date: "2026-07-27",
  statementBalance: "1340629", statementRemaining: "4", statementCapital: "335158",
  statementNextDate: "2026-10-16", rateOverride: "28.759", rateOverrideType: "annual",
};
const card = {
  referenceDate: "2026-10-05", cutoffDay: 16, rate: "29.21", rateType: "annual",
  previousBalance: 0, minimumPercent: 5, minimumFloor: 0, recurringCharges: 0,
  extraCharges: 0, payments: 0, interestFreeSingle: true, purchases: [refinance],
};

test("extracto conserva el saldo de refinanciación sin reconstruirlo del valor original", () => {
  assert.equal(purchaseBalance(refinance), 1340629);
  const result = project(card, 6);
  assert.equal(result.purchaseBalance, 1340629);
  assert.deepEqual(result.rows.map((row) => row.purchaseCapital), [335158, 335158, 335158, 335155, 0, 0]);
  assert.equal(result.rows[3].remaining, 0);
});
test("tasa particular EA se convierte a mensual sin confundirla con MV", () => {
  const rate = Math.pow(1 + 28.759 / 100, 1 / 12) - 1;
  assert.equal(purchaseMonthlyRate(refinance, 0.02), rate);
  assert.equal(project(card, 3).rows[0].interest, 1340629 * rate);
  assert.equal(purchaseMonthlyRate({ rateOverride: "2" }, 0), 0.02);
});
test("sin capital reportado divide saldo entre cuotas restantes y liquida la última", () => {
  const result = project({ ...card, purchases: [{ ...refinance, statementCapital: "" }] }, 6);
  assert.equal(result.rows[0].purchaseCapital, 335157.25);
  assert.equal(result.rows[3].remaining, 0);
});
test("primer corte explícito no depende de pagos supuestos ni de la fecha original", () => {
  const result = project({ ...card, purchases: [{ ...refinance, statementNextDate: "2026-11-16" }] }, 6);
  assert.equal(result.rows[0].minimum, 0);
  assert.equal(result.rows[1].purchaseCapital, 335158);
});
test("los seis saldos pendientes de las imágenes suman 2401555 sin duplicación", () => {
  const entries = [
    refinance,
    { ...refinance, id: "latam", amount: "1411320", installments: "4", statementBalance: "705660", statementRemaining: "2", statementCapital: "352830" },
    ...[68141, 107575, 84200, 95350].map((balance, index) => ({ ...refinance,
      id: `purchase-${index}`, installments: "2", statementRemaining: "1", statementBalance: String(balance), statementCapital: String(balance),
    })),
  ];
  const result = project({ ...card, purchases: entries }, 6);
  assert.equal(result.purchaseBalance, 2401555);
  assert.equal(result.rows[0].purchaseCapital, 1043254);
  assert.equal(result.rows[3].remaining, 0);
});
