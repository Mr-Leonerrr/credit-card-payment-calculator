import { fieldHelp } from "../../data/fieldHelp.js";
import { FieldHelp } from "./FieldHelp.jsx";

export function FieldLabel({ label, inputId }) {
  const help = fieldHelp[label];
  return (
    <div className="field-heading">
      <label className="field-title" htmlFor={inputId}>
        {label}
      </label>
      {help && (
        <>
          <FieldHelp label={label} text={help} />
          <span id={`${inputId}-help`} hidden>
            {help}
          </span>
        </>
      )}
    </div>
  );
}
