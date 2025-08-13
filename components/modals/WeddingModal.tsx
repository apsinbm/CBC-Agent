'use client'

import { useState } from 'react'
import Modal from '../Modal'

interface WeddingModalProps {
  isOpen: boolean
  onClose: () => void
}

const VENUE_PREFERENCES = [
  'Beach Ceremony',
  'Wedding Lawn Ceremony',
  'Terrace Reception',
  'Ballroom Reception',
  'Other/Combination'
]

const CATERING_STYLES = [
  'Plated Dinner',
  'Buffet',
  'Cocktail Reception',
  'Mix of Styles',
  'Unsure'
]

const BUDGET_BANDS = [
  'Under $25,000',
  '$25,000 - $50,000',
  '$50,000 - $75,000',
  '$75,000 - $100,000',
  'Over $100,000',
  'Prefer not to say'
]

export default function WeddingModal({ isOpen, onClose }: WeddingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    coupleNames: '',
    email: '',
    phone: '',
    guestCount: '',
    preferredSeason: '',
    venuePreferences: [] as string[],
    cateringStyle: '',
    budgetBand: '',
    hasPlanner: '',
    plannerName: '',
    vision: ''
  })

  const resetForm = () => {
    setFormData({
      coupleNames: '',
      email: '',
      phone: '',
      guestCount: '',
      preferredSeason: '',
      venuePreferences: [],
      cateringStyle: '',
      budgetBand: '',
      hasPlanner: '',
      plannerName: '',
      vision: ''
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
    if (!formData.coupleNames || formData.coupleNames.length < 2) {
      setError('Please enter the couple\'s names')
      return false
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    // Phone is now optional
    if (!formData.guestCount) {
      setError('Please provide an estimated guest count')
      return false
    }
    if (formData.vision && formData.vision.length > 3000) {
      setError('Vision notes must be less than 3000 characters')
      return false
    }
    return true
  }

  const handleVenueChange = (venue: string) => {
    setFormData(prev => ({
      ...prev,
      venuePreferences: prev.venuePreferences.includes(venue)
        ? prev.venuePreferences.filter(v => v !== venue)
        : [...prev.venuePreferences, venue]
    }))
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
          type: 'wedding',
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
        title="Wedding Enquiry Sent"
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
            Our events team will reach out with availability and package details.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Weddings at the Club"
      description="Start planning your perfect day at our beautiful venue"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Names of Couple <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.coupleNames}
              onChange={(e) => setFormData({ ...formData, coupleNames: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              placeholder="Jane Smith & John Doe"
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
              Anticipated Guest Count <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.guestCount}
              onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              placeholder="10-500 guests"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred Season or Date <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.preferredSeason}
              onChange={(e) => setFormData({ ...formData, preferredSeason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
              placeholder="Spring 2027 or specific date"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-2">
              Ceremony & Reception Preferences <span className="text-gray-400 text-xs">(select all that interest you)</span>
            </label>
            <div className="space-y-2">
              {VENUE_PREFERENCES.map(venue => (
                <label key={venue} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.venuePreferences.includes(venue)}
                    onChange={() => handleVenueChange(venue)}
                    className="mr-2"
                  />
                  <span className="text-sm">{venue}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Catering Style <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <select
              value={formData.cateringStyle}
              onChange={(e) => setFormData({ ...formData, cateringStyle: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
            >
              <option value="">Select style...</option>
              {CATERING_STYLES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Budget Band <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <select
              value={formData.budgetBand}
              onChange={(e) => setFormData({ ...formData, budgetBand: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
            >
              <option value="">Select budget...</option>
              {BUDGET_BANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Working with a Planner? <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <select
              value={formData.hasPlanner}
              onChange={(e) => setFormData({ ...formData, hasPlanner: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="considering">Considering</option>
            </select>
          </div>

          {formData.hasPlanner === 'yes' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Planner Name
              </label>
              <input
                type="text"
                value={formData.plannerName}
                onChange={(e) => setFormData({ ...formData, plannerName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                placeholder="Planner or company name"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Notes / Vision <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea
            value={formData.vision}
            onChange={(e) => setFormData({ ...formData, vision: e.target.value.slice(0, 3000) })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base no-zoom webkit-appearance-none"
            rows={3}
            placeholder="Tell us about your vision, themes, special requirements..."
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.vision.length}/3000 characters
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
            {isSubmitting ? 'Submitting...' : 'Submit Enquiry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}