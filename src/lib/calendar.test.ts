import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { eventDays, monthDays, toUtcIso } from './calendar'
import type { CalendarEvent } from './calendar'

describe('calendario di Valencia', () => {
  it('converte gli orari invernali ed estivi in UTC', () => {
    expect(toUtcIso('2026-01-10T18:00')).toBe('2026-01-10T17:00:00.000Z')
    expect(toUtcIso('2026-07-10T18:00')).toBe('2026-07-10T16:00:00.000Z')
  })

  it('mostra un evento fino al giorno precedente a un termine a mezzanotte', () => {
    const event = { starts_at: '2026-11-10T17:00:00Z', ends_at: '2026-11-11T23:00:00Z' } as CalendarEvent
    expect(eventDays(event)).toEqual(['2026-11-10', '2026-11-11'])
  })

  it('costruisce settimane complete da lunedì a domenica', () => {
    const days = monthDays(DateTime.fromISO('2026-11-01', { zone: 'Europe/Madrid' }))
    expect(days[0].toISODate()).toBe('2026-10-26')
    expect(days.at(-1)?.toISODate()).toBe('2026-12-06')
    expect(days.length).toBe(42)
  })
})
