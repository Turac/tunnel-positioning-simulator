import { useEffect, useRef, useState } from 'react'

/**
 * Plays the time cursor forward at `speed` × real time until `tEnd`. Keyboard: Space toggles,
 * ←/→ step 1 s (a focused text field, select or slider keeps its own keys).
 */
export function usePlayback(time: number, setTime: (t: number) => void, tEnd: number) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)
  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // The first frame's timestamp can precede `last`; never step backwards.
      const next = Math.min(tEnd, timeRef.current + (Math.max(0, now - last) / 1000) * speed)
      last = now
      setTime(next)
      if (next >= tEnd) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, tEnd, setTime])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const control = el instanceof HTMLInputElement && ['range', 'checkbox', 'radio'].includes(el.type)
      // Text fields, selects and buttons keep their own keys; sliders keep their arrows.
      if (['SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) || (el.tagName === 'INPUT' && !control)) return
      if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (control) {
        return
      } else if (e.key === 'ArrowRight') {
        setTime(Math.min(tEnd, timeRef.current + 1))
      } else if (e.key === 'ArrowLeft') {
        setTime(Math.max(0, timeRef.current - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tEnd, setTime])

  const toggle = () => {
    // Playing from the end restarts the run.
    if (!playing && timeRef.current >= tEnd) setTime(0)
    setPlaying((p) => !p)
  }

  return { playing, toggle, speed, setSpeed }
}
