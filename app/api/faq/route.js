import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Load FAQ data from data/faq/faq.json
    const faqPath = join(process.cwd(), 'data', 'faq', 'faq.json')
    const faqData = readFileSync(faqPath, 'utf8')
    const faqs = JSON.parse(faqData)
    
    return Response.json({
      success: true,
      faqs: faqs,
      count: faqs.length
    })
  } catch (error) {
    console.error('Error loading FAQ data:', error)
    return Response.json({
      success: false,
      error: 'Failed to load FAQ data',
      faqs: []
    }, { status: 500 })
  }
}