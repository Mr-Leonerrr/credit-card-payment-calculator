import test from "node:test";
import assert from "node:assert/strict";
import { project, purchaseBalance, purchaseMonthlyRate } from "./calculator.js";

const refinance = {
  id: "refinance",
  description: "Refinanciación ficticia",
  entryMode: "statement",
  amount: "2400000",
  installments: "6",
  date: "2025-01-10",
  statementBalance: "800003",
  statementRemaining: "4",
  statementCapital: "200001",
  statementNextDate: "2025-04-20",
  rateOverride: "24.5",
  rateOverrideType: "annual",
};
const card = {
  referenceDate: "2025-04-05",
  cutoffDay: 20,
  rate: "25",
  rateType: "annual",
  previousBalance: 0,
  minimumPercent: 5,
  minimumFloor: 0,
  recurringCharges: 0,
  extraCharges: 0,
  payments: 0,
  interestFreeSingle: true,
  purchases: [refinance],
};

test("extracto conserva el saldo de refinanciación sin reconstruirlo del valor original", () => {
  assert.equal(purchaseBalance(refinance), 800003);
  const result = project(card, 6);
  assert.equal(result.purchaseBalance, 800003);
  assert.deepEqual(
    result.rows.map((row) => row.purchaseCapital),
    [200001, 200001, 200001, 200000, 0, 0],
  );
  assert.equal(result.rows[3].remaining, 0);
});
test("tasa particular EA se convierte a mensual sin confundirla con MV", () => {
  const rate = Math.pow(1 + 24.5 / 100, 1 / 12) - 1;
  assert.equal(purchaseMonthlyRate(refinance, 0.02), rate);
  assert.equal(project(card, 3).rows[0].interest, 800003 * rate);
  assert.equal(purchaseMonthlyRate({ rateOverride: "2" }, 0), 0.02);
});
test("sin capital reportado divide saldo entre cuotas restantes y liquida la última", () => {
  const result = project(
    { ...card, purchases: [{ ...refinance, statementCapital: "" }] },
    6,
  );
  assert.equal(result.rows[0].purchaseCapital, 200000.75);
  assert.equal(result.rows[3].remaining, 0);
});
test("primer corte explícito no depende de pagos supuestos ni de la fecha original", () => {
  const result = project(
    { ...card, purchases: [{ ...refinance, statementNextDate: "2025-05-20" }] },
    6,
  );
  assert.equal(result.rows[0].minimum, 0);
  assert.equal(result.rows[1].purchaseCapital, 200001);
});
test("permite iniciar la proyección desde un primer corte pasado sin acumular cuotas vencidas", () => {
  const result = project(
    { ...card, purchases: [{ ...refinance, statementNextDate: "2025-02-20" }] },
    4,
  );
  assert.deepEqual(
    result.rows.map((row) => row.purchaseCapital),
    [200001, 200001, 200001, 200000],
  );
  assert.equal(result.rows[0].date, "2025-04-20");
});
test("seis movimientos ficticios suman sus saldos sin duplicación", () => {
  const entries = [
    refinance,
    {
      ...refinance,
      id: "example-purchase",
      amount: "600000",
      installments: "4",
      statementBalance: "300000",
      statementRemaining: "2",
      statementCapital: "150000",
    },
    ...[20000, 30000, 40000, 50000].map((balance, index) => ({
      ...refinance,
      id: `purchase-${index}`,
      installments: "2",
      statementRemaining: "1",
      statementBalance: String(balance),
      statementCapital: String(balance),
    })),
  ];
  const result = project({ ...card, purchases: entries }, 6);
  assert.equal(result.purchaseBalance, 1240003);
  assert.equal(result.rows[0].purchaseCapital, 490001);
  assert.equal(result.rows[3].remaining, 0);
});
