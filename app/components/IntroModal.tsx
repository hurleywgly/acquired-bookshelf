'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface IntroModalProps {
  onClose: () => void
}

export default function IntroModal({ onClose }: IntroModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already seen the modal
    const hasSeenModal = localStorage.getItem('acquired-bookshelf-intro-seen')
    if (!hasSeenModal) {
      setIsVisible(true)
    } else {
      onClose()
    }
  }, [onClose])

  const handleClose = () => {
    localStorage.setItem('acquired-bookshelf-intro-seen', 'true')
    setIsVisible(false)
    onClose()
  }

  const handleGotIt = () => {
    handleClose()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm sm:max-w-md w-full p-4 sm:p-6 relative mx-4">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <h2 className="text-lg font-semibold text-black">ACQUIRED Bookshelf</h2>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="font-semibold text-black mb-2">What is this?</h3>
          <p className="text-gray-700 text-sm mb-4 leading-relaxed">
            This is a fan-made site of books researched by Ben & David for episodes of the{' '}
            <span className="font-semibold">Acquired Podcast</span>.
          </p>
          
          <p className="text-gray-700 text-sm mb-4 leading-relaxed">
            <span className="font-semibold">Navigation:</span> Use the sidebar to jump around books by episode.
          </p>

          <p className="text-gray-700 text-sm leading-relaxed">
            Built by <span className="font-semibold">@rywigs</span>.
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleGotIt}
          className="w-full bg-gray-200 text-black py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}