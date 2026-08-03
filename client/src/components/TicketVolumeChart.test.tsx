import { render, fireEvent } from '@testing-library/react'
import { formatMonthDay } from '@/lib/format'
import { TicketVolumeChart, type DailyVolume } from './TicketVolumeChart'

const data: DailyVolume[] = [
  { day: '2026-08-01', count: 3 },
  { day: '2026-08-02', count: 0 },
  { day: '2026-08-03', count: 5 },
]

// SVG <title>/role aren't reliably exposed through RTL's a11y queries under
// happy-dom, so assert on the DOM directly. Dates go through `formatMonthDay` so
// the expectations track the test environment's locale.
const titles = (container: HTMLElement) =>
  [...container.querySelectorAll('title')].map((t) => t.textContent)

describe('TicketVolumeChart', () => {
  it('draws one bar per day that has tickets (zero days have none)', () => {
    const { container } = render(<TicketVolumeChart data={data} />)

    // Bars are rendered as <path>; only the two non-zero days get one.
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('exposes an accessible per-day readout on every day', () => {
    const { container } = render(<TicketVolumeChart data={data} />)

    // Every day (including the zero) has a hit target with a titled readout.
    expect(titles(container)).toEqual([
      `${formatMonthDay('2026-08-01')}: 3 tickets`,
      `${formatMonthDay('2026-08-02')}: 0 tickets`,
      `${formatMonthDay('2026-08-03')}: 5 tickets`,
    ])
  })

  it('shows a tooltip when a day is hovered', () => {
    const { container } = render(<TicketVolumeChart data={data} />)

    // No tooltip until a bar is hovered.
    expect(container.querySelector('[class*="bg-popover"]')).toBeNull()

    // Hover the third day's hit target (the transparent, focusable rects).
    const hitTargets = container.querySelectorAll('rect[tabindex="0"]')
    fireEvent.mouseEnter(hitTargets[2])

    const tooltip = container.querySelector('[class*="bg-popover"]')
    expect(tooltip?.textContent).toBe(`5 tickets · ${formatMonthDay('2026-08-03')}`)
  })

  it('renders singular "ticket" for a single-ticket day', () => {
    const { container } = render(
      <TicketVolumeChart data={[{ day: '2026-08-04', count: 1 }]} />,
    )

    expect(titles(container)).toEqual([`${formatMonthDay('2026-08-04')}: 1 ticket`])
  })
})
