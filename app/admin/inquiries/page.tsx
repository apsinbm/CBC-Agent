'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Reservation {
  id: string
  fullName: string
  email: string
  phone?: string
  countryCity?: string
  planningMode: string
  arrivalDate: string | null
  departureDate: string | null
  numberOfGuests: number
  partyBreakdown?: string
  accommodationPreference?: string
  budgetRange?: string
  airlineInfo?: string
  memberStatus?: string
  bookingQuestion?: string
  interests?: string[]
  otherInterest?: string
  specialRequests?: string
  createdAt: string
}

export default function AdminInquiries() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if already authenticated (session storage)
    const auth = sessionStorage.getItem('admin-auth')
    if (auth === 'authenticated') {
      setIsAuthenticated(true)
      loadReservations()
    }
  }, [])

  useEffect(() => {
    // Filter reservations based on search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const filtered = reservations.filter(res => 
        res.fullName.toLowerCase().includes(query) ||
        res.email.toLowerCase().includes(query) ||
        (res.arrivalDate && res.arrivalDate.includes(query)) ||
        res.id.includes(query)
      )
      setFilteredReservations(filtered)
    } else {
      setFilteredReservations(reservations)
    }
  }, [searchQuery, reservations])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      
      const data = await response.json()
      
      if (data.authenticated) {
        sessionStorage.setItem('admin-auth', 'authenticated')
        setIsAuthenticated(true)
        loadReservations()
      } else {
        setError('Invalid password')
      }
    } catch (err) {
      setError('Authentication failed')
    }
  }

  const loadReservations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/reservations')
      const data = await response.json()
      
      if (data.ok) {
        setReservations(data.reservations)
        setFilteredReservations(data.reservations)
      }
    } catch (err) {
      console.error('Failed to load reservations:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'ID', 'Name', 'Email', 'Phone', 'From', 'Planning Mode', 'Arrival', 'Departure',
      'Guests', 'Party', 'Accommodation', 'Budget', 'Flight', 'Member Status',
      'Booking Question', 'Interests', 'Other Interest', 'Special Requests', 'Created'
    ]
    
    const rows = filteredReservations.map(r => [
      r.id,
      r.fullName,
      r.email,
      r.phone || '',
      r.countryCity || '',
      r.planningMode || 'certain',
      r.arrivalDate || 'TBD',
      r.departureDate || 'TBD',
      r.numberOfGuests,
      r.partyBreakdown || '',
      r.accommodationPreference || '',
      r.budgetRange || '',
      r.airlineInfo || '',
      r.memberStatus || '',
      r.bookingQuestion || '',
      (r.interests || []).join('; '),
      r.otherInterest || '',
      r.specialRequests || '',
      r.createdAt,
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reservations-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin-auth')
    setIsAuthenticated(false)
    setReservations([])
    setPassword('')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Admin Access</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue"
                placeholder="Enter admin password"
              />
            </div>
            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-cbc-blue text-white rounded-lg hover:bg-cbc-blue-dark"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Reservation Inquiries</h1>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={filteredReservations.length === 0}
              >
                Export CSV
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue"
              placeholder="Search by name, email, date, or ID..."
            />
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No reservations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Planning</th>
                    <th className="text-left p-2">Arrival</th>
                    <th className="text-left p-2">Departure</th>
                    <th className="text-left p-2">Guests</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map((res) => (
                    <tr key={res.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2">{res.fullName}</td>
                      <td className="p-2">{res.email}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          res.planningMode === 'certain' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {res.planningMode === 'certain' ? 'Certain' : 'Exploring'}
                        </span>
                      </td>
                      <td className="p-2">{res.arrivalDate || 'TBD'}</td>
                      <td className="p-2">{res.departureDate || 'TBD'}</td>
                      <td className="p-2">{res.numberOfGuests}</td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            const details = `
Name: ${res.fullName}
Email: ${res.email}
Phone: ${res.phone || 'N/A'}
From: ${res.countryCity || 'N/A'}
Planning: ${res.planningMode === 'certain' ? 'Has specific dates' : 'Still exploring options'}
Arrival: ${res.arrivalDate || 'TBD'}
Departure: ${res.departureDate || 'TBD'}
Guests: ${res.numberOfGuests}
Party: ${res.partyBreakdown || 'N/A'}
Accommodation: ${res.accommodationPreference || 'N/A'}
Budget: ${res.budgetRange || 'N/A'}
Flight: ${res.airlineInfo || 'N/A'}
Member: ${res.memberStatus || 'N/A'}
${res.bookingQuestion ? `Booking Question: ${res.bookingQuestion}` : ''}
${res.interests && res.interests.length > 0 ? `Interests: ${res.interests.join(', ')}` : ''}
${res.otherInterest ? `Other Interest: ${res.otherInterest}` : ''}
Requests: ${res.specialRequests || 'N/A'}
ID: ${res.id}
                            `.trim()
                            alert(details)
                          }}
                          className="text-cbc-blue hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}