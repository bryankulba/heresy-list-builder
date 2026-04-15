import React from 'react';
import { Modal } from '@carbon/react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  primaryButtonText?: string;
}

export default function ConfirmModal({ message, onConfirm, onClose, primaryButtonText = 'Remove' }: ConfirmModalProps) {
  return (
    <Modal
      open
      danger
      modalHeading="Confirm"
      primaryButtonText={primaryButtonText}
      secondaryButtonText="Cancel"
      onRequestSubmit={onConfirm}
      onRequestClose={onClose}
      size="xs"
    >
      <p style={{ color: 'var(--cds-text-primary)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
