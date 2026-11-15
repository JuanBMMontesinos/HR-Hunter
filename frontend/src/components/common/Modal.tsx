import { X } from 'lucide-react';
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdropClick?: boolean;
}

function isOutsideDialogBounds(event: PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      dialog.returnValue = '';
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`hr-modal hr-modal--${size}`}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        onClose();
      }}
      onPointerDown={(event) => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        pointerDownOutsideRef.current = isOutsideDialogBounds(event, dialog);
      }}
      onPointerUp={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || !closeOnBackdropClick) return;
        if (pointerDownOutsideRef.current && isOutsideDialogBounds(event, dialog)) {
          dialog.close();
        }
        pointerDownOutsideRef.current = false;
      }}
    >
      <div className="hr-modal__header">
        <h2 id={titleId} className="hr-modal__title">
          {title}
        </h2>
        <button
          type="button"
          className="hr-modal__close"
          aria-label={t('common.close')}
          onClick={() => dialogRef.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="hr-modal__body">{children}</div>

      {footer ? <div className="hr-modal__footer">{footer}</div> : null}
    </dialog>
  );
}
