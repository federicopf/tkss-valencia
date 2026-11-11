import { DateTime } from 'luxon'

export const EVENT_ZONE = 'Europe/Madrid'

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  created_at: string
  created_by: string
  images: string[]
}

export type EventDraft = Pick<CalendarEvent, 'title' | 'description' | 'location' | 'images'> & {
  starts_at: string
  ends_at: string
}

export function madridDate(value: string): DateTime {
  return DateTime.fromISO(value, { setZone: true }).setZone(EVENT_ZONE)
}

export function dayKey(value: DateTime): string {
  return value.toFormat('yyyy-MM-dd')
}

export function monthDays(month: DateTime): DateTime[] {
  const first = month.startOf('month')
  const offset = first.weekday - 1
  const gridStart = first.minus({ days: offset })
  const cells = Math.ceil((offset + month.daysInMonth!) / 7) * 7
  return Array.from({ length: cells }, (_, index) => gridStart.plus({ days: index }))
}

export function eventDays(event: CalendarEvent): string[] {
  const start = madridDate(event.starts_at).startOf('day')
  const end = madridDate(event.ends_at).minus({ milliseconds: 1 }).startOf('day')
  const days: string[] = []
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    days.push(dayKey(cursor))
  }
  return days
}

export function toUtcIso(localValue: string): string | null {
  const date = DateTime.fromISO(localValue, { zone: EVENT_ZONE })
  return date.isValid ? date.toUTC().toISO() : null
}

export function toLocalInput(value: string): string {
  return madridDate(value).toFormat("yyyy-MM-dd'T'HH:mm")
}
