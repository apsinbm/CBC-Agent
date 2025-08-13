import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

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

const FAQ_DIR = path.join(process.cwd(), 'data', 'faq')

// Convert markdown to HTML
const markdownToHtml = async (markdown: string): Promise<string> => {
  const result = await remark().use(html).process(markdown)
  return result.toString()
}

// Generate slug from text
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Parse a single FAQ file
export const parseFAQFile = async (filename: string): Promise<FAQCategory | null> => {
  try {
    const filePath = path.join(FAQ_DIR, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    
    // Parse frontmatter
    const { data, content } = matter(fileContents)
    
    // Extract category info
    const categoryId = path.basename(filename, '.md')
    const category: FAQCategory = {
      id: categoryId,
      title: data.title || categoryId,
      icon: data.icon || 'question-circle',
      order: data.order || 999,
      items: []
    }
    
    // Split content into Q&A pairs
    const sections = content.split(/^## Q:/gm).filter(s => s.trim())
    
    for (const section of sections) {
      const lines = section.trim().split('\n')
      const questionLine = lines[0].trim()
      
      // Find where the answer starts (after "A:" marker)
      const answerStartIndex = lines.findIndex(line => line.trim().startsWith('A:'))
      if (answerStartIndex === -1) continue
      
      const answerLines = lines.slice(answerStartIndex)
      const answerText = answerLines
        .join('\n')
        .replace(/^A:\s*/, '')
        .trim()
      
      const answerHtml = await markdownToHtml(answerText)
      
      const item: FAQItem = {
        id: `${categoryId}-${generateSlug(questionLine)}`,
        question: questionLine,
        answer: answerText,
        answerHtml: answerHtml
      }
      
      category.items.push(item)
    }
    
    return category
  } catch (error) {
    console.error(`Error parsing FAQ file ${filename}:`, error)
    return null
  }
}

// Load all FAQ categories
export const loadAllFAQs = async (): Promise<FAQCategory[]> => {
  try {
    // Check if FAQ directory exists
    if (!fs.existsSync(FAQ_DIR)) {
      console.warn('FAQ directory does not exist:', FAQ_DIR)
      return []
    }
    
    // Get all .md files
    const files = fs.readdirSync(FAQ_DIR).filter(f => f.endsWith('.md') && f !== 'README.md')
    
    // Parse all files
    const categories = await Promise.all(files.map(parseFAQFile))
    
    // Filter out nulls and sort by order
    return categories
      .filter((c): c is FAQCategory => c !== null)
      .sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Error loading FAQs:', error)
    return []
  }
}

// Search FAQs
export const searchFAQs = (categories: FAQCategory[], query: string): FAQItem[] => {
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
export const getFAQById = (categories: FAQCategory[], id: string): FAQItem | null => {
  for (const category of categories) {
    const item = category.items.find(i => i.id === id)
    if (item) return item
  }
  return null
}