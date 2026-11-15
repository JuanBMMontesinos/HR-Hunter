import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'solid';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={variant}
            onClick={() => void onConfirm()}
            disabled={loading}
            data-testid="confirm-modal-submit"
          >
            {loading ? t('common.loading') : (confirmLabel ?? t('common.delete'))}
          </Button>
        </>
      }
    >
      <p className="hr-confirm-message">{message}</p>
    </Modal>
  );
}
