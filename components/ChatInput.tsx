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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSend(value)
      }
    }
  }

  return (
    <div className="border-t border-neutral-200 p-4">
      <div className="flex gap-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-neutral-300 px-4 py-3 
                   focus:outline-none focus:border-cbc-blue focus:ring-2 focus:ring-cbc-blue/20 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   placeholder:text-neutral-400"
        />
        <button
          onClick={() => onSend(value)}
          disabled={disabled || !value.trim()}
          className="px-6 py-3 bg-cbc-blue text-white rounded-xl font-medium
                   hover:bg-blue-700 transition-colors duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-cbc-blue/20"
        >
          Send
        </button>
      </div>
    </div>
  )
}