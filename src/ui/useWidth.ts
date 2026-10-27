import { useLayoutEffect, useRef, useState } from 'react'

/** Width used before the first measurement, px. */
const FALLBACK_WIDTH = 1000

/**
 * Content width of an element in CSS pixels, kept up to date on resize.
 * SVGs are drawn at this width so that text and line sizes stay in real pixels
 * instead of scaling with the screen.
 */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const style = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (w > 0) setWidth(Math.floor(w))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
