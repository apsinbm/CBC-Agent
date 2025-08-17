import { NextRequest, NextResponse } from 'next/server'
import { saveReservation, generateReservationId, hashIP } from '@/src/lib/storage'
import { safeLog } from '@/src/lib/pii-protection'

// Rate limiting store (in-memory for dev, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function validateName(name: string): boolean {
  const nameRegex = /^[a-zA-Z\s\-']{2,100}$/
  return nameRegex.test(name)
}

function validatePhone(phone: string): boolean {
  // Allow international formats
  const phoneRegex = /^[\+\d\s\-\(\)]{6,20}$/
  return !phone || phoneRegex.test(phone)
}

function validateDate(date: string): boolean {
  const d = new Date(date)
  return !isNaN(d.getTime()) && d >= new Date(new Date().setHours(0,0,0,0))
}

function validateDateRange(arrival: string, departure: string): boolean {
  const arr = new Date(arrival)
  const dep = new Date(departure)
  return dep >= arr // Changed to allow same-day check-in/out
}

function validateGuests(num: number | string): boolean {
  const parsed = typeof num === 'string' ? parseInt(num) : num
  return !isNaN(parsed) && parsed >= 1 && parsed <= 12
}

function validateText(text: string, maxLength: number = 500): boolean {
  return !text || text.length <= maxLength
}

function validatePlanningMode(mode: string): boolean {
  return mode === 'certain' || mode === 'unsure'
}

function validateInterests(interests: any): boolean {
  if (!interests || !Array.isArray(interests)) return true // Optional field
  return interests.length <= 10 && interests.every(i => typeof i === 'string' && i.length <= 50)
}

// Rate limiting
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
  
  if (limit.count >= 5) {
    return false
  }
  
  limit.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    
    // Honeypot check
    if (data.website) {
      return NextResponse.json(
        { ok: false, message: "We couldn't process that. Please try again or use the form." },
        { status: 400 }
      )
    }
    
    // Get IP and hash it
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const ipHash = hashIP(ip)
    
    // Rate limiting
    if (!checkRateLimit(ipHash)) {
      return NextResponse.json(
        { ok: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Validation
    const errors: string[] = []
    
    if (!data.fullName || !validateName(data.fullName)) {
      errors.push('Please provide a valid full name')
    }
    
    if (!data.email || !validateEmail(data.email)) {
      errors.push('Please provide a valid email address')
    }
    
    if (data.phone && !validatePhone(data.phone)) {
      errors.push('Please provide a valid phone number')
    }
    
    // Validate planning mode
    if (!data.planningMode || !validatePlanningMode(data.planningMode)) {
      errors.push('Please select a valid planning mode')
    }
    
    // Dates are now optional regardless of planning mode
    // If provided, validate them
    if (data.arrivalDate && !validateDate(data.arrivalDate)) {
      errors.push('If providing an arrival date, it must be valid')
    }
    
    if (data.departureDate && !validateDate(data.departureDate)) {
      errors.push('If providing a departure date, it must be valid')
    }
    
    // If both dates are provided, validate departure >= arrival
    if (data.arrivalDate && data.departureDate) {
      const arr = new Date(data.arrivalDate)
      const dep = new Date(data.departureDate)
      if (dep < arr) {
        errors.push('Departure date must be on or after arrival date')
      }
    }
    
    if (!data.numberOfGuests || !validateGuests(data.numberOfGuests)) {
      errors.push('Number of guests must be between 1 and 12')
    }
    
    if (data.countryCity && !validateText(data.countryCity, 120)) {
      errors.push('Country/city is too long')
    }
    
    if (data.specialRequests && !validateText(data.specialRequests, 500)) {
      errors.push('Special requests text is too long')
    }
    
    if (data.bookingQuestion && !validateText(data.bookingQuestion, 3000)) {
      errors.push('Booking question is too long')
    }
    
    if (data.interests && !validateInterests(data.interests)) {
      errors.push('Invalid interests selection')
    }
    
    if (data.otherInterest && !validateText(data.otherInterest, 100)) {
      errors.push('Other interest description is too long')
    }
    
    if (!data.consent) {
      errors.push('Consent is required to process your inquiry')
    }
    
    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, message: errors.join('. ') },
        { status: 400 }
      )
    }
    
    // Generate ID and timestamps
    const reservationId = generateReservationId()
    const now = new Date().toISOString()
    
    // Prepare data for storage
    const reservationData = {
      id: reservationId,
      fullName: data.fullName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim(),
      countryCity: data.countryCity?.trim(),
      planningMode: data.planningMode,
      arrivalDate: data.arrivalDate || null,
      departureDate: data.departureDate || null,
      numberOfGuests: typeof data.numberOfGuests === 'string' ? parseInt(data.numberOfGuests) : data.numberOfGuests,
      partyBreakdown: data.partyBreakdown?.trim(),
      accommodationPreference: data.accommodationPreference,
      budgetRange: data.budgetRange,
      airlineInfo: data.airlineInfo?.trim(),
      memberStatus: data.memberStatus?.trim(),
      bookingQuestion: data.bookingQuestion?.trim(),
      interests: data.interests || [],
      otherInterest: data.otherInterest?.trim(),
      specialBookingQuestions: data.specialBookingQuestions?.trim(),
      datesUndecided: data.datesUndecided || false,
      specialRequests: data.specialRequests?.trim(),
      consent: true,
      consentTimestamp: now,
      createdAt: now,
      ipHash,
      userAgent: req.headers.get('user-agent') || 'unknown',
    }
    
    // Save to file system
    await saveReservation(reservationData)
    
    // Send email notification (don't fail if email fails)
    let emailSent = false
    try {
      const subject = `New Reservation Inquiry – ${reservationData.arrivalDate || 'Flexible Dates'} – ${reservationData.fullName}`
      
      // Prepare data for notifyReception
      const intakeData = {
        id: reservationId,
        type: 'plan-your-stay',
        payload: reservationData,
        createdAt: now,
        ipHash,
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
      
      // Dynamic import of email module
      const { notifyReception } = await import('@/src/lib/email').catch(() => ({ notifyReception: null }))
      emailSent = notifyReception ? await notifyReception({
        type: 'plan-your-stay',
        subject,
        data: intakeData,
        sendGuestCopy: true
      }) : false
      
    } catch (emailError) {
      safeLog('Reservation Email', 'Email notification failed:', emailError instanceof Error ? emailError.message : 'Unknown error')
    }
    
    // TODO: Write to Airtable/Sheets if configured
    // This would go here with try/catch for graceful failure
    
    // Return success
    if (!emailSent) {
      return NextResponse.json({
        ok: true,
        id: reservationId,
        createdAt: now,
        message: `We've received your details and will follow up shortly. Reference: ${reservationId}`,
      })
    }
    
    return NextResponse.json({
      ok: true,
      id: reservationId,
      createdAt: now,
    })
    
  } catch (error) {
    safeLog('Reservation Error', 'Request processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { ok: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}