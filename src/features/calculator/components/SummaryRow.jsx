import { money } from "../model/calculator.js";

export function SummaryRow({ label, value, negative, accent }) {
  return (
    <div className={`summary-row ${accent ? "interest-text" : ""}`}>
      <span>{label}</span>
      <strong>
        {negative && Number(value) > 0 ? "- " : ""}
        {money(value)}
      </strong>
    </div>
  );
}
