'use client'

export default function TypingIndicator() {
  return (
    <div className="flex justify-start px-6">
      <div className="bg-neutral-100 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    </div>
  )
}