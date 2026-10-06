import { money } from "../../features/calculator/model/calculator.js";

export function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value == null ? "Sin registrar" : money(value)}</strong>
    </div>
  );
}
