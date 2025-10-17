'use client'

export default function BookQuote() {
  return (
    <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-100 max-w-sm xl:max-w-md">
      <div className="mb-3 lg:mb-4">
        <svg 
          className="w-6 h-6 lg:w-8 lg:h-8 text-gray-300 mb-2" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
        </svg>
      </div>
      
      <blockquote className="text-gray-800 text-base lg:text-lg italic mb-3 lg:mb-4 leading-relaxed">
        &ldquo;Spend each day trying to be a little wiser than you were when you woke up.&rdquo;
      </blockquote>

      <div className="text-right">
        <cite className="text-gray-600 text-xs lg:text-sm font-medium not-italic">
          Charles T. Munger
        </cite>
        <div className="text-gray-500 text-xs mt-1">
          Poor Charlie&apos;s Almanack
        </div>
      </div>
    </div>
  )
}