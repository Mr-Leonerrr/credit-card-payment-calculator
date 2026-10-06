import test from "node:test";
import assert from "node:assert/strict";
import { money, project } from "./calculator.js";

const card = {
  referenceDate: "2026-10-05",
  cutoffDay: 20,
  rate: 2,
  rateType: "monthly",
  previousBalance: 100000,
  minimumPercent: 5,
  minimumFloor: 0,
  recurringCharges: 1000,
  extraCharges: 2000,
  payments: 10000,
  interestFreeSingle: true,
  creditLimit: "5000000",
  availableCredit: "3200000",
  purchases: [
    {
      id: "later",
      amount: 60000,
      installments: 3,
      paidInstallments: 1,
      date: "2026-10-21",
    },
  ],
};

test("total pendiente es cupo total menos disponible, independiente del corte y horizonte", () => {
  const result = project(card, 3);
  assert.equal(result.purchaseBalance, 40000);
  assert.equal(result.rows[0].totalPayment, 95000);
  assert.equal(result.totalPending, 1800000);
  assert.equal(project(card, 12).totalPending, result.totalPending);
  assert.equal(
    project({ ...card, previousBalance: 0, purchases: [], payments: 200000 }, 3)
      .totalPending,
    result.totalPending,
  );
});

test("total pendiente diferencia cupos sin registrar de cupos cero y no es negativo", () => {
  assert.equal(project({ ...card, availableCredit: "" }, 3).totalPending, null);
  assert.equal(project({ ...card, creditLimit: "" }, 3).totalPending, null);
  assert.equal(
    project({ ...card, creditLimit: undefined }, 3).totalPending,
    null,
  );
  assert.equal(
    project({ ...card, availableCredit: "0" }, 3).totalPending,
    5000000,
  );
  assert.equal(
    project({ ...card, creditLimit: "0", availableCredit: "0" }, 3)
      .totalPending,
    0,
  );
  assert.equal(
    project({ ...card, availableCredit: "6000000" }, 3).totalPending,
    0,
  );
});

test("total pendiente conserva centavos y no cambia el pago al corte", () => {
  const result = project(
    { ...card, creditLimit: "5000000.75", availableCredit: "3200000.25" },
    3,
  );
  assert.equal(result.totalPending, 1800000.5);
  assert.equal(result.rows[0].totalPayment, 95000);
});
test("formato monetario usa puntos de miles y coma decimal sin perder centavos", () => {
  assert.ok(money("1234567.89").includes("1.234.567,89"));
  assert.ok(money("2500.50").includes("2.500,5"));
  assert.ok(money("5000000").includes("5.000.000"));
});
