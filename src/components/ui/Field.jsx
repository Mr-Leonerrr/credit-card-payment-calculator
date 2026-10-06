import { useEffect, useId, useRef } from "react";
import { NumericFormat } from "react-number-format";
import { FieldLabel } from "./FieldLabel.jsx";

export function Field({
  label,
  value,
  onChange,
  prefix,
  clampOnBlur = true,
  ...props
}) {
  const inputId = useId();
  const moneyRef = useRef(null);
  useEffect(() => {
    if (prefix !== "$") return;
    const belowMinimum =
      value !== "" && props.min != null && Number(value) < Number(props.min);
    const aboveMaximum =
      value !== "" && props.max != null && Number(value) > Number(props.max);
    moneyRef.current?.setCustomValidity(
      belowMinimum || aboveMaximum
        ? "Ingresa un valor dentro de los límites permitidos."
        : "",
    );
  }, [value, prefix, props.min, props.max]);
  const normalize = () => {
    if (!clampOnBlur || props.type !== "number" || value === "") return;
    let normalized = Number(value);
    if (!Number.isFinite(normalized)) normalized = Number(props.min || 0);
    if (props.min != null) normalized = Math.max(Number(props.min), normalized);
    if (props.max != null) normalized = Math.min(Number(props.max), normalized);
    if (props.step === "1") normalized = Math.trunc(normalized);
    if (normalized !== Number(value)) onChange(String(normalized));
  };
  const inputProps = {
    ...props,
    id: inputId,
    "aria-describedby": `${inputId}-help`,
    value,
    onBlur: (event) => {
      normalize();
      props.onBlur?.(event);
    },
  };
  return (
    <div className="field">
      <FieldLabel label={label} inputId={inputId} />
      <div className={prefix ? "input-wrap with-prefix" : "input-wrap"}>
        {prefix && (
          <span className="input-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        {prefix === "$" ? (
          <NumericFormat
            {...inputProps}
            type="text"
            inputMode="decimal"
            getInputRef={moneyRef}
            valueIsNumericString
            thousandSeparator="."
            decimalSeparator=","
            allowedDecimalSeparators={[","]}
            decimalScale={2}
            allowNegative={false}
            onValueChange={(values, sourceInfo) => {
              if (sourceInfo.source === "event") onChange(values.value);
            }}
          />
        ) : (
          <input
            {...inputProps}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </div>
  );
}
