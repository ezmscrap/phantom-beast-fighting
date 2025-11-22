import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
}

export const Modal = ({ title, isOpen, onClose, children, footer }: ModalProps) => {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header>
          <h2>{title}</h2>
          {onClose ? (
            <button className="ghost" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          ) : null}
        </header>
        <section className="modal__body">{children}</section>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
