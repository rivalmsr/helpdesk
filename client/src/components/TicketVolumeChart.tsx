import { useLayoutEffect, useRef, useState } from 'react'
import { formatMonthDay } from '@/lib/format'

// One day in the series (matches the `dailyVolume` entries from `GET /api/stats`).
export type DailyVolume = {
  day: string // 'YYYY-MM-DD'
  count: number
}

const HEIGHT = 220
// Plot padding: left leaves room for y-axis value labels, bottom for date labels.
const PAD = { top: 8, right: 4, bottom: 22, left: 30 }

// A "nice" integer axis step (1/2/5 × 10ⁿ) targeting ~`target` gridlines across
// `range`, so the y-axis lands on round, integer counts.
function niceStep(range: number, target: number): number {
  const raw = Math.max(range, 1) / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return Math.max(1, Math.round(nice * pow))
}

// Path for a bar with only its top corners rounded, anchored to the baseline
// (`yBase`). Radius shrinks for narrow/short bars so it never overwhelms them.
function roundedTopBar(
  x: number,
  w: number,
  yTop: number,
  yBase: number,
  radius: number,
): string {
  const r = Math.max(0, Math.min(radius, w / 2, yBase - yTop))
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTop + r}`,
    `Q ${x} ${yTop} ${x + r} ${yTop}`,
    `L ${x + w - r} ${yTop}`,
    `Q ${x + w} ${yTop} ${x + w} ${yTop + r}`,
    `L ${x + w} ${yBase}`,
    'Z',
  ].join(' ')
}

// A single-series bar chart of tickets created per day. Built as plain SVG (no
// chart lib): thin bars with rounded tops on a recessive baseline/grid, a
// per-bar hover tooltip, and integer y-ticks. Width tracks its container so
// labels stay crisp; the caller supplies a zero-filled series.
export function TicketVolumeChart({ data }: { data: DailyVolume[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)

  // Measure the container so the SVG renders at real pixel width (crisp text,
  // correct bar widths) rather than scaling a fixed viewBox. Falls back to a
  // sensible default when the environment reports no layout (e.g. tests).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width || 640)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const n = data.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const yBase = PAD.top + plotH

  const maxCount = data.reduce((m, d) => Math.max(m, d.count), 0)
  const step = niceStep(maxCount, 4)
  const niceMax = Math.max(step, Math.ceil(maxCount / step) * step)
  const yTicks: number[] = []
  for (let v = 0; v <= niceMax; v += step) yTicks.push(v)

  const bandW = n > 0 ? plotW / n : 0
  const barW = Math.max(1, bandW - 2) // 2px total surface gap between bars
  const x = (i: number) => PAD.left + i * bandW
  const y = (v: number) => PAD.top + plotH * (1 - v / niceMax)

  // Label every ~6th day (always the first) so the axis never crowds.
  const labelStep = Math.max(1, Math.ceil(n / 6))

  return (
    <div ref={containerRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Bar chart of tickets created per day over the last ${n} days`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Horizontal gridlines + integer y-axis labels (recessive). */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(v)}
                y2={y(v)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {v}
              </text>
            </g>
          ))}

          {/* Bars, plus a full-height hover band and hit target per day. */}
          {data.map((d, i) => {
            const isHovered = hovered === i
            return (
              <g key={d.day}>
                {isHovered && (
                  <rect
                    x={x(i)}
                    y={PAD.top}
                    width={bandW}
                    height={plotH}
                    className="fill-muted"
                    opacity={0.6}
                  />
                )}
                {d.count > 0 && (
                  <path
                    d={roundedTopBar(
                      x(i) + (bandW - barW) / 2,
                      barW,
                      y(d.count),
                      yBase,
                      3,
                    )}
                    className="fill-primary"
                    opacity={hovered === null || isHovered ? 1 : 0.55}
                  />
                )}
                {/* Transparent hit target — wider than the bar, full height, also
                    keyboard-focusable; its <title> is the accessible readout. */}
                <rect
                  x={x(i)}
                  y={PAD.top}
                  width={bandW}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  className="outline-none"
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                >
                  <title>{`${formatMonthDay(d.day)}: ${d.count} ${d.count === 1 ? 'ticket' : 'tickets'}`}</title>
                </rect>
              </g>
            )
          })}

          {/* Baseline (slightly stronger than the gridlines). */}
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={yBase}
            y2={yBase}
            className="stroke-muted-foreground"
            strokeWidth={1}
          />

          {/* X-axis date labels (thinned so they never collide). */}
          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={d.day}
                x={x(i) + bandW / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatMonthDay(d.day)}
              </text>
            ) : null,
          )}
        </svg>
      )}

      {/* Hover tooltip, positioned over the hovered bar (px coords match the SVG). */}
      {hovered !== null && data[hovered] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
          style={{
            // Clamp the (center-anchored) tooltip so it doesn't clip against the
            // card's edges; ~60px keeps half the readout inside on the end bars.
            left: Math.min(
              Math.max(x(hovered) + bandW / 2, PAD.left + 60),
              PAD.left + plotW - 60,
            ),
            top: Math.max(y(data[hovered].count) - 6, 12),
          }}
        >
          <span className="font-medium">{data[hovered].count}</span>{' '}
          {data[hovered].count === 1 ? 'ticket' : 'tickets'}
          <span className="text-muted-foreground">
            {' · '}
            {formatMonthDay(data[hovered].day)}
          </span>
        </div>
      )}
    </div>
  )
}
