import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    
    const adminPassword = process.env.ADMIN_DASH_PASSWORD || 'choose-a-strong-password'
    
    // Simple password check (in production, use proper hashing)
    if (password === adminPassword) {
      return NextResponse.json({ authenticated: true })
    }
    
    return NextResponse.json({ authenticated: false })
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
}