import { today } from "../../calculator/model/calculator.js";

export const blankPurchase = () => ({
  id: crypto.randomUUID(),
  description: "",
  amount: "",
  installments: "1",
  paidInstallments: "0",
  date: today(),
  rateOverride: "",
  interestFree: false,
  entryMode: "purchase",
  processDate: "",
  statementBalance: "",
  statementRemaining: "1",
  statementCapital: "",
  statementPayment: "",
  statementIncludesExtras: false,
  statementExtraAmount: "",
  statementNextDate: "",
  rateOverrideType: "monthly",
});
