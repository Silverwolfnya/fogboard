import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from '../lib/format'

export interface Playback {
  t: number
  playing: boolean
  speed: number
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (v: number) => void
  step: (delta: number) => void
  setSpeed: (v: number) => void
}

/** 播放时钟：rAF 内部走时，节流推送给 React（约 14fps） */
export function usePlayback(durationSec: number): Playback {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const tRef = useRef(0)
  const pushAt = useRef(0)

  useEffect(() => {
    tRef.current = 0
    setT(0)
    setPlaying(false)
  }, [durationSec])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    // 高速播放时降低 UI 刷新频率：榜单不需要 60fps，但需要稳
    const pushInterval = speed >= 10 ? 120 : speed >= 5 ? 90 : 70
    const tick = (now: number) => {
      const dt = Math.min(0.4, (now - last) / 1000)
      last = now
      const next = Math.min(durationSec, tRef.current + dt * speed)
      tRef.current = next
      if (next >= durationSec) {
        setT(durationSec)
        setPlaying(false)
        return
      }
      if (now - pushAt.current >= pushInterval) {
        pushAt.current = now
        setT(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, durationSec])

  const seek = useCallback(
    (v: number) => {
      const next = clamp(v, 0, durationSec)
      tRef.current = next
      setT(next)
    },
    [durationSec],
  )

  const play = useCallback(() => {
    if (tRef.current >= durationSec) {
      tRef.current = 0
      setT(0)
    }
    setPlaying(true)
  }, [durationSec])

  const pause = useCallback(() => setPlaying(false), [])

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false
      if (tRef.current >= durationSec) {
        tRef.current = 0
        setT(0)
      }
      return true
    })
  }, [durationSec])

  const step = useCallback(
    (delta: number) => {
      const next = clamp(tRef.current + delta, 0, durationSec)
      tRef.current = next
      setT(next)
    },
    [durationSec],
  )

  return { t, playing, speed, play, pause, toggle, seek, step, setSpeed }
}
