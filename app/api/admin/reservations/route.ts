import { NextRequest, NextResponse } from 'next/server'
import { getReservations } from '@/src/lib/storage'

export async function GET(req: NextRequest) {
  try {
    // In production, verify session/auth token here
    const reservations = await getReservations(100)
    
    return NextResponse.json({
      ok: true,
      reservations,
    })
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}