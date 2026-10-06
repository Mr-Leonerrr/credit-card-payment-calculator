import { useState } from "react";
import { CircleHelp } from "lucide-react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";

export function FieldHelp({ label, text }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
  });
  const hover = useHover(context, {
    delay: { open: 150, close: 100 },
    handleClose: safePolygon(),
  });
  const focus = useFocus(context);
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    click,
    dismiss,
    role,
  ]);
  const portalRoot = refs.domReference.current?.closest("dialog") || undefined;
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="field-help-button"
        aria-label={`Ayuda: ${label}`}
        {...getReferenceProps({ onKeyDown: handleKeyDown })}
      >
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open && (
        <FloatingPortal root={portalRoot}>
          <div
            ref={refs.setFloating}
            className="field-tooltip"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {text}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
