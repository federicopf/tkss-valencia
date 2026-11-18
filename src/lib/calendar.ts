import { DateTime } from 'luxon'

export const EVENT_ZONE = 'Europe/Madrid'

export const eventCategories = ['ensayos', 'novenas', 'pasacalles', 'viajes', 'presentaciones', 'cumpleanos'] as const
export type EventCategory = typeof eventCategories[number]

export const eventCategoryLabels: Record<EventCategory, string> = {
  ensayos: 'Ensayos',
  novenas: 'Novenas',
  pasacalles: 'Pasacalles',
  viajes: 'Viajes',
  presentaciones: 'Presentaciones',
  cumpleanos: 'Cumpleaños',
}

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  created_at: string
  created_by: string | null
  images: string[]
  category: EventCategory
  repeat_weekly: boolean
  series_id?: string
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

export function expandWeeklyEvents(series: CalendarEvent[], rangeStart: DateTime, rangeEnd: DateTime): CalendarEvent[] {
  const occurrences: CalendarEvent[] = []
  for (const event of series) {
    const firstStart = madridDate(event.starts_at)
    const firstEnd = madridDate(event.ends_at)
    const dayOffset = Math.round(firstEnd.startOf('day').diff(firstStart.startOf('day'), 'days').days)
    const firstDay = firstStart.startOf('day')
    let day = DateTime.max(firstDay, rangeStart.setZone(EVENT_ZONE).startOf('day'))
    while (day.weekday !== firstStart.weekday) day = day.plus({ days: 1 })
    const lastDay = rangeEnd.setZone(EVENT_ZONE).startOf('day')
    while (day <= lastDay) {
      const start = day.set({ hour: firstStart.hour, minute: firstStart.minute, second: firstStart.second, millisecond: 0 })
      const endDay = day.plus({ days: dayOffset })
      const end = endDay.set({ hour: firstEnd.hour, minute: firstEnd.minute, second: firstEnd.second, millisecond: 0 })
      occurrences.push({ ...event, id: `${event.id}@${day.toFormat('yyyy-MM-dd')}`, series_id: event.id, starts_at: start.toUTC().toISO()!, ends_at: end.toUTC().toISO()! })
      day = day.plus({ weeks: 1 })
    }
  }
  return occurrences
}

export function toUtcIso(localValue: string): string | null {
  const date = DateTime.fromISO(localValue, { zone: EVENT_ZONE })
  return date.isValid ? date.toUTC().toISO() : null
}

export function toLocalInput(value: string): string {
  return madridDate(value).toFormat("yyyy-MM-dd'T'HH:mm")
}
