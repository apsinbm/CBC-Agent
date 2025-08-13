import { NextResponse } from 'next/server'
import { loadAllFAQs } from '@/src/lib/faqParser'

export async function GET() {
  try {
    const faqs = await loadAllFAQs()
    return NextResponse.json({ faqs })
  } catch (error) {
    console.error('Error loading FAQs:', error)
    return NextResponse.json({ faqs: [], error: 'Failed to load FAQs' }, { status: 500 })
  }
}