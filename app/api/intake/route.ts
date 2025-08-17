import { NextRequest, NextResponse } from 'next/server'
import { saveIntake } from '@/src/lib/storage'
import { safeLog } from '@/src/lib/pii-protection'

// Type definitions for different intake types
interface BaseIntake {
  fullName: string
  email: string
  phone?: string
  timestamp: string
  timezone: string
}

interface DiningIntake extends BaseIntake {
  partySize: number
  restaurant: string
  meal: string
  date: string
  time: string
  specialRequests?: string
}

interface TennisIntake extends BaseIntake {
  requestType: string
  players: number
  preferredDate: string
  preferredTime: string
  preferredSurface?: string
  proPreference?: string
  notes?: string
}

interface CourtsLawnSportsIntake extends BaseIntake {
  memberNumber?: string
  sportType: string
  requestType: string
  players: number
  preferredDate: string
  preferredTime: string
  preferredSurface?: string
  proPreference?: string
  notes?: string
}

interface SpaIntake extends BaseIntake {
  treatmentType: string
  duration?: string
  preferredDate: string
  preferredTimeWindow: string
  accessibilityRequests?: string
}

interface WeddingIntake extends BaseIntake {
  coupleNames: string
  guestCount: string
  preferredSeason?: string
  venuePreferences: string[]
  cateringStyle?: string
  budgetBand?: string
  hasPlanner?: string
  plannerName?: string
  vision?: string
}

type IntakePayload = DiningIntake | TennisIntake | CourtsLawnSportsIntake | SpaIntake | WeddingIntake

interface IntakeRequest {
  type: 'dining' | 'tennis' | 'courts-lawn-sports' | 'spa' | 'wedding' | 'plan-your-stay'
  payload: IntakePayload | any
}

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function validateName(name: string): boolean {
  return !!name && name.length >= 2 && name.length <= 100
}

function validatePhone(phone: string): boolean {
  if (!phone) return true // Optional field
  const phoneRegex = /^[\+\d\s\-\(\)]{6,20}$/
  return phoneRegex.test(phone)
}

function validateText(text: string, maxLength: number = 3000): boolean {
  return !text || text.length <= maxLength
}

// Type guards
function isDiningIntake(type: string, payload: any): payload is DiningIntake {
  return type === 'dining' && 
    payload.restaurant && 
    payload.meal && 
    payload.date && 
    payload.time &&
    typeof payload.partySize === 'number'
}

function isTennisIntake(type: string, payload: any): payload is TennisIntake {
  return type === 'tennis' && 
    payload.requestType && 
    payload.preferredDate && 
    payload.preferredTime &&
    typeof payload.players === 'number'
}

function isCourtsLawnSportsIntake(type: string, payload: any): payload is CourtsLawnSportsIntake {
  return type === 'courts-lawn-sports' && 
    payload.sportType &&
    payload.requestType && 
    payload.preferredDate && 
    payload.preferredTime &&
    typeof payload.players === 'number'
}

function isSpaIntake(type: string, payload: any): payload is SpaIntake {
  return type === 'spa' && 
    payload.treatmentType && 
    payload.preferredDate && 
    payload.preferredTimeWindow
}

function isWeddingIntake(type: string, payload: any): payload is WeddingIntake {
  return type === 'wedding' && 
    payload.coupleNames && 
    payload.guestCount
}

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now()
  const limit = rateLimitStore.get(ipHash)
  
  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(ipHash, {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // 1 hour
    })
    return true
  }
  
  if (limit.count >= 10) {
    return false
  }
  
  limit.count++
  return true
}

function hashIP(ip: string): string {
  // Simple hash for demo - use proper crypto in production
  return Buffer.from(ip).toString('base64')
}

// Generate subject lines for emails
function generateSubject(type: string, payload: any): string {
  const prefix = '[CBC]'
  
  switch (type) {
    case 'dining':
      return `${prefix} Dining request — ${payload.fullName}, ${payload.partySize} guests, ${payload.date} ${payload.meal}`
    case 'tennis':
      return `${prefix} Tennis ${payload.requestType} — ${payload.fullName}, ${payload.preferredDate}`
    case 'courts-lawn-sports':
      return `${prefix} ${payload.sportType} ${payload.requestType} — ${payload.fullName}, ${payload.preferredDate}`
    case 'spa':
      return `${prefix} Spa booking — ${payload.fullName}, ${payload.treatmentType}, ${payload.preferredDate}`
    case 'wedding':
      return `${prefix} Wedding enquiry — ${payload.coupleNames}, ${payload.guestCount} guests`
    default:
      return `${prefix} New ${type} enquiry`
  }
}


export async function POST(req: NextRequest) {
  try {
    const body: IntakeRequest = await req.json()
    const { type, payload } = body
    
    // Basic validation
    if (!type || !payload) {
      return NextResponse.json(
        { ok: false, message: 'Invalid request format' },
        { status: 400 }
      )
    }
    
    // Get IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const ipHash = hashIP(ip)
    
    // Rate limiting
    if (!checkRateLimit(ipHash)) {
      return NextResponse.json(
        { ok: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Common validation
    const errors: string[] = []
    
    if (!payload.fullName || !validateName(payload.fullName)) {
      errors.push('Please provide a valid name')
    }
    
    if (!payload.email || !validateEmail(payload.email)) {
      errors.push('Please provide a valid email address')
    }
    
    if (payload.phone && !validatePhone(payload.phone)) {
      errors.push('Please provide a valid phone number')
    }
    
    // Type-specific validation
    if (isDiningIntake(type, payload)) {
      if (payload.partySize < 1 || payload.partySize > 20) {
        errors.push('Party size must be between 1 and 20')
      }
      if (payload.specialRequests && !validateText(payload.specialRequests)) {
        errors.push('Special requests text is too long')
      }
    }
    
    if (isTennisIntake(type, payload)) {
      if (payload.players < 1 || payload.players > 8) {
        errors.push('Number of players must be between 1 and 8')
      }
      if (payload.notes && !validateText(payload.notes)) {
        errors.push('Notes text is too long')
      }
    }
    
    if (isCourtsLawnSportsIntake(type, payload)) {
      if (payload.players < 1 || payload.players > 8) {
        errors.push('Number of players must be between 1 and 8')
      }
      if (payload.notes && !validateText(payload.notes)) {
        errors.push('Notes text is too long')
      }
    }
    
    if (isSpaIntake(type, payload)) {
      if (payload.accessibilityRequests && !validateText(payload.accessibilityRequests)) {
        errors.push('Special requests text is too long')
      }
    }
    
    if (isWeddingIntake(type, payload)) {
      if (payload.vision && !validateText(payload.vision)) {
        errors.push('Vision text is too long')
      }
    }
    
    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, message: errors.join('. ') },
        { status: 400 }
      )
    }
    
    // Generate unique ID
    const intakeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Prepare data for storage
    const intakeData = {
      id: intakeId,
      type,
      payload: {
        ...payload,
        fullName: payload.fullName.trim(),
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone?.trim(),
      },
      createdAt: new Date().toISOString(),
      ipHash,
      userAgent: req.headers.get('user-agent') || 'unknown',
    }
    
    // Save to storage
    await saveIntake(intakeData)
    
    // Log (PII-safe version)
    safeLog('Intake Submission', 'New submission:', {
      id: intakeId,
      type,
      timestamp: intakeData.createdAt,
      payload
    })
    
    // Send email notification
    let emailSent = false
    try {
      const subject = generateSubject(type, payload)
      // Dynamic import of email module
      const { notifyReception } = await import('@/src/lib/email').catch(() => ({ notifyReception: null }))
      emailSent = notifyReception ? await notifyReception({
        type,
        subject,
        data: intakeData,
        sendGuestCopy: true
      }) : false
    } catch (emailError) {
      safeLog('Intake Email', 'Email notification failed:', emailError instanceof Error ? emailError.message : 'Unknown error')
      // Don't fail the request if email fails
    }
    
    // Return success
    return NextResponse.json({
      ok: true,
      id: intakeId,
      message: emailSent 
        ? 'Your request has been submitted successfully.'
        : 'Your request has been received. We\'ll process it shortly.',
    })
    
  } catch (error) {
    safeLog('Intake Error', 'Request processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { ok: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}