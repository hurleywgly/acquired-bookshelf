import { useEffect, useRef } from 'react'

export function useScrollSpy(setActiveId: (id: string) => void, depsKey?: string) {
  const suppressRef = useRef(false)

  useEffect(() => {
    const root = document.getElementById('shelfScroll')
    if (!root) return

    // Use a timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      // Track visibility of book cards and determine which episode is most visible
      const checkMajorityVisible = () => {
        if (suppressRef.current) return

        // Get all book cards with episode IDs
        const bookCards = document.querySelectorAll<HTMLElement>('[data-book-card][data-episode-id]')
        if (bookCards.length === 0) return

        // Group cards by episode and track visibility
        const episodeVisibility = new Map<string, { visible: number; total: number }>()

        const rootRect = root.getBoundingClientRect()

        bookCards.forEach((card) => {
          const episodeId = card.getAttribute('data-episode-id')
          if (!episodeId) return

          // Initialize episode tracking if needed
          if (!episodeVisibility.has(episodeId)) {
            episodeVisibility.set(episodeId, { visible: 0, total: 0 })
          }

          const stats = episodeVisibility.get(episodeId)!
          stats.total++

          // Calculate visible height of this card
          const rect = card.getBoundingClientRect()
          const cardHeight = rect.height

          const visibleTop = Math.max(rect.top, rootRect.top)
          const visibleBottom = Math.min(rect.bottom, rootRect.bottom)
          const visibleHeight = Math.max(0, visibleBottom - visibleTop)

          // Count as visible if > 50% of card is visible
          if (visibleHeight / cardHeight > 0.5) {
            stats.visible++
          }
        })

        // Find episode with highest visibility ratio
        let bestEpisode = { id: '', visibilityRatio: 0 }

        episodeVisibility.forEach((stats, episodeId) => {
          const visibilityRatio = stats.visible / stats.total

          // Episode is active if majority (>50%) of books are visible
          if (visibilityRatio > 0.5 && visibilityRatio > bestEpisode.visibilityRatio) {
            bestEpisode = { id: episodeId, visibilityRatio }
          }
        })

        if (bestEpisode.id) {
          setActiveId(bestEpisode.id)
        }
      }

      // Check on scroll
      root.addEventListener('scroll', checkMajorityVisible)
      // Initial check
      checkMajorityVisible()

      return () => {
        root.removeEventListener('scroll', checkMajorityVisible)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [setActiveId, depsKey])

  const jumpTo = (episodeId: string) => {
    console.log('🎯 jumpTo called:', episodeId)

    // Ensure DOM has settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Find first book card for this episode
        const el = document.querySelector(`[data-book-card][data-episode-id="${episodeId}"]`) as HTMLElement | null
        const root = document.getElementById('shelfScroll')

        if (!el) {
          console.error('❌ Target element not found:', episodeId)
          return
        }
        if (!root) {
          console.error('❌ Scroll container not found')
          return
        }

        // Check if container is scrollable
        console.log('📊 Container scrollHeight:', root.scrollHeight, 'clientHeight:', root.clientHeight)

        suppressRef.current = true

        // Compute offset with better calculation
        const elRect = el.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        const currentScroll = root.scrollTop

        // Account for header and padding
        const headerOffset = 120
        const target = elRect.top - rootRect.top + currentScroll - headerOffset

        // Clamp to valid scroll range
        const maxScroll = root.scrollHeight - root.clientHeight
        const clampedTarget = Math.max(0, Math.min(target, maxScroll))

        console.log('📐 Scroll calculation:', {
          elTop: elRect.top,
          rootTop: rootRect.top,
          currentScroll,
          calculatedTarget: target,
          clampedTarget,
          maxScroll
        })

        root.scrollTo({ top: clampedTarget, behavior: 'smooth' })

        setTimeout(() => {
          console.log('✅ Scroll complete, new position:', root.scrollTop)
          suppressRef.current = false
        }, 800)
      })
    })
  }

  return { jumpTo }
}
