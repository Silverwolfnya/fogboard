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

/**
 * 当前时刻 = 锚点时刻 + (现在 − 锚点墙钟) × 倍速。
 *
 * 关键是**用墙钟推算**，而不是"每帧累加"：标签页切到后台时浏览器会冻结
 * requestAnimationFrame，但如果靠累加，这段时间就整个丢了 —— 挂着 VP 去写题，
 * 回来发现榜单没动，正是这么来的。用墙钟的话，后台期间时间照走，
 * 回到前台第一次同步就跳到正确位置。系统时钟被往回拨时不会倒退（夹在锚点上）。
 */
export function elapsedAt(
  anchorT: number,
  anchorWall: number,
  now: number,
  speed: number,
  durationSec: number,
): number {
  const raw = anchorT + ((now - anchorWall) / 1000) * speed
  return clamp(raw, anchorT, durationSec)
}

export function usePlayback(durationSec: number): Playback {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const anchorT = useRef(0)
  const anchorWall = useRef(0)
  const speedRef = useRef(1)
  const playingRef = useRef(false)

  const read = useCallback(
    () =>
      playingRef.current
        ? elapsedAt(anchorT.current, anchorWall.current, Date.now(), speedRef.current, durationSec)
        : anchorT.current,
    [durationSec],
  )

  const anchorTo = useCallback(
    (value: number) => {
      anchorT.current = clamp(value, 0, durationSec)
      anchorWall.current = Date.now()
    },
    [durationSec],
  )

  // 换比赛：回到 0:00
  useEffect(() => {
    playingRef.current = false
    anchorT.current = 0
    anchorWall.current = Date.now()
    setT(0)
    setPlaying(false)
  }, [durationSec])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let stopped = false
    let lastPush = 0
    // 高速播放时降低 UI 刷新频率：榜单不需要 60fps，但需要稳
    const pushInterval = speed >= 10 ? 120 : speed >= 5 ? 90 : 70

    const sync = () => {
      const value = read()
      if (value >= durationSec - 0.05) {
        playingRef.current = false
        setPlaying(false)
        setT(durationSec)
        stopped = true
        return
      }
      setT(value)
    }

    const tick = () => {
      if (stopped) return
      raf = requestAnimationFrame(tick)
      const now = Date.now()
      if (now - lastPush < pushInterval) return
      lastPush = now
      sync()
    }
    raf = requestAnimationFrame(tick)

    // 后台兜底：rAF 被冻结时靠这些事件把时间追平
    const resync = () => {
      if (!playingRef.current) return
      if (document.visibilityState !== 'visible') return
      sync()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync()
    }
    const interval = window.setInterval(() => {
      // 后台标签页的 interval 会被节流到 1s～1min，但足够让状态跟上
      if (document.visibilityState !== 'visible' && playingRef.current) sync()
    }, 1000)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', resync)
    window.addEventListener('pageshow', resync)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', resync)
      window.removeEventListener('pageshow', resync)
    }
  }, [playing, speed, durationSec, read])

  const seek = useCallback(
    (v: number) => {
      const value = clamp(v, 0, durationSec)
      anchorTo(value)
      setT(value)
      if (playingRef.current && value >= durationSec) {
        playingRef.current = false
        setPlaying(false)
      }
    },
    [anchorTo, durationSec],
  )

  const play = useCallback(() => {
    const start = anchorT.current >= durationSec ? 0 : read()
    anchorTo(start)
    setT(start)
    playingRef.current = true
    setPlaying(true)
  }, [anchorTo, durationSec, read])

  const pause = useCallback(() => {
    const value = read()
    anchorTo(value)
    playingRef.current = false
    setT(value)
    setPlaying(false)
  }, [anchorTo, read])

  const toggle = useCallback(() => {
    if (playingRef.current) pause()
    else play()
  }, [pause, play])

  const step = useCallback(
    (delta: number) => {
      seek(read() + delta)
    },
    [read, seek],
  )

  const changeSpeed = useCallback(
    (v: number) => {
      if (playingRef.current) {
        const value = read()
        anchorTo(value)
        setT(value)
      }
      speedRef.current = v
      setSpeed(v)
    },
    [anchorTo, read],
  )

  return { t, playing, speed, play, pause, toggle, seek, step, setSpeed: changeSpeed }
}
