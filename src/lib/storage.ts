import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

interface ReservationData {
  id: string
  fullName: string
  email: string
  phone?: string
  countryCity?: string
  arrivalDate: string
  departureDate: string
  numberOfGuests: number
  partyBreakdown?: string
  accommodationPreference?: string
  budgetRange?: string
  airlineInfo?: string
  memberStatus?: string
  specialRequests?: string
  consent: boolean
  consentTimestamp: string
  createdAt: string
  ipHash?: string
  userAgent?: string
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

export function generateReservationId(): string {
  return uuidv4()
}

export async function saveReservation(data: ReservationData): Promise<string> {
  const baseDir = process.env.DATA_INTAKE_DIR || './data/intake/reservations'
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const dirPath = path.join(baseDir, today)
  
  await ensureDirectoryExists(dirPath)
  
  const fileName = `${data.id}.json`
  const filePath = path.join(dirPath, fileName)
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  
  return filePath
}

export async function getReservations(limit: number = 100): Promise<ReservationData[]> {
  const baseDir = process.env.DATA_INTAKE_DIR || './data/intake/reservations'
  const reservations: ReservationData[] = []
  
  try {
    const dates = await fs.readdir(baseDir)
    dates.sort().reverse() // Most recent first
    
    for (const date of dates) {
      if (reservations.length >= limit) break
      
      const datePath = path.join(baseDir, date)
      const stat = await fs.stat(datePath)
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(datePath)
        
        for (const file of files) {
          if (reservations.length >= limit) break
          if (!file.endsWith('.json')) continue
          
          const filePath = path.join(datePath, file)
          const content = await fs.readFile(filePath, 'utf-8')
          
          try {
            const reservation = JSON.parse(content) as ReservationData
            reservations.push(reservation)
          } catch (err) {
            console.error(`Failed to parse ${filePath}:`, err)
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading reservations:', err)
  }
  
  return reservations
}

export async function searchReservations(query: string): Promise<ReservationData[]> {
  const allReservations = await getReservations(1000)
  const lowerQuery = query.toLowerCase()
  
  return allReservations.filter(res => 
    res.fullName.toLowerCase().includes(lowerQuery) ||
    res.email.toLowerCase().includes(lowerQuery) ||
    res.arrivalDate.includes(query) ||
    res.id.includes(query)
  )
}

export async function saveIntake(data: any): Promise<string> {
  const baseDir = process.env.DATA_INTAKE_DIR || './data/intake'
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const dirPath = path.join(baseDir, data.type, today)
  
  await ensureDirectoryExists(dirPath)
  
  const fileName = `${data.id}.json`
  const filePath = path.join(dirPath, fileName)
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  
  return filePath
}