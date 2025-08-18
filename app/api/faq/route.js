import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'

export async function GET() {
  try {
    // Load comprehensive FAQ data from data/faqs.yaml
    const faqPath = join(process.cwd(), 'data', 'faqs.yaml')
    const faqData = readFileSync(faqPath, 'utf8')
    const yamlData = yaml.load(faqData)
    
    // Transform YAML structure to match component expectations
    const categories = yamlData.categories.map(category => ({
      id: category.id,
      title: category.title,
      icon: getIconForCategory(category.id),
      order: getCategoryOrder(category.id),
      items: category.faqs.map((faq, index) => ({
        id: faq.id || `${category.id}-${index}`,
        question: faq.q,
        answer: faq.a,
        answerHtml: faq.a,
        tags: faq.tags || [],
        updatedAt: faq.updatedAt
      }))
    }))
    
    // Sort categories by order
    categories.sort((a, b) => a.order - b.order)
    
    return Response.json({
      success: true,
      faqs: categories,
      count: categories.reduce((total, cat) => total + cat.items.length, 0)
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

// Helper function to get icon for category
function getIconForCategory(categoryId) {
  const iconMap = {
    'membership-access': 'question-circle',
    'rooms-cottages': 'heart',
    'dining': 'utensils',
    'tennis-lawn-sports': 'tennis-ball',
    'spa': 'heart',
    'weddings-events': 'heart',
    'getting-here': 'car',
    'weather-seasons': 'island',
    'policies-billing': 'bell',
    'children-families': 'heart',
    'activities-recreation': 'island',
    'wifi-technology': 'bell',
    'concierge-services': 'bell',
    'special-occasions': 'heart'
  }
  return iconMap[categoryId] || 'question-circle'
}

// Helper function to get category display order
function getCategoryOrder(categoryId) {
  const orderMap = {
    'membership-access': 1,
    'rooms-cottages': 2,
    'dining': 3,
    'tennis-lawn-sports': 4,
    'spa': 5,
    'activities-recreation': 6,
    'weddings-events': 7,
    'children-families': 8,
    'getting-here': 9,
    'weather-seasons': 10,
    'wifi-technology': 11,
    'concierge-services': 12,
    'special-occasions': 13,
    'policies-billing': 14
  }
  return orderMap[categoryId] || 99
}