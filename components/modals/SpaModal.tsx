'use client'

import { useState } from 'react'
import Modal from '../Modal'

interface SpaModalProps {
  isOpen: boolean
  onClose: () => void
}

const TREATMENT_TYPES = [
  'Unsure—please advise',
  'Swedish Massage',
  'Deep Tissue Massage',
  'Hot Stone Massage',
  'Aromatherapy Massage',
  'Couples Massage',
  'Facial - Classic',
  'Facial - Anti-aging',
  'Body Wrap',
  'Body Scrub',
  'Manicure',
  'Pedicure',
  'Package Deal'
]

const DURATIONS = [
  '30 minutes',
  '60 minutes',
  '90 minutes',
  '120 minutes',
  'Half Day Package',
  'Full Day Package'
]

const TIME_WINDOWS = ['Morning', 'Afternoon', 'Evening']

export default function SpaModal({ isOpen, onClose }: SpaModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    treatmentType: '',
    duration: '',
    preferredDate: '',
    preferredTimeWindow: '',
    accessibilityRequests: ''
  })

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      treatmentType: '',
      duration: '',
      preferredDate: '',
      preferredTimeWindow: '',
      accessibilityRequests: ''
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
    if (!formData.treatmentType) {
      setError('Please select a treatment type')
      return false
    }
    if (!formData.preferredDate) {
      setError('Please select a preferred date')
      return false
    }
    if (!formData.preferredTimeWindow) {
      setError('Please select a preferred time window')
      return false
    }
    if (formData.accessibilityRequests && formData.accessibilityRequests.length > 3000) {
      setError('Special requests must be less than 3000 characters')
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
          type: 'spa',
          payload: {
            ...formData,
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
        title="Spa Booking Request Sent"
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
            We&apos;ll propose next available times and get back to you shortly.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Book Spa Treatment"
      description="Relax and rejuvenate with our spa services"
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
              Phone <span className="text-gray-400 text-xs">(optional)</span>
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
              Treatment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.treatmentType}
              onChange={(e) => setFormData({ ...formData, treatmentType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            >
              <option value="">Select treatment...</option>
              {TREATMENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Duration <span className="text-gray-400 text-xs">(if applicable)</span>
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
            >
              <option value="">Select duration...</option>
              {DURATIONS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred Time Window <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.preferredTimeWindow}
              onChange={(e) => setFormData({ ...formData, preferredTimeWindow: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              required
            >
              <option value="">Select time window...</option>
              {TIME_WINDOWS.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Accessibility or Special Requests <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea
            value={formData.accessibilityRequests}
            onChange={(e) => setFormData({ ...formData, accessibilityRequests: e.target.value.slice(0, 3000) })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            rows={3}
            placeholder="Allergies, mobility needs, pregnancy, medical conditions..."
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.accessibilityRequests.length}/3000 characters
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
            className="px-4 py-2 bg-cbc-blue text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}