import { useEffect, useState } from 'react'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface CountUpOptions {
  /** Animation length in ms. Defaults to 900. */
  duration?: number
  /** Delay before starting, in ms (used for staggering). Defaults to 0. */
  delay?: number
}

/**
 * Animates a number from 0 to `target` with an ease-out curve.
 * Users with `prefers-reduced-motion: reduce` get the final value immediately.
 */
export function useCountUp(target: number, options: CountUpOptions = {}): number {
  const { duration = 900, delay = 0 } = options
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Deferred so the effect never sets state synchronously.
      const frame = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(frame)
    }

    let frame = 0
    const timer = window.setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(target * eased)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delay)

    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target, duration, delay])

  return value
}
