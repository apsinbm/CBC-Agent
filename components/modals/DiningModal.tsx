'use client'

import { useState } from 'react'
import Modal from '../Modal'

interface DiningModalProps {
  isOpen: boolean
  onClose: () => void
}

const RESTAURANTS = [
  'Longtail Terrace',
  'Beach Terrace', 
  'Club House Bar',
  'Private Dining Room',
  'In-Room Dining'
]

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner']

export default function DiningModal({ isOpen, onClose }: DiningModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    memberRoomNumber: '',
    partySize: '2',
    restaurant: '',
    meal: '',
    date: '',
    time: '',
    specialRequests: ''
  })

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      memberRoomNumber: '',
      partySize: '2',
      restaurant: '',
      meal: '',
      date: '',
      time: '',
      specialRequests: ''
    })
    setError('')
    setSuccess(false)
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm()
      onClose()
    }
  }

  const validateForm = () => {
    if (!formData.fullName || formData.fullName.length < 2) {
      setError('Please enter your full name')
      return false
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    if (!formData.partySize || parseInt(formData.partySize) < 1 || parseInt(formData.partySize) > 20) {
      setError('Party size must be between 1 and 20')
      return false
    }
    if (!formData.restaurant) {
      setError('Please select a restaurant')
      return false
    }
    if (!formData.meal) {
      setError('Please select a meal type')
      return false
    }
    if (!formData.date) {
      setError('Please select a date')
      return false
    }
    if (!formData.time) {
      setError('Please select a time')
      return false
    }
    if (formData.specialRequests && formData.specialRequests.length > 3000) {
      setError('Special requests must be less than 3000 characters')
      return false
    }
    return true
  }

  const isSameDay = () => {
    if (!formData.date) return false
    const selected = new Date(formData.date)
    const today = new Date()
    return selected.toDateString() === today.toDateString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) return
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dining',
          payload: {
            ...formData,
            partySize: parseInt(formData.partySize),
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        }),
      })
      
      const data = await response.json()
      
      if (data.ok) {
        setSuccess(true)
        setTimeout(() => {
          handleClose()
        }, 3000)
      } else {
        setError(data.message || 'Something went wrong. Please try again.')
      }
    } catch (err) {
      setError('Unable to submit. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Reservation Request Sent"
        size="md"
      >
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
          <p className="text-gray-600">
            Thanks — we&apos;ll confirm availability and get back to you shortly.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Make a Dining Reservation"
      description="We'll check availability and confirm your reservation"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isSameDay() && (
          <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
            For same-day reservations, please call the front desk or use the club app. We&apos;ll still forward your request.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone <span className="text-gray-400 text-xs">(optional but recommended)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Member/Room Number <span className="text-gray-400 text-xs">(if applicable)</span>
            </label>
            <input
              type="text"
              value={formData.memberRoomNumber}
              onChange={(e) => setFormData({ ...formData, memberRoomNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              placeholder="Member # or room/cottage name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Party Size <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={formData.partySize}
              onChange={(e) => setFormData({ ...formData, partySize: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Restaurant <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.restaurant}
              onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            >
              <option value="">Select restaurant...</option>
              {RESTAURANTS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Meal <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.meal}
              onChange={(e) => setFormData({ ...formData, meal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            >
              <option value="">Select meal...</option>
              {MEAL_TYPES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Special Requests <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea
            value={formData.specialRequests}
            onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value.slice(0, 3000) })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            rows={3}
            placeholder="Dietary restrictions, special occasions, seating preferences..."
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.specialRequests.length}/3000 characters
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-cbc-blue text-white rounded-lg hover:bg-cbc-blue-dark active:bg-cbc-blue-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}