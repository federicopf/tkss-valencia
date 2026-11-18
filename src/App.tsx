import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, LogIn, LogOut, MapPin, Menu, Plus, X } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { dayKey, EVENT_ZONE, eventCategoryLabels, eventCategories, eventDays, expandEventSeries, madridDate, monthDays, seriesAsEvent, toLocalInput, toUtcIso } from './lib/calendar'
import type { CalendarEvent, EventOccurrence, EventSeries, RecurrenceFrequency } from './lib/calendar'
import { supabase } from './lib/supabase'
import './App.css'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const today = DateTime.now().setZone(EVENT_ZONE)
const imagePathPattern = /^\/events\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(jpg|jpeg|png|webp|avif)$/

type EventForm = {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  imagesText: string
  category: CalendarEvent['category']
  allDay: boolean
  recurrence: RecurrenceFrequency | 'none'
  recurrenceUntil: string
}

type EditScope = 'occurrence' | 'series'

function initialForm(day?: DateTime, event?: CalendarEvent): EventForm {
  if (event) {
    const startsAt = event.all_day ? madridDate(event.starts_at).toFormat('yyyy-MM-dd') : toLocalInput(event.starts_at)
    const endDate = event.all_day ? madridDate(event.ends_at).minus({ days: 1 }).toFormat('yyyy-MM-dd') : toLocalInput(event.ends_at)
    return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    startsAt,
    endsAt: endDate,
    imagesText: event.images.join('\n'),
    category: event.category,
    allDay: event.all_day,
    recurrence: event.recurrence_frequency ?? 'none',
    recurrenceUntil: event.series_until_date ?? '',
  } }
  const date = (day ?? today).toFormat('yyyy-MM-dd')
  return { title: '', description: '', location: '', startsAt: `${date}T18:00`, endsAt: `${date}T20:00`, imagesText: '', category: 'ensayos', allDay: false, recurrence: 'none', recurrenceUntil: '' }
}

function eventFormRange(form: EventForm): { starts_at: string; ends_at: string } | null {
  if (form.allDay) {
    const startDate = DateTime.fromISO(form.startsAt.slice(0, 10), { zone: EVENT_ZONE })
    const endDate = DateTime.fromISO(form.endsAt.slice(0, 10), { zone: EVENT_ZONE })
    if (!startDate.isValid || !endDate.isValid || endDate < startDate) return null
    return { starts_at: startDate.startOf('day').toUTC().toISO()!, ends_at: endDate.plus({ days: 1 }).startOf('day').toUTC().toISO()! }
  }
  const starts_at = toUtcIso(form.startsAt)
  const ends_at = toUtcIso(form.endsAt)
  return starts_at && ends_at && ends_at > starts_at ? { starts_at, ends_at } : null
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function SiteHeader({ user, onLogin, onSignOut }: { user: User | null; onLogin: () => void; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  return <header className="site-header">
    <Link className="brand" to="/" onClick={closeMenu} aria-label="Tinkus San Simón Valencia — inicio">
      <span className="brand-name">TINKUS <strong>SAN SIMÓN</strong><small>VALENCIA</small></span>
    </Link>
    <nav className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Navegación principal">
      <NavLink to="/" end onClick={closeMenu}>Inicio</NavLink>
      <NavLink to="/calendario" onClick={closeMenu}>Calendario</NavLink>
      <NavLink to="/grupo" onClick={closeMenu}>El grupo</NavLink>
      {user ? <><NavLink to="/admin" onClick={closeMenu}>Dashboard</NavLink><button className="nav-action" type="button" onClick={() => { onSignOut(); closeMenu() }}><LogOut size={16} /> Salir</button></>
        : <button className="nav-action" type="button" onClick={() => { onLogin(); closeMenu() }}><LogIn size={16} /> Admin</button>}
    </nav>
    <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={24} /></button>
  </header>
}

function SiteFooter() {
  return <footer className="site-footer"><span className="footer-brand">TINKUS SAN SIMÓN · VALENCIA</span><span>Hecho para seguir bailando juntos.</span><span>Valencia, España</span></footer>
}

function HomePage({ user, refreshKey, onNew, onEdit }: CalendarProps) {
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">TINKUS SAN SIMÓN · VALENCIA</span>
          <h1 id="hero-title">El ritmo nos<br /><em>encuentra.</em></h1>
          <p>Un espacio para reunirnos, bailar y compartir la fuerza del Tinkus en Valencia.</p>
          <Link className="hero-link" to="/calendario">Ver el calendario <ArrowRight size={19} /></Link>
        </div>
        <div className="hero-art"><img className="hero-logo" src="/tinkus-san-simon-valencia.png" alt="Logo de Tinkus San Simón Valencia" fetchPriority="high" /></div>
      </div>
      <div className="hero-bottom"><span>VALENCIA, ESPAÑA</span><span>BAILAMOS JUNTOS ↗</span></div>
    </section>
    <CalendarSection user={user} refreshKey={refreshKey} onNew={onNew} onEdit={onEdit} home />
    <section className="about-section"><span className="section-kicker">TINKUS SAN SIMÓN VALENCIA</span><div className="about-row"><h2>La fuerza de<br /><em>estar juntos.</em></h2><div><p>El Tinkus es movimiento, tradición y encuentro. Conoce al grupo y descubre dónde compartimos nuestra energía en Valencia.</p><Link className="text-link light" to="/grupo">Conocer al grupo <ArrowRight size={17} /></Link></div></div></section>
  </>
}

type CalendarProps = {
  user: User | null
  refreshKey: number
  onNew: (day: DateTime) => void
  onEdit: (event: CalendarEvent) => void
}

function CalendarSection({ user, refreshKey, onNew, onEdit, home = false }: CalendarProps & { home?: boolean }) {
  const [month, setMonth] = useState<DateTime>(today.startOf('month'))
  const [selectedDay, setSelectedDay] = useState(dayKey(today))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const latestRequest = useRef(0)

  const loadEvents = useCallback(async () => {
    const request = ++latestRequest.current
    if (!supabase) { setEvents([]); setLoading(false); return }
    setLoading(true)
    setLoadError('')
    const rangeStart = month.startOf('week')
    const rangeEnd = month.endOf('month').endOf('week')
    const start = rangeStart.toUTC().toISO()
    const end = rangeEnd.plus({ days: 1 }).startOf('day').toUTC().toISO()
    const columns = 'id,title,description,location,starts_at,ends_at,created_at,created_by,images,category,all_day'
    const startDate = rangeStart.toFormat('yyyy-MM-dd')
    const endDate = rangeEnd.toFormat('yyyy-MM-dd')
    const [singleResult, seriesResult, exceptionResult] = await Promise.all([
      supabase.from('events').select(columns).eq('repeat_weekly', false).lt('starts_at', end).gte('ends_at', start).order('starts_at', { ascending: true }),
      supabase.from('event_series').select('id,title,description,location,images,category,frequency,starts_on,local_start_time,local_end_time,all_day,until_date,created_by,created_at,updated_at').lte('starts_on', endDate).or(`until_date.is.null,until_date.gte.${startDate}`),
      supabase.from('event_occurrences').select('series_id,occurrence_date,cancelled,overrides'),
    ])
    if (request !== latestRequest.current) return
    if (singleResult.error || seriesResult.error || exceptionResult.error) setLoadError('No se pudieron cargar los eventos. Inténtalo de nuevo.')
    else {
      const recurring = expandEventSeries(seriesResult.data as EventSeries[], rangeStart, rangeEnd, exceptionResult.data as EventOccurrence[])
      setEvents([...(singleResult.data ?? []) as CalendarEvent[], ...recurring].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void loadEvents() })
    return () => { active = false }
  }, [loadEvents, refreshKey])

  const days = useMemo(() => monthDays(month), [month])
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) for (const key of eventDays(event)) {
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])
  const selectedEvents = byDay.get(selectedDay) ?? []
  const selectedDate = DateTime.fromISO(selectedDay, { zone: EVENT_ZONE })

  function changeMonth(amount: number) {
    const next = month.plus({ months: amount })
    setMonth(next)
    setSelectedDay(dayKey(next.startOf('month')))
  }

  return <section id={home ? 'calendario' : undefined} className="calendar-section" aria-labelledby="calendar-title">
    <div className="section-heading"><div><span className="section-kicker">NUESTRA AGENDA</span><h2 id="calendar-title">Próximos <em>encuentros</em></h2></div>
      <div className="heading-actions">{home && <Link className="secondary-button" to="/calendario">Página del calendario <ArrowRight size={17} /></Link>}{user && <button className="primary-button" type="button" onClick={() => onNew(selectedDate)}><Plus size={18} /> Nuevo evento</button>}</div>
    </div>
    <div className="category-legend" aria-label="Categorías de eventos">{eventCategories.map((category) => <span key={category}><i className={`category-dot category-${category}`} />{eventCategoryLabels[category]}</span>)}</div>
    <div className="calendar-layout"><div className="calendar-card">
      <div className="calendar-toolbar"><div className="month-title"><CalendarDays size={20} /><h3>{month.setLocale('es').toFormat('LLLL yyyy')}</h3></div><div className="month-actions"><button type="button" onClick={() => { setMonth(today.startOf('month')); setSelectedDay(dayKey(today)) }}>Hoy</button><button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ArrowRight size={18} /></button></div></div>
      <div className="calendar-grid" role="grid" aria-label={`Calendario de ${month.setLocale('es').toFormat('LLLL yyyy')}`}>
        {weekdays.map((day) => <div className="weekday" key={day} role="columnheader">{day}</div>)}
        {days.map((day) => { const key = dayKey(day); const dayEvents = byDay.get(key) ?? []; return <button key={key} className={`day-cell${day.month !== month.month ? ' outside' : ''}${key === selectedDay ? ' selected' : ''}${key === dayKey(today) ? ' today' : ''}`} type="button" role="gridcell" aria-selected={key === selectedDay} aria-label={`${day.setLocale('es').toFormat('d LLLL yyyy')}, ${dayEvents.length} eventos`} onClick={() => { setSelectedDay(key); if (day.month !== month.month) setMonth(day.startOf('month')) }}><span className="day-number">{day.day}</span><span className="day-events">{dayEvents.slice(0, 2).map((item) => <span className={`event-chip category-${item.category}`} key={item.id}>{item.title}</span>)}{dayEvents.length > 2 && <span className="more-events">+{dayEvents.length - 2} más</span>}</span>{dayEvents.length > 0 && <span className={`mobile-dot category-${dayEvents[0].category}`} />}</button> })}
      </div>
    </div><aside className="day-panel" aria-live="polite"><div className="panel-heading"><span>EN ESTA FECHA</span><h3>{selectedDate.setLocale('es').toFormat('d LLLL')}</h3><p>{selectedDate.setLocale('es').toFormat('cccc')}</p></div>
      {loading ? <p className="panel-empty">Cargando eventos…</p> : loadError ? <div className="panel-empty"><p>{loadError}</p><button type="button" onClick={() => void loadEvents()}>Reintentar</button></div> : selectedEvents.length ? <div className="event-list">{selectedEvents.map((event) => <article className="event-item" key={event.id}><span className={`event-accent category-${event.category}`} /><div className="event-content"><span className="event-time">{event.all_day ? <CalendarDays size={14} /> : <Clock3 size={14} />} {event.all_day ? 'Todo el día' : `${madridDate(event.starts_at).toFormat('HH:mm')} – ${madridDate(event.ends_at).toFormat('HH:mm')}`}</span><h4><Link to={`/eventos/${event.id}`}>{event.title}</Link></h4><span className={`category-label category-${event.category}`}>{eventCategoryLabels[event.category]}</span>{event.location && <p className="event-location"><MapPin size={14} /> {event.location}</p>}{event.description && <p className="event-description">{event.description}</p>}<Link className="edit-link" to={`/eventos/${event.id}`}>Ver detalles <ArrowRight size={14} /></Link>{user && <button type="button" className="edit-link edit-control" onClick={() => onEdit(event)}>Editar</button>}</div></article>)}</div> : <div className="panel-empty"><div className="empty-icon"><CalendarDays size={25} /></div><h4>Un día por descubrir</h4><p>Todavía no hay encuentros programados para esta fecha.</p>{user && <button type="button" onClick={() => onNew(selectedDate)}>Añadir un evento →</button>}</div>}
      <div className="panel-footer">¿Tienes una idea para encontrarnos? <span>¡Nos vemos en la pista!</span></div>
    </aside></div>
  </section>
}

function CalendarPage(props: CalendarProps) {
  return <><div className="page-banner"><span className="eyebrow">AGENDA DEL GRUPO</span><h1>Calendario</h1><p>Encuentra ensayos, encuentros y actividades. Selecciona una fecha para ver sus eventos.</p></div><CalendarSection {...props} /></>
}

function AdminDashboard({ user, refreshKey, onNew, onEdit }: CalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void (async () => {
      if (!supabase || !user) { setLoading(false); return }
      const [eventsResult, seriesResult] = await Promise.all([
        supabase.from('events').select('id,title,description,location,starts_at,ends_at,created_at,created_by,images,category,all_day').eq('repeat_weekly', false).order('starts_at', { ascending: true }),
        supabase.from('event_series').select('id,title,description,location,images,category,frequency,starts_on,local_start_time,local_end_time,all_day,until_date,created_by,created_at,updated_at').order('starts_on', { ascending: true }),
      ])
      if (active) {
        const entries = [...(eventsResult.data ?? []) as CalendarEvent[], ...((seriesResult.data ?? []) as EventSeries[]).map(seriesAsEvent)]
        setEvents(entries.sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user, refreshKey])
  if (!user) return <main className="admin-page"><h1>Área de administración</h1><p>Inicia sesión con una cuenta admin para gestionar el calendario.</p></main>
  return <main className="admin-page"><div className="admin-title"><div><span className="section-kicker">GESTIÓN DEL SITIO</span><h1>Dashboard</h1><p>Administra únicamente los eventos del calendario.</p></div><button className="primary-button" onClick={() => onNew(today)}><Plus size={18} /> Crear evento</button></div><section className="admin-panel"><div className="admin-panel-head"><h2>Eventos</h2><span>{events.length} en total</span></div>{loading ? <p>Cargando…</p> : events.length ? <div className="admin-event-list">{events.map((event) => <article key={event.id}><div><strong>{event.title}</strong><span>{madridDate(event.starts_at).setLocale('es').toFormat(event.all_day ? 'd LLL yyyy' : 'd LLL yyyy · HH:mm')} · {event.images.length} imágenes · {event.recurrence_frequency ? `${event.recurrence_frequency === 'weekly' ? 'Cada semana' : 'Cada año'} · ` : ''}{eventCategoryLabels[event.category]}</span></div><div className="admin-event-actions">{!event.is_series_master && <Link to={`/eventos/${event.id}`}>Ver</Link>}<button onClick={() => onEdit(event)}>{event.is_series_master ? 'Editar serie' : 'Editar'}</button></div></article>)}</div> : <p>Aún no hay eventos. Crea el primero para publicarlo en el calendario.</p>}</section></main>
}

function EventDetailPage({ user, refreshKey, onEdit }: Pick<CalendarProps, 'user' | 'refreshKey' | 'onEdit'>) {
  const { id } = useParams()
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      if (!supabase || !id) { if (active) { setEvent(null); setLoading(false) }; return }
      const recurringMatch = id.match(/^([0-9a-f-]{36})@(\d{4}-\d{2}-\d{2})$/i)
      let loadedEvent: CalendarEvent | null = null
      let loadError = false
      if (recurringMatch) {
        const occurrenceDate = recurringMatch[2]
        const [seriesResult, occurrenceResult] = await Promise.all([
          supabase.from('event_series').select('id,title,description,location,images,category,frequency,starts_on,local_start_time,local_end_time,all_day,until_date,created_by,created_at,updated_at').eq('id', recurringMatch[1]).maybeSingle(),
          supabase.from('event_occurrences').select('series_id,occurrence_date,cancelled,overrides').eq('series_id', recurringMatch[1]).eq('occurrence_date', occurrenceDate).maybeSingle(),
        ])
        loadError = Boolean(seriesResult.error || occurrenceResult.error)
        if (seriesResult.data) {
          const occurrenceDay = DateTime.fromISO(occurrenceDate, { zone: EVENT_ZONE })
          const movedStart = occurrenceResult.data?.overrides?.starts_at ? madridDate(occurrenceResult.data.overrides.starts_at) : occurrenceDay
          const movedEnd = occurrenceResult.data?.overrides?.ends_at ? madridDate(occurrenceResult.data.overrides.ends_at) : movedStart
          const rangeStart = DateTime.min(occurrenceDay, movedStart).startOf('day').minus({ days: 1 })
          const rangeEnd = DateTime.max(occurrenceDay, movedEnd).endOf('day').plus({ days: 1 })
          loadedEvent = expandEventSeries([seriesResult.data as EventSeries], rangeStart, rangeEnd, occurrenceResult.data ? [occurrenceResult.data as EventOccurrence] : []).find((item) => item.occurrence_date === occurrenceDate) ?? null
        }
      } else {
        const result = await supabase.from('events').select('id,title,description,location,starts_at,ends_at,created_at,created_by,images,category,all_day').eq('id', id).maybeSingle()
        loadedEvent = result.data as CalendarEvent | null
        loadError = Boolean(result.error)
      }
      if (!active) return
      setEvent(loadedEvent)
      setError(loadError ? 'No se pudo cargar el evento.' : '')
      setLoading(false)
    })()
    return () => { active = false }
  }, [id, refreshKey])

  if (loading) return <main className="detail-page"><p>Cargando evento…</p></main>
  if (error || !event) return <main className="detail-page"><Link className="back-link" to="/calendario"><ArrowLeft size={16} /> Volver al calendario</Link><h1>{error || 'Evento no encontrado'}</h1><p>Consulta la agenda para ver los encuentros disponibles.</p></main>

  const start = madridDate(event.starts_at).setLocale('es')
  const end = madridDate(event.ends_at).setLocale('es')
  return <main className="detail-page">
    <Link className="back-link" to="/calendario"><ArrowLeft size={16} /> Volver al calendario</Link>
    <div className="detail-heading"><div><span className="section-kicker">ENCUENTRO · TINKUS SAN SIMÓN</span><h1>{event.title}</h1><span className={`category-label category-${event.category}`}>{eventCategoryLabels[event.category]}{event.recurrence_frequency ? ` · ${event.recurrence_frequency === 'weekly' ? 'Cada semana' : 'Cada año'}` : ''}</span></div>{user && <button type="button" className="secondary-button" onClick={() => onEdit(event)}>Editar evento</button>}</div>
    <div className="detail-grid"><article className="detail-main">
      {event.images.length > 0 && <div className="event-gallery" aria-label="Imágenes del evento">{event.images.map((path, index) => <img key={path} src={path} alt={`${event.title} — imagen ${index + 1}`} loading={index ? 'lazy' : 'eager'} />)}</div>}
      <h2>Sobre este encuentro</h2><p className="detail-description">{event.description || 'Pronto compartiremos más información sobre este encuentro.'}</p>
    </article><aside className="detail-facts"><h2>Información</h2><div><CalendarDays size={20} /><span><strong>Fecha</strong>{start.toFormat('cccc d LLLL yyyy')}{event.all_day ? '' : !start.hasSame(end, 'day') && ` – ${end.toFormat('cccc d LLLL yyyy')}`}</span></div>{!event.all_day && <div><Clock3 size={20} /><span><strong>Horario</strong>{start.toFormat('HH:mm')} – {end.toFormat('HH:mm')}<small>Hora de Valencia</small></span></div>}{event.location && <div><MapPin size={20} /><span><strong>Lugar</strong>{event.location}</span></div>}</aside></div>
  </main>
}

function GroupPage() {
  return <main><div className="page-banner"><span className="eyebrow">TINKUS SAN SIMÓN · VALENCIA</span><h1>El grupo</h1><p>Danza, tradición y comunidad. Un lugar para encontrarnos y compartir el Tinkus en Valencia.</p></div>
    <section className="group-content"><div><span className="section-kicker">QUIÉNES SOMOS</span><h2>La fuerza de estar juntos.</h2><p>Este espacio reúne las actividades de Tinkus San Simón Valencia. En el calendario encontrarás las fechas, los horarios y el lugar de cada encuentro.</p><Link className="secondary-button" to="/calendario">Ver calendario <ArrowRight size={17} /></Link></div><img src="/tinkus-san-simon-valencia.png" alt="Logo de Tinkus San Simón Valencia" loading="lazy" /></section>
    <section className="group-location" aria-labelledby="group-location-title"><div className="group-location-heading"><div><span className="section-kicker">DÓNDE ENCONTRARNOS</span><h2 id="group-location-title">Nos vemos en <em>Valencia.</em></h2><p>Tinkus San Simón Filial Valencia</p></div><a className="secondary-button" href="https://maps.google.com/?cid=2212955627773022414" target="_blank" rel="noreferrer">Abrir en Google Maps <ArrowRight size={17} /></a></div><div className="map-frame"><iframe title="Mapa de Tinkus San Simón Filial Valencia" src="https://maps.google.com/maps?cid=2212955627773022414&output=embed" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></section>
  </main>
}

function NotFoundPage() { return <main className="detail-page"><h1>Página no encontrada</h1><p>La dirección que buscas no existe.</p><Link className="secondary-button" to="/">Volver al inicio</Link></main> }

function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [modal, setModal] = useState<'login' | 'event' | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editScope, setEditScope] = useState<EditScope>('occurrence')
  const [form, setForm] = useState<EventForm>(initialForm())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [authError, setAuthError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) setAuthError('')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError('No se pudo cerrar la sesión. Inténtalo de nuevo.')
      return
    }
    setUser(null)
    setAuthError('')
    setModal(null)
    navigate('/')
  }

  function openEvent(day?: DateTime, event?: CalendarEvent) {
    setEditingEvent(event ?? null)
    setEditScope(event?.is_series_master ? 'series' : 'occurrence')
    setForm(initialForm(day, event))
    setFormError('')
    setModal('event')
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setFormError('El acceso estará disponible cuando publiquemos la agenda.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSaving(false)
    if (error) setFormError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
    else { setPassword(''); setModal(null); navigate('/admin') }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user) return
    const range = eventFormRange(form)
    if (!range) { setFormError('La fecha de fin debe ser posterior a la de inicio.'); return }
    if (form.recurrenceUntil && form.recurrenceUntil < form.startsAt.slice(0, 10)) { setFormError('La fecha final de la serie debe ser igual o posterior a la fecha de inicio.'); return }
    const images = form.imagesText.split(/\r?\n/).map((path) => path.trim()).filter(Boolean)
    if (images.length > 12 || images.some((path) => !imagePathPattern.test(path))) { setFormError('Usa hasta 12 imágenes con rutas /events/nombre.jpg, .png, .webp o .avif.'); return }
    setSaving(true); setFormError('')
    for (const path of images) {
      try {
        const response = await fetch(path, { method: 'HEAD' })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) { setFormError(`La imagen ${path} no está disponible en el sitio.`); setSaving(false); return }
      } catch { setFormError(`No se pudo comprobar la imagen ${path}.`); setSaving(false); return }
    }
    const payload = { title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim() || null, starts_at: range.starts_at, ends_at: range.ends_at, images, category: form.category, all_day: form.allDay }
    const startLocal = DateTime.fromISO(form.startsAt, { zone: EVENT_ZONE })
    const endLocal = DateTime.fromISO(form.endsAt, { zone: EVENT_ZONE })
    let destinationId = ''
    let saveError = false

    if (editingEvent?.series_id && editScope === 'occurrence') {
      const occurrenceDate = editingEvent.occurrence_date ?? startLocal.toFormat('yyyy-MM-dd')
      const occurrence = await supabase.from('event_occurrences').upsert({
        series_id: editingEvent.series_id,
        occurrence_date: occurrenceDate,
        cancelled: false,
        overrides: payload,
        created_by: user.id,
      }, { onConflict: 'series_id,occurrence_date' }).select('series_id,occurrence_date').single()
      destinationId = `${editingEvent.series_id}@${occurrenceDate}`
      saveError = Boolean(occurrence.error)
    } else if (form.recurrence !== 'none') {
      const seriesPayload = {
        title: payload.title, description: payload.description, location: payload.location, images: payload.images,
        category: payload.category, frequency: form.recurrence, starts_on: startLocal.toFormat('yyyy-MM-dd'),
        local_start_time: form.allDay ? null : startLocal.toFormat('HH:mm:ss'),
        local_end_time: form.allDay ? null : endLocal.toFormat('HH:mm:ss'), all_day: form.allDay,
        until_date: form.recurrenceUntil || null,
      }
      const seriesId = editingEvent?.series_id ?? (editingEvent?.is_series_master ? editingEvent.id : null)
      const result = seriesId
        ? await supabase.from('event_series').update(seriesPayload).eq('id', seriesId).select('id').single()
        : await supabase.from('event_series').insert({ ...seriesPayload, created_by: user.id }).select('id').single()
      destinationId = result.data ? `${result.data.id}@${seriesPayload.starts_on}` : ''
      saveError = Boolean(result.error || !result.data)
      if (!saveError && result.data && editingEvent && !seriesId) {
        const removeOriginal = await supabase.from('events').delete().eq('id', editingEvent.id)
        if (removeOriginal.error) {
          await supabase.from('event_series').delete().eq('id', result.data.id)
          saveError = true
        }
      }
    } else if (editingEvent?.series_id) {
      setSaving(false)
      setFormError('Scegli “solo questa data” per trasformare una ricorrenza in un evento singolo.')
      return
    } else {
      const result = editingEvent
        ? await supabase.from('events').update(payload).eq('id', editingEvent.id).select('id').single()
        : await supabase.from('events').insert({ ...payload, created_by: user.id }).select('id').single()
      destinationId = result.data?.id ?? ''
      saveError = Boolean(result.error || !result.data)
    }
    setSaving(false)
    if (saveError || !destinationId) { setFormError('No se pudo guardar el evento. Inténtalo de nuevo.'); return }
    setModal(null)
    setRefreshKey((value) => value + 1)
    navigate(`/eventos/${destinationId}`)
  }

  async function deleteEvent() {
    if (!supabase || !user || !editingEvent || !window.confirm(editingEvent.series_id && editScope === 'occurrence' ? '¿Eliminar solo esta fecha de la serie?' : editingEvent.series_id ? '¿Eliminar toda esta serie? Esta acción no se puede deshacer.' : '¿Eliminar este evento? Esta acción no se puede deshacer.')) return
    setSaving(true)
    let error: { message: string } | null = null
    if (editingEvent.series_id && editScope === 'occurrence') {
      const occurrenceDate = editingEvent.occurrence_date ?? madridDate(editingEvent.starts_at).toFormat('yyyy-MM-dd')
      const result = await supabase.from('event_occurrences').upsert({ series_id: editingEvent.series_id, occurrence_date: occurrenceDate, cancelled: true, overrides: {}, created_by: user.id }, { onConflict: 'series_id,occurrence_date' })
      error = result.error
    } else if (editingEvent.series_id) {
      const result = await supabase.from('event_series').delete().eq('id', editingEvent.series_id)
      error = result.error
    } else {
      const result = await supabase.from('events').delete().eq('id', editingEvent.id)
      error = result.error
    }
    setSaving(false)
    if (error) setFormError('No se pudo eliminar el evento.')
    else { setModal(null); setRefreshKey((value) => value + 1); navigate('/calendario') }
  }

  const calendarProps: CalendarProps = { user, refreshKey, onNew: (day) => openEvent(day), onEdit: (event) => openEvent(undefined, event) }
  return <div className="site-shell"><ScrollToTop /><SiteHeader user={user} onLogin={() => { setFormError(''); setModal('login') }} onSignOut={() => { void signOut() }} />
    {authError && <p className="auth-error" role="alert">{authError}</p>}
    <Routes><Route path="/" element={<HomePage {...calendarProps} />} /><Route path="/calendario" element={<CalendarPage {...calendarProps} />} /><Route path="/admin" element={<AdminDashboard {...calendarProps} />} /><Route path="/eventos/:id" element={<EventDetailPage user={user} refreshKey={refreshKey} onEdit={calendarProps.onEdit} />} /><Route path="/grupo" element={<GroupPage />} /><Route path="*" element={<NotFoundPage />} /></Routes><SiteFooter />
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="section-kicker">ÁREA ADMIN</span><h2 id="modal-title">{modal === 'login' ? 'Entrar' : editingEvent ? 'Editar evento' : 'Nuevo evento'}</h2></div><button type="button" aria-label="Cerrar" onClick={() => setModal(null)}><X size={22} /></button></div>
      {modal === 'login' ? <form onSubmit={(event) => void signIn(event)} className="form-stack"><label>Correo electrónico<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{formError && <p className="form-error" role="alert">{formError}</p>}<button type="submit" className="primary-button" disabled={saving}>{saving ? 'Entrando…' : 'Entrar'}</button></form>
        : <form onSubmit={(event) => void saveEvent(event)} className="form-stack">
          <label>Título<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Categoría<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CalendarEvent['category'] })}>{eventCategories.map((category) => <option key={category} value={category}>{eventCategoryLabels[category]}</option>)}</select></label>
          <label className="repeat-option"><input type="checkbox" checked={form.allDay} onChange={(event) => setForm((previous) => {
            if (event.target.checked) return { ...previous, allDay: true, startsAt: previous.startsAt.slice(0, 10), endsAt: previous.endsAt.slice(0, 10) }
            const startDate = previous.startsAt.slice(0, 10)
            const endDate = previous.endsAt.slice(0, 10)
            return { ...previous, allDay: false, startsAt: previous.startsAt.includes('T') ? previous.startsAt : `${startDate}T18:00`, endsAt: previous.endsAt.includes('T') ? previous.endsAt : `${endDate}T20:00` }
          })} /><span>Todo el día</span></label>
          <div className="form-pair"><label>Inicio<input type={form.allDay ? 'date' : 'datetime-local'} required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Fin<input type={form.allDay ? 'date' : 'datetime-local'} required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div>
          {!form.allDay && <p className="timezone-note">Horario de Valencia</p>}
          {editingEvent?.series_id && !editingEvent.is_series_master && <fieldset className="edit-scope"><legend>Aplicar cambios</legend><label><input type="radio" name="edit-scope" checked={editScope === 'occurrence'} onChange={() => {
            setEditScope('occurrence')
            setForm((previous) => ({ ...previous, startsAt: previous.allDay ? madridDate(editingEvent.starts_at).toFormat('yyyy-MM-dd') : toLocalInput(editingEvent.starts_at), endsAt: previous.allDay ? madridDate(editingEvent.ends_at).minus({ days: 1 }).toFormat('yyyy-MM-dd') : toLocalInput(editingEvent.ends_at) }))
          }} /> Solo esta fecha</label><label><input type="radio" name="edit-scope" checked={editScope === 'series'} onChange={() => {
            setEditScope('series')
            if (editingEvent.series_starts_at && editingEvent.series_ends_at) setForm((previous) => ({ ...previous, startsAt: previous.allDay ? madridDate(editingEvent.series_starts_at!).toFormat('yyyy-MM-dd') : toLocalInput(editingEvent.series_starts_at!), endsAt: previous.allDay ? madridDate(editingEvent.series_ends_at!).minus({ days: 1 }).toFormat('yyyy-MM-dd') : toLocalInput(editingEvent.series_ends_at!) }))
          }} /> Toda la serie</label></fieldset>}
          {(!editingEvent?.series_id || editScope === 'series') && <>
            <label>Repetición<select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as EventForm['recurrence'] })}>{!editingEvent?.series_id && <option value="none">No repetir</option>}<option value="weekly">Cada semana</option><option value="yearly">Cada año</option></select></label>
            {form.recurrence !== 'none' && <label>Repetir hasta (opcional)<input type="date" value={form.recurrenceUntil} onChange={(event) => setForm({ ...form, recurrenceUntil: event.target.value })} /></label>}
          </>}
          {editingEvent?.series_id && editScope === 'occurrence' && <p className="timezone-note">La repetición original de la serie se conserva.</p>}
          <label>Lugar<input maxLength={200} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label>Descripción<textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label>Imágenes del evento <span className="field-hint">Una ruta por línea, después de publicar el archivo en /public/events</span><textarea rows={3} value={form.imagesText} placeholder="/events/ensayo-01.jpg" onChange={(event) => setForm({ ...form, imagesText: event.target.value })} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions">{editingEvent && <button type="button" className="danger-link" disabled={saving} onClick={() => void deleteEvent()}>{editingEvent.series_id && editScope === 'occurrence' ? 'Eliminar esta fecha' : editingEvent.series_id ? 'Eliminar serie' : 'Eliminar'}</button>}<button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar evento'}</button></div>
        </form>}
    </div></div>}
  </div>
}

export default App
