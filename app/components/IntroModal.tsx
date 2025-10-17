'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Image from 'next/image'

const SEEN_KEY = "acq:intro:seen"

interface IntroModalProps {
  open: boolean
  onClose: () => void
}

export default function IntroModal({ open, onClose }: IntroModalProps) {
  useEffect(() => {
    // Control body overflow when modal is open
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    // Handle ESC key to close
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const handleClose = () => {
    localStorage.setItem(SEEN_KEY, '1')
    onClose()
  }

  const handleGotIt = () => {
    handleClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-gray-100 rounded-xl max-w-sm sm:max-w-md w-full p-6 sm:p-8 relative mx-4">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/acq-bookshelf-logo_alt-small.svg"
            alt="ACQUIRED Bookshelf"
            width={173}
            height={44}
            style={{ width: '173px', height: 'auto' }}
          />
        </div>

        {/* Content */}
        <div className="mb-8">
          <h3 className="font-bold text-black text-lg mb-4">What is this?</h3>
          <p className="text-gray-700 text-base mb-4 leading-relaxed">
            This is a fan-made site of books researched by Ben & David for episodes of the{' '}
            <span className="font-semibold">Acquired Podcast</span>.
          </p>

          <p className="text-gray-700 text-base mb-4 leading-relaxed">
            <span className="font-semibold">Navigation:</span> Use the sidebar to jump around books by episode.
          </p>

          <p className="text-gray-700 text-base leading-relaxed">
            Built by <a href="https://x.com/rywigs" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">@rywigs</a>.
          </p>
        </div>

        {/* Button */}
        <div className="flex justify-center">
          <button
            onClick={handleGotIt}
            className="w-[110px] bg-gray-300 text-black py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}