import { money } from "../model/calculator.js";
import { dateLabel } from "../../../utils/date.js";
import { Legend } from "./Legend.jsx";

export function ProjectionChart({ rows }) {
  const maximum = Math.max(1, ...rows.map((row) => row.grossMinimum));
  return (
    <div className="projection-chart">
      <div className="chart-caption">
        <span>Composición del pago antes de abonos</span>
        <Legend />
      </div>
      <div className="chart-bars">
        {rows.map((row) => (
          <div className="chart-column" key={row.date}>
            <div
              className="chart-track"
              role="img"
              aria-label={`${dateLabel(row.date)}: capital ${money(row.capital)}, intereses ${money(row.interest)}, cargos ${money(row.charges)}`}
              title={`${dateLabel(row.date)}: ${money(row.grossMinimum)}`}
            >
              <div
                className="chart-stack"
                style={{ height: `${(row.grossMinimum / maximum) * 100}%` }}
              >
                <span className="chart-charge" style={{ flex: row.charges }} />
                <span
                  className="chart-interest"
                  style={{ flex: row.interest }}
                />
                <span className="chart-capital" style={{ flex: row.capital }} />
              </div>
            </div>
            <span className="chart-month">
              {new Intl.DateTimeFormat("es-CO", {
                month: "short",
                timeZone: "UTC",
              }).format(new Date(`${row.date}T00:00:00Z`))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
