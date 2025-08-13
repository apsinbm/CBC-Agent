'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'md' | 'lg'
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  description,
  children,
  size = 'lg'
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement
      
      // Focus the modal
      modalRef.current?.focus()
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
        
        // Return focus to previously focused element
        previouslyFocusedElement.current?.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidth = size === 'lg' ? 'max-w-3xl' : 'max-w-2xl'

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div 
        ref={modalRef}
        className={`bg-white rounded-xl sm:rounded-2xl ${maxWidth} w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-cbc-blue">
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-neutral-600">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 sm:p-0 ml-4"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}