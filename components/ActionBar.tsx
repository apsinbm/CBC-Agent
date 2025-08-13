'use client'

import { useState } from 'react'
import ReservationModal from './ReservationModal'
import DiningModal from './modals/DiningModal'
import CourtsLawnSportsModal from './modals/CourtsLawnSportsModal'
import SpaModal from './modals/SpaModal'
import WeddingModal from './modals/WeddingModal'
import FAQModal from './FAQModal'

export default function ActionBar() {
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [showDiningModal, setShowDiningModal] = useState(false)
  const [showCourtsModal, setShowCourtsModal] = useState(false)
  const [showSpaModal, setShowSpaModal] = useState(false)
  const [showWeddingModal, setShowWeddingModal] = useState(false)
  const [showFAQModal, setShowFAQModal] = useState(false)

  const buttons = [
    {
      label: 'Plan Your Stay',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      onClick: () => setShowReservationModal(true),
      ariaLabel: 'Open Plan Your Stay form'
    },
    {
      label: 'Dining Reservation',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => setShowDiningModal(true),
      ariaLabel: 'Open Dining Reservation form'
    },
    {
      label: 'Book Courts & Lawn Sports',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => setShowCourtsModal(true),
      ariaLabel: 'Open Book Courts & Lawn Sports form'
    },
    {
      label: 'Book Spa',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      onClick: () => setShowSpaModal(true),
      ariaLabel: 'Open Book Spa form'
    },
    {
      label: 'Weddings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      onClick: () => setShowWeddingModal(true),
      ariaLabel: 'Open Weddings at the Club form'
    },
    {
      label: 'FAQ',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => setShowFAQModal(true),
      ariaLabel: 'Open Frequently Asked Questions'
    }
  ]

  return (
    <>
      <div className="border-t border-neutral-200 bg-neutral-50 p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {buttons.map((button, index) => (
            <button
              key={index}
              onClick={button.onClick}
              aria-label={button.ariaLabel}
              className="flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 
                       bg-white text-neutral-700 border border-neutral-200 rounded-lg 
                       shadow-sm hover:shadow-md hover:bg-cbc-blue hover:text-white 
                       hover:border-cbc-blue transition-all duration-200 
                       focus:outline-none focus:ring-2 focus:ring-cbc-blue/20 
                       text-sm sm:text-sm font-medium touch-manipulation"
            >
              {button.icon}
              <span>{button.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ReservationModal 
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
      />
      <DiningModal 
        isOpen={showDiningModal}
        onClose={() => setShowDiningModal(false)}
      />
      <CourtsLawnSportsModal 
        isOpen={showCourtsModal}
        onClose={() => setShowCourtsModal(false)}
      />
      <SpaModal 
        isOpen={showSpaModal}
        onClose={() => setShowSpaModal(false)}
      />
      <WeddingModal 
        isOpen={showWeddingModal}
        onClose={() => setShowWeddingModal(false)}
      />
      <FAQModal 
        isOpen={showFAQModal}
        onClose={() => setShowFAQModal(false)}
      />
    </>
  )
}