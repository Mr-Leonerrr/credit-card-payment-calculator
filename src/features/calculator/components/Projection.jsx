import { ChartNoAxesCombined } from "lucide-react";
import { money } from "../model/calculator.js";
import { dateLabel } from "../../../utils/date.js";
import { Metric } from "../../../components/ui/Metric.jsx";
import { ProjectionChart } from "./ProjectionChart.jsx";

export function Projection({ workspace, setWorkspace, calculation }) {
  return (
    <section className="projection-view">
      <div className="section-heading">
        <h2>
          <ChartNoAxesCombined size={20} /> Próximos cortes
        </h2>
        <div className="segmented" aria-label="Meses de proyección">
          {[3, 6, 12].map((months) => (
            <button
              key={months}
              aria-pressed={workspace.horizon === months}
              className={workspace.horizon === months ? "active" : ""}
              onClick={() =>
                setWorkspace((previous) => ({ ...previous, horizon: months }))
              }
            >
              {months} meses
            </button>
          ))}
        </div>
      </div>
      <div className="balance-strip">
        <Metric
          label="Pagos mínimos por realizar"
          value={calculation.totalMinimum}
        />
        <Metric
          label="Intereses proyectados"
          value={calculation.totalInterest}
        />
        <Metric
          label="Capital al final del período"
          value={calculation.rows.at(-1).remaining}
        />
      </div>
      <ProjectionChart rows={calculation.rows} />
      <div className="table-scroll">
        <table>
          <caption>Proyección de pagos en pesos colombianos</caption>
          <thead>
            <tr>
              <th>Corte</th>
              <th>Capital anterior</th>
              <th>Capital compras</th>
              <th>Intereses</th>
              <th>Cargos</th>
              <th>Abonos</th>
              <th>Pago mínimo</th>
              <th>Capital restante</th>
            </tr>
          </thead>
          <tbody>
            {calculation.rows.map((row) => (
              <tr key={row.date}>
                <th scope="row">{dateLabel(row.date)}</th>
                <td>{money(row.previousCapital)}</td>
                <td>{money(row.purchaseCapital)}</td>
                <td className="interest-text">{money(row.interest)}</td>
                <td>{money(row.charges)}</td>
                <td>{money(row.payment)}</td>
                <td className="strong">{money(row.minimum)}</td>
                <td>{money(row.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="disclosure">
        Supuesto: pagas el mínimo estimado en cada corte, sin compras ni abonos
        nuevos. Los abonos registrados solo afectan el primer mes. El capital
        restante no incluye intereses futuros ni cargos.
      </p>
    </section>
  );
}
