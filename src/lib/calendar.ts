import { DateTime } from 'luxon'

export const EVENT_ZONE = 'Europe/Madrid'

export const eventCategories = ['ensayos', 'novenas', 'pasacalles', 'viajes', 'presentaciones', 'cumpleanos'] as const
export type EventCategory = typeof eventCategories[number]
export type RecurrenceFrequency = 'weekly' | 'yearly'

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
  all_day: boolean
  series_id?: string
  occurrence_date?: string
  recurrence_frequency?: RecurrenceFrequency
  series_starts_at?: string
  series_ends_at?: string
  series_until_date?: string | null
  is_series_master?: boolean
}

export type EventSeries = {
  id: string
  title: string
  description: string | null
  location: string | null
  images: string[]
  category: EventCategory
  frequency: RecurrenceFrequency
  starts_on: string
  local_start_time: string | null
  local_end_time: string | null
  all_day: boolean
  until_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EventOccurrence = {
  series_id: string
  occurrence_date: string
  cancelled: boolean
  overrides: Partial<Pick<CalendarEvent, 'title' | 'description' | 'location' | 'images' | 'category' | 'starts_at' | 'ends_at' | 'all_day'>>
}

export type EventDraft = Pick<CalendarEvent, 'title' | 'description' | 'location' | 'images' | 'category' | 'all_day'> & {
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
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) days.push(dayKey(cursor))
  return days
}

function localTime(date: DateTime, time: string | null): DateTime {
  if (!time) return date.startOf('day')
  const [hour, minute, second = '0'] = time.split(':')
  return date.set({ hour: Number(hour), minute: Number(minute), second: Number(second), millisecond: 0 })
}

function occurrenceDates(series: EventSeries, rangeStart: DateTime, rangeEnd: DateTime): DateTime[] {
  const first = DateTime.fromISO(series.starts_on, { zone: EVENT_ZONE }).startOf('day')
  const from = DateTime.max(first, rangeStart.setZone(EVENT_ZONE).startOf('day'))
  const to = rangeEnd.setZone(EVENT_ZONE).startOf('day')
  const until = series.until_date ? DateTime.fromISO(series.until_date, { zone: EVENT_ZONE }).endOf('day') : null
  const dates: DateTime[] = []

  if (series.frequency === 'weekly') {
    let date = from
    while (date.weekday !== first.weekday) date = date.plus({ days: 1 })
    for (; date <= to && (!until || date <= until); date = date.plus({ weeks: 1 })) dates.push(date)
    return dates
  }

  for (let year = from.year; year <= to.year; year += 1) {
    const date = DateTime.fromObject({ year, month: first.month, day: first.day }, { zone: EVENT_ZONE })
    if (date.isValid && date >= first && date >= from && date <= to && (!until || date <= until)) dates.push(date.startOf('day'))
  }
  return dates
}

function seriesTimes(series: EventSeries, date: DateTime): { starts_at: string; ends_at: string } {
  const start = series.all_day ? date.startOf('day') : localTime(date, series.local_start_time)
  let end: DateTime
  if (series.all_day) end = date.plus({ days: 1 }).startOf('day')
  else {
    end = localTime(date, series.local_end_time)
    if (end <= start) end = end.plus({ days: 1 })
  }
  return { starts_at: start.toUTC().toISO()!, ends_at: end.toUTC().toISO()! }
}

export function seriesAsEvent(series: EventSeries): CalendarEvent {
  const date = DateTime.fromISO(series.starts_on, { zone: EVENT_ZONE }).startOf('day')
  return {
    id: series.id,
    title: series.title,
    description: series.description,
    location: series.location,
    ...seriesTimes(series, date),
    created_at: series.created_at,
    created_by: series.created_by,
    images: series.images,
    category: series.category,
    all_day: series.all_day,
    series_id: series.id,
    occurrence_date: series.starts_on,
    recurrence_frequency: series.frequency,
    series_starts_at: seriesTimes(series, date).starts_at,
    series_ends_at: seriesTimes(series, date).ends_at,
    series_until_date: series.until_date,
    is_series_master: true,
  }
}

export function expandEventSeries(
  seriesList: EventSeries[],
  rangeStart: DateTime,
  rangeEnd: DateTime,
  exceptions: EventOccurrence[] = [],
): CalendarEvent[] {
  const exceptionMap = new Map(exceptions.map((exception) => [`${exception.series_id}@${exception.occurrence_date}`, exception]))
  const events: CalendarEvent[] = []
  for (const series of seriesList) {
    const dates = new Set(occurrenceDates(series, rangeStart, rangeEnd).map(dayKey))
    const seriesExceptions = exceptions.filter((exception) => exception.series_id === series.id)
    for (const exception of seriesExceptions) {
      if (exception.cancelled || !exception.overrides.starts_at) continue
      const movedStart = madridDate(exception.overrides.starts_at).startOf('day')
      const movedEnd = exception.overrides.ends_at ? madridDate(exception.overrides.ends_at).minus({ milliseconds: 1 }).startOf('day') : movedStart
      if (movedStart <= rangeEnd && movedEnd >= rangeStart) dates.add(exception.occurrence_date)
    }
    for (const dateKey of [...dates].sort()) {
      const date = DateTime.fromISO(dateKey, { zone: EVENT_ZONE })
      const id = `${series.id}@${dateKey}`
      const exception = exceptionMap.get(id)
      if (exception?.cancelled) continue
      const times = seriesTimes(series, date)
      const base = seriesAsEvent(series)
      const event: CalendarEvent = {
        ...base,
        ...exception?.overrides,
        id,
        series_id: series.id,
        occurrence_date: dateKey,
        recurrence_frequency: series.frequency,
        series_starts_at: base.series_starts_at,
        series_ends_at: base.series_ends_at,
        series_until_date: series.until_date,
        is_series_master: false,
        starts_at: exception?.overrides.starts_at ?? times.starts_at,
        ends_at: exception?.overrides.ends_at ?? times.ends_at,
      }
      const eventStart = madridDate(event.starts_at).startOf('day')
      const eventEnd = madridDate(event.ends_at).minus({ milliseconds: 1 }).startOf('day')
      if (eventStart <= rangeEnd && eventEnd >= rangeStart) events.push(event)
    }
  }
  return events
}

export function toUtcIso(localValue: string): string | null {
  const date = DateTime.fromISO(localValue, { zone: EVENT_ZONE })
  return date.isValid ? date.toUTC().toISO() : null
}

export function toLocalInput(value: string): string {
  return madridDate(value).toFormat("yyyy-MM-dd'T'HH:mm")
}
