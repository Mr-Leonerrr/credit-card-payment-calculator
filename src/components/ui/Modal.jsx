import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton.jsx";

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const close = (event) => {
    event.preventDefault();
    onClose();
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (ref.current.querySelector('[role="tooltip"]')) {
      event.preventDefault();
      return;
    }
    close(event);
  };
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={close}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <IconButton label="Cerrar ventana" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
