'use client'

import { useState, KeyboardEvent } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      // Only send if not disabled and has content
      if (value.trim() && !disabled) {
        onSend(value)
      }
      // If disabled, the Enter key just prevents default (no newline, no send)
    }
  }

  return (
    <div className="border-t border-neutral-200 p-3 sm:p-4 bg-white" aria-busy={disabled}>
      <div className="flex gap-2 sm:gap-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Alonso..."
          rows={1}
          disabled={false} // Never disable the textarea itself
          style={{ backgroundColor: 'white', color: 'black' }}
          className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 sm:px-4 sm:py-3 
                   bg-white text-black
                   text-base sm:text-base no-zoom webkit-appearance-none
                   focus:outline-none focus:border-cbc-blue focus:ring-2 focus:ring-cbc-blue/20 
                   focus:bg-white focus:text-black
                   hover:bg-white hover:text-black
                   placeholder:text-neutral-400
                   min-h-[2.5rem] sm:min-h-[3rem]"
        />
        <button
          onClick={() => onSend(value)}
          disabled={disabled || !value.trim()}
          aria-disabled={disabled || !value.trim()}
          className="px-4 py-2 sm:px-6 sm:py-3 bg-cbc-blue text-white rounded-xl font-medium
                   text-sm sm:text-base
                   hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-cbc-blue/20
                   touch-manipulation"
        >
          <span className="hidden sm:inline">Send</span>
          <span className="sm:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  )
}