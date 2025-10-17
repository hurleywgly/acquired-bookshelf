"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Calculates grid row span for a masonry item given its pixel height
function calcSpan(height: number, rowUnit: number, rowGap: number) {
  // Standard formula: rows = ceil((height + gap) / (rowUnit + gap))
  // Add a tiny safety epsilon to avoid rounding issues on subpixel rendering
  const epsilon = 0.5
  return Math.ceil((height + rowGap + epsilon) / (rowUnit + rowGap))
}

export function useMasonryItem(rowUnit: number, rowGap: number) {
  const ref = useRef<HTMLElement | null>(null)
  const [style, setStyle] = useState<React.CSSProperties | undefined>()

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const height = rect.height
    const span = calcSpan(height, rowUnit, rowGap)
    setStyle({ gridRowEnd: `span ${span}` })
  }, [rowUnit, rowGap])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Observe size changes
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        // Use rAF to batch DOM writes
        requestAnimationFrame(measure)
      })
      ro.observe(el)
    }

    // Measure after mount to capture initial layout
    const t = requestAnimationFrame(measure)

    // Recalculate after fonts load (can change heights)
    const docWithFonts = document as Document & { fonts?: { ready: Promise<void> } }
    if (docWithFonts.fonts?.ready) {
      docWithFonts.fonts.ready.then(() => requestAnimationFrame(measure))
    }

    const onResize = () => requestAnimationFrame(measure)
    window.addEventListener('resize', onResize)

    return () => {
      if (ro) ro.disconnect()
      cancelAnimationFrame(t)
      window.removeEventListener('resize', onResize)
    }
  }, [measure])

  return { ref, style, remeasure: measure }
}

