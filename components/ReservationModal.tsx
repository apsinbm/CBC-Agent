'use client'

import { useState, useEffect } from 'react'

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
}

const ACCOMMODATION_OPTIONS = [
  'Main Club rooms',
  'Cottages', 
  'Suites',
  'No preference'
]

const BUDGET_OPTIONS = [
  'Under $500/night',
  '$500-$750/night',
  '$750-$1000/night',
  'Over $1000/night',
  'Flexible',
  'Need more information'
]

const INTEREST_OPTIONS = [
  'Rooms & Cottages',
  'Dining & Restaurants', 
  'Spa & Wellness',
  'Tennis & Sports',
  'Beach Services',
  'Family Activities',
  'Special Events',
  'Weddings & Celebrations',
  'Other'
]

export default function ReservationModal({ isOpen, onClose }: ReservationModalProps) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [success, setSuccess] = useState(false)
  const [referenceId, setReferenceId] = useState('')
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    countryCity: '',
    planningMode: 'certain', // 'certain' | 'unsure' 
    arrivalDate: '',
    departureDate: '',
    datesUndecided: false,
    numberOfGuests: '1', // Changed to string to handle input properly
    partyBreakdown: '',
    accommodationPreference: '',
    budgetRange: '',
    airlineInfo: '',
    memberStatus: '',
    bookingQuestion: '', // New early question field
    interests: [] as string[], // New interests array
    otherInterest: '', // For "Other" interest details
    specialBookingQuestions: '', // Special requests or booking questions
    specialRequests: '',
    consent: false,
    website: '', // Honeypot
  })

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTimeout(() => {
        setStep(1)
        setError('')
        setSuccess(false)
        setReferenceId('')
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          countryCity: '',
          planningMode: 'certain',
          arrivalDate: '',
          departureDate: '',
          datesUndecided: false,
          numberOfGuests: '1',
          partyBreakdown: '',
          accommodationPreference: '',
          budgetRange: '',
          airlineInfo: '',
          memberStatus: '',
          bookingQuestion: '',
          interests: [],
          otherInterest: '',
          specialBookingQuestions: '',
          specialRequests: '',
          consent: false,
          website: '',
        })
      }, 300)
    }
  }, [isOpen])

  const validateStep = (stepNum: number): boolean => {
    setError('')
    
    switch (stepNum) {
      case 1: // Contact
        if (!formData.fullName || formData.fullName.length < 2) {
          setError('Please enter your full name')
          return false
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setError('Please enter a valid email address')
          return false
        }
        if (formData.phone && !/^[\+\d\s\-\(\)]{6,20}$/.test(formData.phone)) {
          setError('Please enter a valid phone number')
          return false
        }
        break
        
      case 2: // Dates - now optional
        // Dates are optional, but if both are provided, validate departure >= arrival
        if (formData.arrivalDate && formData.departureDate) {
          if (new Date(formData.departureDate) < new Date(formData.arrivalDate)) {
            setDateError('Departure date must be on or after arrival date')
            return false
          }
        }
        // Clear any previous date error if validation passes
        setDateError('')
        break
        
      case 3: // Party
        const guestNum = parseInt(formData.numberOfGuests)
        if (!formData.numberOfGuests || isNaN(guestNum) || guestNum < 1 || guestNum > 12) {
          setError('Number of guests must be between 1 and 12')
          return false
        }
        break
    }
    
    return true
  }

  const nextStep = () => {
    if (validateStep(step)) {
      // Skip step 1.5 if going backwards from step 2
      if (step === 1.5) {
        setStep(2)
      } else if (step === 1) {
        setStep(1.5)
      } else {
        setStep(step + 1)
      }
    }
  }

  const prevStep = () => {
    setError('')
    setDateError('')
    if (step === 2) {
      setStep(1.5)
    } else if (step === 1.5) {
      setStep(1)
    } else {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    if (!formData.consent) {
      setError('Please agree to the consent statement')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      // Prepare data for submission
      const submissionData = {
        ...formData,
        numberOfGuests: parseInt(formData.numberOfGuests),
        interests: formData.interests.includes('Other') && formData.otherInterest 
          ? [...formData.interests.filter(i => i !== 'Other'), `Other: ${formData.otherInterest}`]
          : formData.interests,
      }
      
      const response = await fetch('/api/intake/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      })
      
      const data = await response.json()
      
      if (data.ok) {
        setSuccess(true)
        setReferenceId(data.id)
      } else {
        setError(data.message || 'Something went wrong. Please try again.')
      }
    } catch (err) {
      setError('Unable to submit. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl sm:rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-cbc-blue">Plan Your Stay</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 sm:p-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!success ? (
            <>
              {/* Progress indicator */}
              <div className="flex mb-4 sm:mb-6">
                {[1, 1.5, 2, 3, 4, 5, 6].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1.5 sm:h-2 mx-0.5 sm:mx-1 rounded ${
                      s <= step ? 'bg-cbc-blue' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {/* Step content */}
              <div className="mb-4 sm:mb-6">
                {step === 1 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Contact Information</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Full Name *</label>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="John Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email Address *</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="john@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Country/City Traveling From</label>
                        <input
                          type="text"
                          value={formData.countryCity}
                          onChange={(e) => setFormData({ ...formData, countryCity: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="New York, USA"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Tell us a bit about your plans or any questions</label>
                        <textarea
                          value={formData.bookingQuestion}
                          onChange={(e) => setFormData({ ...formData, bookingQuestion: e.target.value.slice(0, 3000) })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          rows={3}
                          placeholder="E.g., 'We&apos;re thinking mid-October for a long weekend. Do cottages sleep 4?'"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {formData.bookingQuestion.length}/3000 characters
                        </div>
                      </div>
                      {/* Honeypot field - hidden from users */}
                      <input
                        type="text"
                        name="website"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        style={{ display: 'none' }}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                {step === 1.5 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">What would you like to know more about?</h3>
                    <p className="text-sm text-gray-600 mb-4">Select any areas of interest (optional)</p>
                    <div className="space-y-2">
                      {INTEREST_OPTIONS.map((interest) => (
                        <label key={interest} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.interests.includes(interest)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, interests: [...formData.interests, interest] })
                              } else {
                                setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) })
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{interest}</span>
                        </label>
                      ))}
                      {formData.interests.includes('Other') && (
                        <div className="ml-6 mt-2">
                          <input
                            type="text"
                            value={formData.otherInterest}
                            onChange={(e) => setFormData({ ...formData, otherInterest: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                            placeholder="Please specify..."
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">
                        Special Requests or Booking Questions <span className="text-gray-400 text-xs">(optional)</span>
                      </label>
                      <textarea
                        value={formData.specialBookingQuestions || ''}
                        onChange={(e) => setFormData({ ...formData, specialBookingQuestions: e.target.value.slice(0, 500) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none"
                        rows={3}
                        placeholder="Ask about rooms, amenities, services, or any special requirements..."
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {(formData.specialBookingQuestions || '').length}/500 characters
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Travel Dates</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center mb-3">
                          <input
                            type="checkbox"
                            checked={formData.datesUndecided || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, datesUndecided: true, arrivalDate: '', departureDate: '' })
                                setDateError('')
                              } else {
                                setFormData({ ...formData, datesUndecided: false })
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">Don&apos;t know yet, still planning</span>
                        </label>
                      </div>
                      
                      <div className={formData.datesUndecided ? 'opacity-50 pointer-events-none' : ''}>
                        <div>
                          <label className="block text-sm font-medium mb-1">Arrival Date</label>
                          <input
                            type="date"
                            value={formData.arrivalDate}
                            onChange={(e) => {
                              setFormData({ ...formData, arrivalDate: e.target.value })
                              setDateError('') // Clear error on change
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            disabled={formData.datesUndecided}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          />
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-1">Departure Date</label>
                          <input
                            type="date"
                            value={formData.departureDate}
                            onChange={(e) => {
                              setFormData({ ...formData, departureDate: e.target.value })
                              setDateError('') // Clear error on change
                            }}
                            min={formData.arrivalDate || new Date().toISOString().split('T')[0]}
                            disabled={formData.datesUndecided}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          />
                          {dateError && (
                            <p className="text-xs text-red-600 mt-1">{dateError}</p>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600">
                        Dates are optional — choose them if you know them, or leave blank if you&apos;re still planning.
                      </p>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Party Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Number of Guests *</label>
                        <input
                          type="text"
                          value={formData.numberOfGuests}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string for deletion, or digits up to 2 characters
                            if (value === '' || /^\d{1,2}$/.test(value)) {
                              setFormData({ ...formData, numberOfGuests: value });
                            }
                          }}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum 12 guests</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Party Breakdown</label>
                        <input
                          type="text"
                          value={formData.partyBreakdown}
                          onChange={(e) => setFormData({ ...formData, partyBreakdown: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="e.g., 2 adults, 2 children (ages 8 and 10)"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Accommodation Preferences</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Accommodation Type</label>
                        <select
                          value={formData.accommodationPreference}
                          onChange={(e) => setFormData({ ...formData, accommodationPreference: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                        >
                          <option value="">Select preference...</option>
                          {ACCOMMODATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Budget Range</label>
                        <select
                          value={formData.budgetRange}
                          onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                        >
                          <option value="">Select budget...</option>
                          {BUDGET_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Airline & Flight Information</label>
                        <input
                          type="text"
                          value={formData.airlineInfo}
                          onChange={(e) => setFormData({ ...formData, airlineInfo: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="e.g., American Airlines AA123, arriving 2:30pm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Member Status / Who&apos;s Introducing</label>
                        <input
                          type="text"
                          value={formData.memberStatus}
                          onChange={(e) => setFormData({ ...formData, memberStatus: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          placeholder="e.g., Guest of John Smith (Member)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Special Requests or Accessibility Needs</label>
                        <textarea
                          value={formData.specialRequests}
                          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cbc-blue text-base sm:text-base no-zoom webkit-appearance-none bg-white text-black placeholder:text-gray-500 focus:bg-white focus:text-black"
                          rows={3}
                          placeholder="Any special requirements..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 6 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Review & Submit</h3>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-2">Your Inquiry Summary</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Name:</strong> {formData.fullName}</p>
                        <p><strong>Email:</strong> {formData.email}</p>
                        <p><strong>Dates:</strong> {formData.arrivalDate || '(not specified)'} to {formData.departureDate || '(not specified)'}</p>
                        <p><strong>Guests:</strong> {formData.numberOfGuests}</p>
                        {formData.accommodationPreference && (
                          <p><strong>Accommodation:</strong> {formData.accommodationPreference}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="flex items-start">
                        <input
                          type="checkbox"
                          checked={formData.consent}
                          onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                          className="mt-1 mr-2"
                        />
                        <span className="text-sm">
                          I consent to Coral Beach & Tennis Club storing and sharing this information 
                          with the front desk solely to handle my inquiry.
                        </span>
                      </label>
                    </div>
                    
                    <p className="text-xs text-gray-600">
                      We use your details only to handle your inquiry and never for marketing without consent.
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between gap-2 sm:gap-4">
                {step > 1 && (
                  <button
                    onClick={prevStep}
                    className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base touch-manipulation"
                  >
                    Previous
                  </button>
                )}
                
                {step < 6 ? (
                  <button
                    onClick={nextStep}
                    className="ml-auto px-3 py-2 sm:px-4 sm:py-2 bg-cbc-blue text-white rounded-lg hover:bg-cbc-blue-dark active:bg-cbc-blue-dark text-sm sm:text-base touch-manipulation"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.consent}
                    className="ml-auto px-3 py-2 sm:px-4 sm:py-2 bg-cbc-blue text-white rounded-lg hover:bg-cbc-blue-dark active:bg-cbc-blue-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Success screen */
            <div className="text-center py-8">
              <div className="mb-4">
                <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-4">
                We&apos;ve received your inquiry and will be in touch within 24-48 hours.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Reference ID: <span className="font-mono">{referenceId}</span>
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-cbc-blue text-white rounded-lg hover:bg-cbc-blue-dark"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}