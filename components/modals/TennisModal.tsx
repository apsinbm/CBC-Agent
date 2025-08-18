'use client'

import { useState } from 'react'
import Modal from '../Modal'

interface TennisModalProps {
  isOpen: boolean
  onClose: () => void
}

const REQUEST_TYPES = ['Court Reservation', 'Lesson']
const SURFACES = ['Clay', 'Hard Court', 'No Preference']
const PROS = ['Any Available Pro', 'Specific Pro Request']

export default function TennisModal({ isOpen, onClose }: TennisModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    requestType: '',
    players: '2',
    preferredDate: '',
    preferredTime: '',
    preferredSurface: '',
    proPreference: '',
    notes: ''
  })

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      requestType: '',
      players: '2',
      preferredDate: '',
      preferredTime: '',
      preferredSurface: '',
      proPreference: '',
      notes: ''
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
    if (!formData.requestType) {
      setError('Please select a request type')
      return false
    }
    if (!formData.players || parseInt(formData.players) < 1 || parseInt(formData.players) > 8) {
      setError('Number of players must be between 1 and 8')
      return false
    }
    if (!formData.preferredDate) {
      setError('Please select a preferred date')
      return false
    }
    if (!formData.preferredTime) {
      setError('Please select a preferred time')
      return false
    }
    if (formData.notes && formData.notes.length > 3000) {
      setError('Notes must be less than 3000 characters')
      return false
    }
    return true
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
          type: 'tennis',
          payload: {
            ...formData,
            players: parseInt(formData.players),
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
        title="Tennis Booking Request Sent"
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
            We&apos;ll check court and pro availability and get back to you shortly.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Book Tennis"
      description="Reserve a court or schedule a lesson with our pros"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
              required
            >
              <option value="">Select type...</option>
              {REQUEST_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Number of Players <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="8"
              value={formData.players}
              onChange={(e) => setFormData({ ...formData, players: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.preferredDate}
              onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={formData.preferredTime}
              onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred Surface <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <select
              value={formData.preferredSurface}
              onChange={(e) => setFormData({ ...formData, preferredSurface: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            >
              <option value="">No preference...</option>
              {SURFACES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {formData.requestType === 'Lesson' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Pro Preference <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.proPreference}
                onChange={(e) => setFormData({ ...formData, proPreference: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
                placeholder="Any available pro or specific name..."
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Notes <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value.slice(0, 3000) })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            rows={3}
            placeholder="Skill level, specific needs, recurring booking request..."
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.notes.length}/3000 characters
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