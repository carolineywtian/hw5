// Small inline icons (stroke = currentColor) so status never relies on color alone.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Shirt = (p: P) => (
  <Base {...p}>
    <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0Z" />
  </Base>
)
export const Key = (p: P) => (
  <Base {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M14 9l2 2" />
  </Base>
)
export const Tag = (p: P) => (
  <Base {...p}>
    <path d="M3 12V4h8l9.5 9.5a2 2 0 0 1 0 2.8l-5.2 5.2a2 2 0 0 1-2.8 0Z" />
    <circle cx="7.5" cy="8.5" r="1.4" />
  </Base>
)
export const Play = (p: P) => (
  <Base {...p}>
    <path d="M7 4.5v15l12-7.5Z" fill="currentColor" stroke="none" />
  </Base>
)
export const Check = (p: P) => (
  <Base {...p}>
    <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
  </Base>
)
export const Clock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)
export const Alert = (p: P) => (
  <Base {...p}>
    <path d="M12 3 2.5 20h19Z" />
    <path d="M12 10v4.5M12 17.3v.2" />
  </Base>
)
export const Wrench = (p: P) => (
  <Base {...p}>
    <path d="M14.5 6.5a4 4 0 0 0 5.2 5.2L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5.2-5.2L3 9l3-3 3 3 1.6-1.6" />
  </Base>
)
export const Arrow = (p: P) => (
  <Base {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Base>
)
export const Reset = (p: P) => (
  <Base {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3 3.5V9h5.5" />
  </Base>
)
export const Pen = (p: P) => (
  <Base {...p}>
    <path d="m4 20 4.2-1L19 8.2a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" />
  </Base>
)
export const Spark = (p: P) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Base>
)
export const Book = (p: P) => (
  <Base {...p}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z" />
    <path d="M12 6.5v13" />
  </Base>
)
export const Seal = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="10" r="6.5" />
    <path d="m9.2 10 2 2 3.6-3.8M8.5 15.5 7 21l5-2.2 5 2.2-1.5-5.5" />
  </Base>
)
