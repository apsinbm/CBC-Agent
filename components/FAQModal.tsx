'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Search, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

export interface FAQItem {
  id: string
  question: string
  answer: string
  answerHtml: string
}

export interface FAQCategory {
  id: string
  title: string
  icon: string
  order: number
  items: FAQItem[]
}

// Icon mapping
const iconMap: Record<string, any> = {
  'car': '🚗',
  'bell': '🔔',
  'utensils': '🍽️',
  'tennis-ball': '🎾',
  'island': '🏝️',
  'heart': '💕',
  'question-circle': '❓'
}

interface FAQModalProps {
  isOpen: boolean
  onClose: () => void
}

// Search FAQs
const searchFAQs = (categories: FAQCategory[], query: string): FAQItem[] => {
  const lowerQuery = query.toLowerCase()
  const results: FAQItem[] = []
  
  for (const category of categories) {
    for (const item of category.items) {
      // Search in question and answer
      if (
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery)
      ) {
        results.push(item)
      }
    }
  }
  
  return results
}

// Get FAQ by ID (for deep linking)
const getFAQById = (categories: FAQCategory[], id: string): FAQItem | null => {
  for (const category of categories) {
    const item = category.items.find(i => i.id === id)
    if (item) return item
  }
  return null
}

export default function FAQModal({ isOpen, onClose }: FAQModalProps) {
  const [categories, setCategories] = useState<FAQCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load FAQs when modal opens
  useEffect(() => {
    if (isOpen && categories.length === 0) {
      setLoading(true)
      fetch('/api/faq')
        .then(res => res.json())
        .then(data => {
          if (data.faqs && Array.isArray(data.faqs)) {
            setCategories(data.faqs)
            if (data.faqs.length > 0 && !selectedCategory) {
              setSelectedCategory(data.faqs[0].id)
            }
            
            // Check for deep link
            const hash = window.location.hash
            if (hash.startsWith('#faq=')) {
              const faqId = hash.substring(5)
              handleDeepLink(faqId, data.faqs)
            }
          }
          setLoading(false)
        })
        .catch(error => {
          console.error('Error loading FAQs:', error)
          setLoading(false)
        })
    }
  }, [isOpen, categories.length, selectedCategory])

  // Handle deep linking
  const handleDeepLink = (faqId: string, cats: FAQCategory[]) => {
    const item = getFAQById(cats, faqId)
    if (item) {
      // Find category
      const category = cats.find(c => c.items.some(i => i.id === faqId))
      if (category) {
        setSelectedCategory(category.id)
        setExpandedItems(new Set([faqId]))
        // Scroll to item after render
        setTimeout(() => {
          const element = document.getElementById(faqId)
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }

  // Toggle expanded state
  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        // On mobile, collapse others
        if (isMobile) {
          newSet.clear()
        }
        newSet.add(itemId)
        // Update URL hash
        window.location.hash = `faq=${itemId}`
      }
      return newSet
    })
  }, [isMobile])

  // Copy answer to clipboard
  const copyAnswer = useCallback(async (item: FAQItem) => {
    try {
      await navigator.clipboard.writeText(`Q: ${item.question}\n\nA: ${item.answer}`)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  // Filter items based on search
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchFAQs(categories, searchQuery)
    }
    
    const category = categories.find(c => c.id === selectedCategory)
    return category?.items || []
  }, [categories, selectedCategory, searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Panel */}
      <div className="absolute inset-x-4 inset-y-4 md:inset-x-auto md:inset-y-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90%] md:max-w-5xl md:h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cbc-blue to-blue-700 text-white p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold">Frequently Asked Questions</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close FAQ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search all FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="faq-search-input w-full pl-10 pr-4 py-3 rounded-lg transition-all duration-200"
              autoComplete="off"
            />
          </div>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Category Sidebar (Desktop) / Horizontal Scroll (Mobile) */}
          {!searchQuery && (
            <div className={`${isMobile ? 'w-full border-b' : 'w-64 border-r flex flex-col'} border-gray-200 bg-gray-50`}>
              <div className={`${isMobile ? 'flex overflow-x-auto p-2' : 'flex-1 overflow-y-auto p-4'}`}>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`
                      ${isMobile ? 'flex-shrink-0 px-4 py-2 mr-2' : 'w-full px-4 py-3 mb-2'}
                      flex items-center gap-3 rounded-lg transition-colors text-left
                      ${selectedCategory === category.id 
                        ? 'bg-cbc-blue text-white' 
                        : 'hover:bg-gray-200 text-gray-700'}
                    `}
                  >
                    <span className="text-xl">{iconMap[category.icon] || '📋'}</span>
                    <span className={`font-medium ${isMobile ? 'whitespace-nowrap' : ''}`}>
                      {category.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* FAQ Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading FAQs...</div>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">
                  {searchQuery ? 'No FAQs found matching your search.' : 'No FAQs available in this category.'}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {searchQuery && (
                  <div className="text-sm text-gray-600 mb-4">
                    Found {displayItems.length} result{displayItems.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </div>
                )}
                
                {displayItems.map((item) => (
                  <div
                    key={item.id}
                    id={item.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      aria-expanded={expandedItems.has(item.id)}
                      aria-controls={`answer-${item.id}`}
                    >
                      <span className="font-medium text-gray-900 pr-4">
                        {item.question}
                      </span>
                      {expandedItems.has(item.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                    
                    {expandedItems.has(item.id) && (
                      <div
                        id={`answer-${item.id}`}
                        className="px-4 pb-4 border-t border-gray-100"
                      >
                        <div className="pt-3 flex justify-between items-start gap-4">
                          <div 
                            className="prose prose-sm max-w-none text-gray-700"
                            dangerouslySetInnerHTML={{ __html: item.answerHtml }}
                          />
                          <button
                            onClick={() => copyAnswer(item)}
                            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Copy answer"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}