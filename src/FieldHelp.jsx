import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { autoUpdate, flip, FloatingPortal, offset, safePolygon, shift, useClick,
  useDismiss, useFloating, useFocus, useHover, useInteractions, useRole } from "@floating-ui/react";

const fieldHelp = {
  "Cupo total de la tarjeta": "Ingresa el límite de crédito aprobado por tu banco. Ejemplo: 5.000.000 para un cupo de $5.000.000. Para centavos usa la coma: 5.000.000,50. Puedes dejarlo vacío si no lo conoces.",
  "Cupo actual disponible": "Ingresa el cupo disponible que muestra tu banco, no el saldo de la deuda. Ejemplo: 3.200.000 disponibles con un cupo total de 5.000.000 dan un pago total pendiente de $1.800.000. Usa 0 si no tienes cupo; no se actualiza automáticamente.",
  "Saldo anterior (sin cuotas registradas)": "Ingresa solo el capital anterior que no está en la lista de compras, sin intereses. Ejemplo: si debes $800.000 y $300.000 ya están en compras registradas, ingresa 500000 para no duplicarlos.",
  "Cargos adicionales de este corte": "Ingresa intereses ya facturados u otros cargos exclusivos de este corte que no estén en los cargos mensuales. Ejemplo: 15000 para un cargo de $15.000. No repitas los intereses que calcula la aplicación.",
  "Abonos para este corte": "Ingresa los pagos que se descontarán del próximo corte. Ejemplo: 200000 si abonaste $200.000. No incluyas pagos ya reflejados en las cuotas pagadas o descontados del saldo anterior.",
  "Nombre de la tarjeta": "Ingresa un nombre para identificar esta tarjeta, sin su número ni datos bancarios. Ejemplo: Tarjeta principal.",
  "Nombre": "Ingresa un nombre para identificar la nueva tarjeta, sin su número ni datos bancarios. Ejemplo: Tarjeta de viajes.",
  "Fecha de cálculo": "Selecciona la fecha de referencia para estimar el próximo corte. Ejemplo: 05/10/2026; con corte el día 20, el siguiente será el 20/10/2026. Actualízala para un nuevo escenario.",
  "Día de corte": "Ingresa el día del mes en que tu banco cierra el extracto, no el día límite de pago. Ejemplo: 20. Si eliges 31, en febrero se usa su último día.",
  "Tasa de interés (%)": "Ingresa el porcentaje informado por el banco y selecciona su tipo de tasa. Ejemplo: 2 para una tasa del 2% mensual vencida, o 26.82 para una tasa del 26,82% efectiva anual. No ingreses 0.02 para indicar 2%.",
  "Tipo de tasa": "Selecciona la unidad de la tasa que ingresaste. Ejemplo: para 2% mensual elige MV; para 26,82% efectivo anual elige EA. La aplicación convierte EA a su equivalente mensual.",
  "Capital mínimo del saldo anterior (%)": "Ingresa el porcentaje de capital anterior exigido en el mínimo según tu banco. Ejemplo: 5 exige $50.000 de un saldo de $1.000.000, más intereses y otros conceptos. No es una regla universal.",
  "Piso de capital del saldo anterior": "Ingresa el mínimo en pesos de capital anterior, si tu banco lo exige. Ejemplo: 20000 exige al menos $20.000 de capital, sin superar el saldo. Usa 0 si no aplica.",
  "Cargos mensuales (manejo, seguro, etc.)": "Ingresa la suma de cargos que se repiten cada mes. Ejemplo: 30000 de manejo + 5000 de seguro = 35000. No los repitas en los cargos adicionales del corte.",
  "Compras a una cuota sin intereses": "Activa esta condición únicamente si tu banco no cobra intereses por compras a una cuota. Ejemplo: una compra de $100.000 genera $0 de intereses con la opción activa; desactívala si tu banco sí los cobra.",
  "Descripción": "Ingresa un nombre para reconocer la compra. Ejemplo: Mercado de octubre o Computador.",
  "Valor original de la compra": "Ingresa el valor total original, no el valor de una cuota ni el saldo restante. Ejemplo: 1.200.000 para una compra de $1.200.000, aunque ya hayas pagado algunas cuotas. Para centavos usa la coma: 1.200.000,50.",
  "Fecha de compra": "Selecciona el día de la compra. Ejemplo: 21/10/2026 con corte el día 20 empieza a facturarse el 20/11/2026. Una compra el día de corte se incluye en ese corte en esta estimación.",
  "Cuotas totales": "Ingresa la cantidad total de cuotas acordada para la compra. Ejemplo: 1 para pago en una cuota, o 12 para diferirla a doce cuotas. Si cambió el plazo, ingresa el nuevo total.",
  "Cuotas pagadas": "Ingresa cuántas cuotas completas ya pagaste en cortes anteriores. Ejemplo: 3 pagadas de 12 dejan 9 pendientes. No incluyas una cuota que aún no has pagado.",
  "Cuotas pendientes": "Ingresa cuántas cuotas quedan por pagar. Ejemplo: 9 pendientes de 12 actualizan las pagadas a 3. Usa 0 cuando la compra esté completamente pagada.",
  "Tasa particular (% MV, opcional)": "Déjalo vacío para usar la tasa de la tarjeta. Ingresa una tasa mensual solo si esta compra tiene otra condición. Ejemplo: 1.5 para 1,5% mensual, o 0 para una promoción sin intereses; la condición de una cuota sin intereses prevalece.",
  "Valor compra del extracto": "Copia el valor original de la columna Valor Compra, no el saldo actual. Ejemplo: 4.681.344 para REFINANCIAR DEUDA. En modo extracto el capital pendiente se toma del saldo reportado, no se reconstruye desde este valor.",
  "Fecha de transacción": "Copia la fecha original del movimiento. Ejemplo: 27/07/2026 para la refinanciación. No determina el inicio de la proyección en modo extracto; eso lo define Primer corte a proyectar.",
  "Fecha de proceso (opcional)": "Copia la fecha en que el banco procesó el movimiento. Ejemplo: transacción 14/08/2026 y proceso 18/08/2026. Se conserva como referencia; no se calcula interés diario con ella.",
  "Plazo del extracto": "Copia la columna Plazo como número de cuotas. Ejemplo: 06 se ingresa como 6. Los pagos y seguros con plazo 00 no se registran como compras diferidas.",
  "Cuotas pendientes del extracto": "Copia la columna Cuotas Pendientes. Ejemplo: 04 se ingresa como 4. No implica que las otras cuotas estén pagadas: el banco puede excluir aquí la cuota facturada en este corte.",
  "Saldo pendiente del extracto": "Copia el capital que reporta la columna Saldo Pendiente. Ejemplo: 1.340.629 para la refinanciación. Ese saldo puede excluir la cuota del mes ya facturada; revisa si está pagada antes de proyectar solo las cuotas futuras. No lo dupliques en Saldo anterior.",
  "Valor cuota mes (solo capital, opcional)": "Usa Valor Cuota Mes solo si el banco confirma que es capital sin intereses. Ejemplo: 335.158 para la refinanciación. Si incluye intereses o no estás seguro, déjalo vacío: se divide el saldo entre las cuotas pendientes. La última cuota ajusta el saldo restante.",
  "Tasa E.A. del extracto (%)": "Copia la tasa E.A. de ese movimiento, no una tasa mensual. Ejemplo: en este campo numérico 28.759 representa 28,759% efectivo anual; usa el punto como decimal, no como miles. La aplicación la convierte a mensual. Déjala vacía para usar la tasa configurada de la tarjeta.",
  "Primer corte a proyectar": "Selecciona el corte que corresponde a la primera cuota incluida en el saldo reportado. Ejemplo: si el extracto es de septiembre y el saldo excluye la cuota de septiembre, elige el corte de octubre. No asumas que la cuota de septiembre está pagada.",
};

export function FieldLabel({ label, inputId }) {
  const help = fieldHelp[label];
  return <div className="field-heading"><label className="field-title" htmlFor={inputId}>{label}</label>
    {help && <><FieldHelp label={label} text={help} /><span id={`${inputId}-help`} hidden>{help}</span></>}
  </div>;
}

function FieldHelp({ label, text }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen, placement: "bottom-start", strategy: "fixed", whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
  });
  const hover = useHover(context, { delay: { open: 150, close: 100 }, handleClose: safePolygon() });
  const focus = useFocus(context);
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, click, dismiss, role]);
  const portalRoot = refs.domReference.current?.closest("dialog") || undefined;
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return <>
    <button ref={refs.setReference} type="button" className="field-help-button" aria-label={`Ayuda: ${label}`} {...getReferenceProps({ onKeyDown: handleKeyDown })}><CircleHelp size={15} aria-hidden="true" /></button>
    {open && <FloatingPortal root={portalRoot}><div ref={refs.setFloating} className="field-tooltip" style={floatingStyles} {...getFloatingProps()}>{text}</div></FloatingPortal>}
  </>;
}
