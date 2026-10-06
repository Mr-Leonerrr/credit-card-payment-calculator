import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Field } from "../../../components/ui/Field.jsx";
import { IconButton } from "../../../components/ui/IconButton.jsx";

export function CreditLimitField({ label, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const locked = value !== "" && !editing;
  return (
    <div
      className="credit-field"
      onBlurCapture={(event) => {
        if (
          value !== "" &&
          !event.currentTarget.contains(event.relatedTarget) &&
          event.relatedTarget?.dataset.creditAction !== "true"
        )
          setEditing(false);
      }}
    >
      <Field
        label={label}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        onFocus={() => {
          if (value === "") setEditing(true);
        }}
        readOnly={locked}
        prefix="$"
        placeholder="Sin registrar"
      />
      {value !== "" && (
        <IconButton
          label={editing ? `Guardar ${label}` : `Editar ${label}`}
          data-credit-action="true"
          onClick={() => setEditing(!editing)}
        >
          {editing ? <Check size={16} /> : <Pencil size={16} />}
        </IconButton>
      )}
    </div>
  );
}
