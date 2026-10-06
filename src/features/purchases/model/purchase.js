import { today } from "../../calculator/model/calculator.js";

export const blankPurchase = () => ({
  id: crypto.randomUUID(),
  description: "",
  amount: "",
  installments: "1",
  paidInstallments: "0",
  date: today(),
  rateOverride: "",
  entryMode: "purchase",
  processDate: "",
  statementBalance: "",
  statementRemaining: "1",
  statementCapital: "",
  statementNextDate: "",
  rateOverrideType: "monthly",
});
