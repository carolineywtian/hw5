// Decorative art for the board: original drawings in Yale navy / light blues / white.
// Everything here is aria-hidden; nothing carries information.
import { useMemo } from 'react'

/* ----------------------------------------------------------------- bulldog */

type Mood = 'alert' | 'happy' | 'sleepy'

/** Our own friendly bulldog mascot. */
export function Bulldog({ size = 96, mood = 'alert', className = '' }: { size?: number; mood?: Mood; className?: string }) {
  return (
    <svg
      className={`bulldog bulldog-${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      {/* ears */}
      <path d="M22 40 C14 22 22 12 36 20 L44 34 Z" fill="#00356b" />
      <path d="M98 40 C106 22 98 12 84 20 L76 34 Z" fill="#00356b" />
      <path d="M26 36 C22 26 26 21 34 25 L39 33 Z" fill="#286dc0" />
      <path d="M94 36 C98 26 94 21 86 25 L81 33 Z" fill="#286dc0" />
      {/* head */}
      <ellipse cx="60" cy="64" rx="45" ry="39" fill="#00356b" />
      {/* brow wrinkles */}
      <path d="M46 40 Q60 34 74 40" stroke="#63aaff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".7" />
      <path d="M50 46 Q60 42 70 46" stroke="#63aaff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".5" />
      {/* muzzle */}
      <ellipse cx="60" cy="82" rx="29" ry="20" fill="#ffffff" />
      <ellipse cx="47" cy="84" rx="15" ry="12" fill="#e4eefa" />
      <ellipse cx="73" cy="84" rx="15" ry="12" fill="#e4eefa" />
      {/* eyes */}
      {mood === 'sleepy' ? (
        <>
          <path d="M37 60 Q44 66 51 60" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M69 60 Q76 66 83 60" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="44" cy="59" r="8" fill="#ffffff" />
          <circle cx="76" cy="59" r="8" fill="#ffffff" />
          <circle cx="45" cy={mood === 'happy' ? 58 : 60} r="4.4" fill="#0b1f33" />
          <circle cx="75" cy={mood === 'happy' ? 58 : 60} r="4.4" fill="#0b1f33" />
          <circle cx="46.6" cy="57.6" r="1.5" fill="#ffffff" />
          <circle cx="76.6" cy="57.6" r="1.5" fill="#ffffff" />
        </>
      )}
      {/* nose */}
      <ellipse cx="60" cy="74" rx="10" ry="6.5" fill="#0b1f33" />
      <ellipse cx="57" cy="72" rx="3" ry="1.6" fill="#ffffff" opacity=".55" />
      {/* mouth */}
      {mood === 'happy' ? (
        <>
          <path d="M44 86 Q60 104 76 86 Z" fill="#00356b" />
          <path d="M51 93 Q60 101 69 93 Q60 97 51 93 Z" fill="#63aaff" />
          <rect x="50" y="85" width="4.5" height="5" rx="1.2" fill="#ffffff" />
          <rect x="65.5" y="85" width="4.5" height="5" rx="1.2" fill="#ffffff" />
        </>
      ) : (
        <>
          <path d="M60 80 V86 M60 86 Q52 93 45 88 M60 86 Q68 93 75 88" stroke="#0b1f33" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <rect x="51" y="89" width="4" height="4.5" rx="1" fill="#ffffff" stroke="#bddaf5" strokeWidth=".8" />
          <rect x="65" y="89" width="4" height="4.5" rx="1" fill="#ffffff" stroke="#bddaf5" strokeWidth=".8" />
        </>
      )}
      {/* collar + star tag */}
      <path d="M26 96 Q60 114 94 96 L92 103 Q60 120 28 103 Z" fill="#286dc0" />
      <path d="M60 104 l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8Z" fill="#ffffff" />
      {mood === 'sleepy' && (
        <g fill="#63aaff" fontFamily="Georgia, serif" fontWeight="700">
          <text x="94" y="30" fontSize="14">z</text>
          <text x="104" y="18" fontSize="10">z</text>
        </g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------- clocktower */

/** Clocktower logo mark (Gothic tower with a clock face). */
export function ClockTower({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M16 2.5 L18 7 H14 Z" fill="currentColor" />
      <path d="M13 7 H19 V10 H13 Z" />
      <path d="M12 10 H20 V29.5 H12 Z" />
      <circle cx="16" cy="15" r="2.7" />
      <path d="M16 15 L17.2 15.8" strokeWidth="1.2" />
      <path className="clock-hand clock-hand-logo" d="M16 15 V12.9" strokeWidth="1.2" />
      <path d="M14.2 21 V18.8 a1.8 1.8 0 0 1 3.6 0 V21" strokeWidth="1.3" />
      <path d="M14.2 27.5 V25 a1.8 1.8 0 0 1 3.6 0 V27.5" strokeWidth="1.3" />
      <path d="M12 12 L10 12.8 V29.5 H12 M20 12 L22 12.8 V29.5 H20" opacity=".7" />
      <path d="M5 29.5 H27" />
    </svg>
  )
}

/* ---------------------------------------------------------------- skyline */

/** A Gothic campus skyline silhouette: clocktower, spires, halls and elms. */
export function Skyline() {
  const windows: [number, number][] = []
  for (const [x0, y0, cols, rows] of [
    [118, 66, 4, 3],
    [430, 72, 5, 2],
    [760, 70, 4, 3],
    [1210, 74, 5, 2],
  ] as const)
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) windows.push([x0 + c * 16, y0 + r * 14])

  return (
    <svg className="skyline" viewBox="0 0 1440 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {/* far layer */}
      <path
        fill="rgba(189,218,245,0.10)"
        d="M0 130 V96 L40 96 V80 L60 64 L80 80 V96 H170 V70 L190 50 L210 70 V96 H300 V84 L330 60 L360 84 V96 H520 V76 L545 56 L570 76 V96 H690 V88 L720 70 L750 88 V96 H900 V74 L930 50 L960 74 V96 H1080 V84 L1100 66 L1120 84 V96 H1290 V78 L1320 56 L1350 78 V96 H1440 V130 Z"
      />
      {/* elms */}
      <g fill="rgba(99,170,255,0.16)">
        {[30, 260, 380, 610, 660, 870, 1040, 1180, 1390].map((x, i) => (
          <circle key={x} cx={x} cy={104 - (i % 3) * 4} r={18 + (i % 3) * 5} />
        ))}
      </g>
      {/* near layer: halls + clocktower */}
      <g fill="rgba(255,255,255,0.12)">
        <path d="M100 130 V62 L120 46 L140 62 L160 46 L180 62 V130 Z" />
        <path d="M410 130 V66 H500 V130 Z M405 66 L455 44 L505 66 Z" />
        <path d="M740 130 V64 L760 44 L780 64 L800 44 L820 64 V130 Z" />
        <path d="M1190 130 V70 H1280 V130 Z M1185 70 L1235 50 L1285 70 Z" />
        {/* the clocktower */}
        <path d="M1000 130 V58 H1048 V130 Z" />
        <path d="M1004 58 V34 H1044 V58 Z" />
        <path d="M1008 34 V14 H1040 V34 Z" />
        <path d="M1012 14 L1024 0 L1036 14 Z" />
        <path d="M998 58 l4 -10 4 10 Z M1042 58 l4 -10 4 10 Z M1002 34 l4 -9 4 9 Z M1038 34 l4 -9 4 9 Z" />
      </g>
      <circle cx="1024" cy="46" r="7.5" fill="rgba(189,218,245,0.55)" />
      <path d="M1024 46 L1027 48" stroke="#00356b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path className="clock-hand clock-hand-sky" d="M1024 46 V40.5" stroke="#00356b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* lit windows */}
      <g fill="rgba(189,218,245,0.35)">
        {windows.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="6" height="8" rx="3" className={i % 5 === 0 ? 'win-glow' : ''} />
        ))}
        {[1016, 1028].map((x) => (
          <rect key={x} x={x} y={72} width="5" height="12" rx="2.5" />
        ))}
      </g>
    </svg>
  )
}

/* --------------------------------------------------------------- sparkles */

const STAR = 'M12 0 C12.9 7.6 16.4 11.1 24 12 C16.4 12.9 12.9 16.4 12 24 C11.1 16.4 7.6 12.9 0 12 C7.6 11.1 11.1 7.6 12 0 Z'

/** Twinkling four-point sparkles and tiny stars, scattered in a container. */
export function Sparkles({ count = 16, seed = 7 }: { count?: number; seed?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin(seed * 31.7 + i * 12.9898 + k * 78.233) * 43758.5453
          return x - Math.floor(x)
        }
        return {
          left: r(1) * 100,
          top: r(2) * 78,
          size: 6 + r(3) * (i % 4 === 0 ? 16 : 9),
          delay: r(4) * 4,
          dur: 2.2 + r(5) * 2.6,
          kind: i % 3 === 0 ? 'dot' : 'star',
        }
      }),
    [count, seed],
  )

  return (
    <div className="sparkles" aria-hidden="true">
      {items.map((p, i) =>
        p.kind === 'dot' ? (
          <span
            key={i}
            className="spark-dot"
            style={{ left: `${p.left}%`, top: `${p.top}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          />
        ) : (
          <svg
            key={i}
            className="spark"
            viewBox="0 0 24 24"
            width={p.size}
            height={p.size}
            style={{ left: `${p.left}%`, top: `${p.top}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          >
            <path d={STAR} />
          </svg>
        ),
      )}
    </div>
  )
}

/* --------------------------------------------------------------- confetti */

const CONFETTI_COLORS = ['#00356b', '#286dc0', '#63aaff', '#bddaf5', '#ffffff', '#0f4d92']

/** A one-shot burst of blue confetti and stars. Re-mount (change `burst`) to fire again. */
export function Confetti({ burst, big = false }: { burst: number; big?: boolean }) {
  const pieces = useMemo(() => {
    const n = big ? 120 : 55
    return Array.from({ length: n }, (_, i) => {
      const r = (k: number) => {
        const x = Math.sin(burst * 97.13 + i * 12.9898 + k * 78.233) * 43758.5453
        return x - Math.floor(x)
      }
      return {
        left: big ? r(1) * 100 : 30 + r(1) * 40,
        drift: (r(2) - 0.5) * 220,
        delay: r(3) * (big ? 0.6 : 0.25),
        dur: 1.7 + r(4) * 1.6,
        spin: (r(5) - 0.5) * 1080,
        w: 6 + r(6) * 7,
        h: 9 + r(7) * 9,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        shape: i % 7 === 0 ? 'star' : i % 3 === 0 ? 'dot' : 'bit',
      }
    })
  }, [burst, big])

  if (!burst) return null
  return (
    <div className="confetti" aria-hidden="true" key={burst}>
      {pieces.map((p, i) => {
        const style = {
          left: `${p.left}%`,
          '--drift': `${p.drift}px`,
          '--spin': `${p.spin}deg`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
        } as React.CSSProperties
        return p.shape === 'star' ? (
          <svg key={i} className="cf cf-star" viewBox="0 0 24 24" width={p.w + 8} height={p.w + 8} style={style}>
            <path d={STAR} fill={p.color === '#ffffff' ? '#63aaff' : p.color} />
          </svg>
        ) : (
          <span
            key={i}
            className={`cf cf-${p.shape}`}
            style={{ ...style, width: p.w, height: p.shape === 'dot' ? p.w : p.h, background: p.color }}
          />
        )
      })}
    </div>
  )
}
