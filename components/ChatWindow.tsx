'use client'

import { useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isRendering?: boolean
  visibleContent?: string
}

interface ChatWindowProps {
  messages: Message[]
  isTyping: boolean
}

export default function ChatWindow({ messages, isTyping }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Additional effect to smooth scroll during progressive rendering
  useEffect(() => {
    const hasRenderingMessage = messages.some(msg => msg.isRendering)
    if (hasRenderingMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 scrollbar-thin hide-scrollbar-mobile">
      {messages.map((message) => {
        // Determine what content to display
        const displayContent = message.role === 'assistant' && message.visibleContent !== undefined 
          ? message.visibleContent 
          : message.content
        
        return (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
                message.role === 'user'
                  ? 'bg-cbc-blue text-white'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-sm sm:text-base select-text cursor-text">{displayContent}</p>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}