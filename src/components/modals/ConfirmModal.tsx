import React from 'react';
import { Modal } from '@carbon/react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({ message, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal
      open
      danger
      modalHeading="Confirm"
      primaryButtonText="Remove"
      secondaryButtonText="Cancel"
      onRequestSubmit={onConfirm}
      onRequestClose={onClose}
      size="xs"
    >
      <p style={{ color: 'var(--cds-text-primary)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
