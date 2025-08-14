'use client'

import { useState, useRef, useEffect } from 'react'
import ChatWindow from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import TypingIndicator from '@/components/TypingIndicator'
import ActionBar from '@/components/ActionBar'
import HandoffModal from '@/components/HandoffModal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isRendering?: boolean
  visibleContent?: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Good day—this is Alonso. How may I help with your stay?',
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showHandoffModal, setShowHandoffModal] = useState(false)
  const [lastUserMessage, setLastUserMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to split text into sentences
  const splitIntoSentences = (text: string): string[] => {
    // Split on sentence endings while preserving punctuation and handling edge cases
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 0)
    
    // If no sentences found (no punctuation), split by line breaks or return as single sentence
    if (sentences.length === 0 || (sentences.length === 1 && sentences[0] === text)) {
      const lines = text.split('\n').filter(line => line.trim().length > 0)
      return lines.length > 1 ? lines : [text]
    }
    
    return sentences
  }

  // Function to render text progressively
  const renderProgressively = (messageId: string, fullContent: string) => {
    if (fullContent.length < 80) {
      // Short messages: display instantly
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, visibleContent: fullContent, isRendering: false }
          : msg
      ))
      return
    }

    // Long messages: progressive rendering
    const sentences = splitIntoSentences(fullContent)
    let currentSentenceIndex = 0
    let visibleText = sentences[0] || ''

    // Display first sentence immediately
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, visibleContent: visibleText, isRendering: true }
        : msg
    ))

    // Function to reveal next sentence
    const revealNextSentence = () => {
      currentSentenceIndex++
      if (currentSentenceIndex < sentences.length) {
        visibleText += ' ' + sentences[currentSentenceIndex]
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, visibleContent: visibleText }
            : msg
        ))
        
        // Schedule next sentence with random delay 150-250ms
        const delay = Math.random() * 100 + 150
        renderTimeoutRef.current = setTimeout(revealNextSentence, delay)
      } else {
        // All sentences revealed
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, visibleContent: fullContent, isRendering: false }
            : msg
        ))
      }
    }

    // Start revealing subsequent sentences
    if (sentences.length > 1) {
      const delay = Math.random() * 100 + 150
      renderTimeoutRef.current = setTimeout(revealNextSentence, delay)
    } else {
      // Only one sentence, finish immediately
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, visibleContent: fullContent, isRendering: false }
          : msg
      ))
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
    }
  }, [])

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)
    setLastUserMessage(message) // Store for potential handoff

    // Start timing for minimum 1-second delay
    const startTime = Date.now()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Check if response has low confidence (for handoff prompt)
      const showHandoffPrompt = data.confidence && data.confidence < 0.5

      let assistantContent = data.reply
      if (showHandoffPrompt && !assistantContent.includes('Reception team')) {
        assistantContent += '\n\nWould you like our Reception team to follow up with you directly about this?'
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        isRendering: true,
        visibleContent: '',
      }

      // Stop typing indicator before rendering starts
      setIsTyping(false)
      
      // Add message immediately and start progressive rendering
      setMessages((prev) => [...prev, assistantMessage])
      
      // Clear any existing render timeout
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
      
      // Start progressive rendering
      renderProgressively(assistantMessage.id, data.reply)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        isRendering: true,
        visibleContent: '',
      }
      
      // Stop typing indicator before rendering starts
      setIsTyping(false)
      
      // Add error message immediately and start progressive rendering
      setMessages((prev) => [...prev, errorMessage])
      
      // Clear any existing render timeout
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
      
      // Start progressive rendering for error message
      renderProgressively(errorMessage.id, errorMessage.content)
    }
  }

  return (
    <main className="flex min-h-screen bg-gradient-to-br from-cbc-sand/20 to-neutral-50">
      <div className="container mx-auto max-w-6xl p-2 sm:p-4">
        <div className="flex flex-col h-[100vh] sm:h-[calc(100vh-2rem)] bg-white sm:rounded-2xl shadow-xl overflow-hidden">
          <header className="bg-gradient-to-r from-cbc-blue to-blue-700 text-white py-[1.8px] px-3 sm:py-[1.8px] sm:px-6">
            <div className="flex justify-between items-center">
              <div className="min-w-0 flex-1">
                <h1 className="text-white font-bold text-[19.4px] sm:text-[21.8px] lg:text-[24.2px] truncate">Coral Beach & Tennis Club</h1>
                <p className="text-white text-[14.5px] sm:text-[16.9px] opacity-90 font-semibold truncate">Guest Assistant Alonso at your service</p>
              </div>
              <a 
                href="https://www.coralbeachclub.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mr-3"
                aria-label="Visit Coral Beach Club website"
              >
                <img 
                  src="/Bird-CBC2.png" 
                  alt="CBC Logo" 
                  className="h-[40.9px] sm:h-[58.3px] w-auto object-contain hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          </header>

          <ChatWindow messages={messages} isTyping={isTyping} />
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            disabled={isTyping}
          />
          
          <ActionBar />
        </div>
      </div>
      
      {/* Handoff Modal */}
      <HandoffModal
        isOpen={showHandoffModal}
        onClose={() => setShowHandoffModal(false)}
        lastMessage={lastUserMessage}
        transcript={messages}
        onSuccess={() => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "I've sent your inquiry to our Reception team. They'll follow up with you soon."
          }])
        }}
      />
    </main>
  )
}