import test from "node:test";
import assert from "node:assert/strict";
import {
  nextCutoff,
  project,
  purchaseBalance,
  monthlyRate,
} from "./calculator.js";

const card = (changes = {}) => ({
  referenceDate: "2026-10-05",
  cutoffDay: 20,
  rate: 2,
  rateType: "monthly",
  minimumPercent: 10,
  minimumFloor: 0,
  previousBalance: 0,
  interestFreeSingle: true,
  recurringCharges: 0,
  extraCharges: 0,
  payments: 0,
  purchases: [],
  ...changes,
});
const purchase = (changes = {}) => ({
  id: "purchase",
  description: "Compra",
  amount: 1200000,
  installments: 12,
  paidInstallments: 0,
  date: "2026-10-01",
  ...changes,
});

test("saldo anterior no equivale al pago mínimo y no duplica compras", () => {
  const result = project(
    card({ previousBalance: 1000000, purchases: [purchase()] }),
    3,
  );
  assert.equal(result.purchaseBalance, 1200000);
  assert.equal(result.rows[0].capital, 200000);
  assert.equal(result.rows[0].interest, 44000);
  assert.equal(result.rows[0].minimum, 244000);
  assert.equal(result.rows[0].totalPayment, 2244000);
  assert.equal(result.rows[0].remaining, 2000000);
});
test("una cuota sin interés y compra después del corte", () => {
  const result = project(
    card({
      purchases: [
        purchase({ amount: 100000, installments: 1, date: "2026-10-21" }),
      ],
    }),
    3,
  );
  assert.equal(result.rows[0].minimum, 0);
  assert.equal(result.rows[1].minimum, 100000);
  assert.equal(result.rows[1].interest, 0);
  assert.equal(result.rows[2].remaining, 0);
});
test("cuotas pagadas reducen el saldo, cuotas terminadas desaparecen", () => {
  const item = purchase({ date: "2026-01-01", paidInstallments: 9 });
  assert.equal(purchaseBalance(item), 300000);
  const result = project(card({ purchases: [item] }), 6);
  assert.deepEqual(
    result.rows.slice(0, 3).map((row) => row.interest),
    [6000, 4000, 2000],
  );
  assert.equal(result.rows[3].minimum, 0);
});
test("corte en febrero, año bisiesto y compra el día del corte", () => {
  assert.equal(nextCutoff("2026-02-01", 31), "2026-02-28");
  assert.equal(nextCutoff("2024-02-01", 31), "2024-02-29");
  assert.equal(nextCutoff("2026-12-31", 20), "2027-01-20");
  assert.equal(nextCutoff("2026-10-20", 20), "2026-10-20");
});
test("abonos descuentan el pago sin negativos y el exceso reduce capital", () => {
  const result = project(card({ previousBalance: 100000, payments: 50000 }), 3);
  assert.equal(result.rows[0].minimum, 0);
  assert.equal(result.rows[0].remaining, 52000);
  assert.equal(result.rows[1].minimum, 6240);
  const overpaid = project(
    card({
      purchases: [purchase({ amount: 100, installments: 1 })],
      payments: 1000,
    }),
    3,
  );
  assert.equal(overpaid.rows[0].remaining, 0);
  assert.equal(overpaid.rows[0].unappliedPayment, 900);
});
test("tasa EA se convierte a mensual y una cuota puede generar intereses", () => {
  assert.ok(
    Math.abs(
      monthlyRate(card({ rate: 26.82417945625456, rateType: "annual" })) - 0.02,
    ) < 1e-10,
  );
  const result = project(
    card({
      interestFreeSingle: false,
      purchases: [purchase({ amount: 100000, installments: 1 })],
    }),
    3,
  );
  assert.equal(result.rows[0].interest, 2000);
});
test("una compra marcada al 0% no genera interés aunque otras compras sí", () => {
  const result = project(
    card({
      purchases: [
        purchase({ id: "promo", interestFree: true }),
        purchase({ id: "regular" }),
      ],
    }),
    1,
  );
  assert.equal(result.rows[0].details.find((item) => item.id === "promo").interest, 0);
  assert.equal(result.rows[0].details.find((item) => item.id === "regular").interest, 24000);
  assert.equal(result.rows[0].interest, 24000);
});
test("cargos recurrentes y puntuales son independientes del capital", () => {
  const result = project(
    card({ recurringCharges: 10000, extraCharges: 5000 }),
    12,
  );
  assert.equal(result.rows[0].minimum, 15000);
  assert.equal(result.rows[1].minimum, 10000);
  assert.equal(result.rows.length, 12);
});
test("corte día 31 no deriva después de febrero", () => {
  const result = project(
    card({ referenceDate: "2026-01-31", cutoffDay: 31 }),
    3,
  );
  assert.deepEqual(
    result.rows.map((row) => row.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});
test("cuotas completadas no generan capital ni intereses", () => {
  const result = project(
    card({ purchases: [purchase({ paidInstallments: 12 })] }),
    12,
  );
  assert.equal(result.purchaseBalance, 0);
  assert.ok(result.rows.every((row) => row.minimum === 0));
});
test("piso de capital no supera la deuda y tasas particulares se preservan", () => {
  const result = project(
    card({
      previousBalance: 1000,
      minimumFloor: 10000,
      purchases: [purchase({ rateOverride: "0" })],
    }),
    3,
  );
  assert.equal(result.rows[0].previousCapital, 1000);
  assert.equal(result.rows[0].interest, 20);
});
test("saldo anterior total con intereses incluidos solo genera interés nuevo sobre capital", () => {
  const result = project(
    card({
      previousBalance: 1000000,
      minimumPercent: 5,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 20000,
    }),
    3,
  );
  assert.equal(result.previousBalance, 980000);
  assert.equal(result.rows[0].interest, 19600);
  assert.equal(result.rows[0].charges, 20000);
  assert.equal(result.rows[0].capital, 49000);
  assert.equal(result.rows[0].minimum, 88600);
  assert.equal(result.rows[0].totalPayment, 1019600);
  assert.equal(result.rows[1].charges, 0);
  assert.equal(result.rows[1].interest, 18620);
});
test("saldo anterior mantiene su comportamiento de capital si el check queda apagado", () => {
  const result = project(
    card({ previousBalance: 1000000, previousBalanceIncludedCharges: "" }),
    2,
  );
  assert.equal(result.previousBalance, 1000000);
  assert.equal(result.rows[0].interest, 20000);
  assert.equal(result.rows[0].charges, 0);
});
test("el desglose incluido no puede superar el saldo anterior", () => {
  const result = project(
    card({
      previousBalance: 1000000,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 1500000,
    }),
    1,
  );
  assert.equal(result.previousBalance, 0);
  assert.equal(result.rows[0].charges, 1000000);
  assert.equal(result.rows[0].interest, 0);
});
test("abonos se restan como importe total pagado y el exceso reduce capital", () => {
  const result = project(
    card({
      previousBalance: 1000000,
      minimumPercent: 5,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 20000,
      payments: 205000,
    }),
    2,
  );
  assert.equal(result.rows[0].payment, 205000);
  assert.equal(result.rows[0].minimum, 0);
  assert.equal(result.rows[0].charges, 20000);
  assert.equal(result.rows[0].totalPayment, 814600);
});
test("saldo anterior con cargos incluidos calcula intereses nuevos solo sobre capital", () => {
  const result = project(
    card({
      previousBalance: 1000000,
      minimumPercent: 5,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 20000,
    }),
    2,
  );
  assert.equal(result.previousBalance, 980000);
  assert.equal(result.rows[0].interest, 19600);
  assert.equal(result.rows[0].charges, 20000);
  assert.equal(result.rows[0].capital, 49000);
  assert.equal(result.rows[0].totalPayment, 1019600);
  assert.equal(result.rows[1].charges, 0);
  assert.equal(result.rows[1].interest, 18620);
});
test("un abono con interés incluido se resta completo del mínimo, sin recalcular interés", () => {
  const withCharges = project(
    card({
      previousBalance: 1000000,
      minimumPercent: 5,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 20000,
      payments: 50000,
    }),
    2,
  );
  const withoutCharges = project(
    card({
      previousBalance: 1000000,
      minimumPercent: 5,
      previousBalanceIncludesCharges: true,
      previousBalanceIncludedCharges: 20000,
    }),
    2,
  );
  assert.equal(withCharges.rows[0].payment, 50000);
  assert.equal(withCharges.rows[0].interest, withoutCharges.rows[0].interest);
  assert.equal(withCharges.rows[0].minimum, withoutCharges.rows[0].minimum - 50000);
});
