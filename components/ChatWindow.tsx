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
  }, [messages.map(msg => msg.visibleContent).join()])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
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
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-cbc-blue text-white'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{displayContent}</p>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}