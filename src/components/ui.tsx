import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ')

export type IconName =
  | 'upload'
  | 'book'
  | 'pulse'
  | 'sliders'
  | 'play'
  | 'pause'
  | 'rewind'
  | 'forward'
  | 'back10'
  | 'fwd10'
  | 'x'
  | 'lock'
  | 'search'
  | 'unlock'
  | 'flag'
  | 'refresh'
  | 'panel'
  | 'back'

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
    width: 16,
    height: 16,
  }
  switch (name) {
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
          <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
        </svg>
      )
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M3 12h3.5l2-5.5 3.5 11 2.5-5.5H21" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...common}>
          <path d="M4 7h8M17 7h3M4 17h3M12 17h8" />
          <circle cx="14.5" cy="7" r="2.2" />
          <circle cx="9.5" cy="17" r="2.2" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M8 4.8v14.4a.6.6 0 0 0 .92.5l11-7.2a.6.6 0 0 0 0-1l-11-7.2A.6.6 0 0 0 8 4.8" />
        </svg>
      )
    case 'pause':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <rect x="7" y="5" width="3.6" height="14" rx="0.8" />
          <rect x="13.4" y="5" width="3.6" height="14" rx="0.8" />
        </svg>
      )
    case 'rewind':
      return (
        <svg {...common}>
          <path d="M6 5v14" />
          <path d="M20 5.5 9.5 12 20 18.5z" />
        </svg>
      )
    case 'forward':
      return (
        <svg {...common}>
          <path d="M18 5v14" />
          <path d="M4 5.5 14.5 12 4 18.5z" />
        </svg>
      )
    case 'back10':
      return (
        <svg {...common}>
          <path d="M4 9a8.5 8.5 0 1 1-1 4" />
          <path d="M4 4v5h5" />
        </svg>
      )
    case 'fwd10':
      return (
        <svg {...common}>
          <path d="M20 9a8.5 8.5 0 1 0 1 4" />
          <path d="M20 4v5h-5" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9.5" rx="1.6" />
          <path d="M8.2 11V7.8a3.8 3.8 0 0 1 7.6 0V11" />
        </svg>
      )
    case 'unlock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9.5" rx="1.6" />
          <path d="M8.2 11V7.8a3.8 3.8 0 0 1 7.4-1" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'flag':
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 4h11l-1.8 4L16 12H5z" />
        </svg>
      )
    case 'panel':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
          <path d="M15 4.5v15" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="M14.5 6 8.5 12l6 6" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      )
    default:
      return null
  }
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className={cx('dialog', wide && 'wide')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="x-btn" onClick={onClose} aria-label="关闭">
            <Icon name="x" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Toast({ text }: { text: string }) {
  return createPortal(
    <div className="toast" role="status">
      {text}
    </div>,
    document.body,
  )
}
