import { Quote } from '@/lib/groupBooks'

interface QuoteBlockProps {
  quote: Quote
}

export default function QuoteBlock({ quote }: QuoteBlockProps) {
  return (
    <div className="w-[270px] h-[320px] flex-shrink-0 flex flex-col justify-center p-[15px] bg-white">
      <div className="mt-2.5">
        <blockquote className="text-gray-800 italic text-xl font-light leading-[1.5]">
          &ldquo;{quote.text}&rdquo;
        </blockquote>

        <div className="flex flex-col gap-4 mt-8">
        {/* Horizontal line separator */}
        <div className="w-16 h-[2px] bg-gray-300"></div>

        {/* Attribution */}
        <div className="flex flex-col gap-2">
          <div className="text-[16px] font-bold text-gray-900">{quote.author}</div>
          {quote.source && (
            <div className="text-sm text-gray-500 font-normal">{quote.source}</div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
