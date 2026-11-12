import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, LogIn, LogOut, MapPin, Menu, Plus, X } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { dayKey, EVENT_ZONE, eventDays, madridDate, monthDays, toLocalInput, toUtcIso } from './lib/calendar'
import type { CalendarEvent } from './lib/calendar'
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
}

function initialForm(day?: DateTime, event?: CalendarEvent): EventForm {
  if (event) return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    startsAt: toLocalInput(event.starts_at),
    endsAt: toLocalInput(event.ends_at),
    imagesText: event.images.join('\n'),
  }
  const date = (day ?? today).toFormat('yyyy-MM-dd')
  return { title: '', description: '', location: '', startsAt: `${date}T18:00`, endsAt: `${date}T20:00`, imagesText: '' }
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
    const start = month.startOf('week').toUTC().toISO()
    const end = month.endOf('month').endOf('week').plus({ days: 1 }).startOf('day').toUTC().toISO()
    const { data, error } = await supabase.from('events')
      .select('id,title,description,location,starts_at,ends_at,created_at,created_by,images')
      .lt('starts_at', end).gte('ends_at', start).order('starts_at', { ascending: true })
    if (request !== latestRequest.current) return
    if (error) setLoadError('No se pudieron cargar los eventos. Inténtalo de nuevo.')
    else setEvents((data ?? []) as CalendarEvent[])
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
    <div className="calendar-layout"><div className="calendar-card">
      <div className="calendar-toolbar"><div className="month-title"><CalendarDays size={20} /><h3>{month.setLocale('es').toFormat('LLLL yyyy')}</h3></div><div className="month-actions"><button type="button" onClick={() => { setMonth(today.startOf('month')); setSelectedDay(dayKey(today)) }}>Hoy</button><button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ArrowRight size={18} /></button></div></div>
      <div className="calendar-grid" role="grid" aria-label={`Calendario de ${month.setLocale('es').toFormat('LLLL yyyy')}`}>
        {weekdays.map((day) => <div className="weekday" key={day} role="columnheader">{day}</div>)}
        {days.map((day) => { const key = dayKey(day); const dayEvents = byDay.get(key) ?? []; return <button key={key} className={`day-cell${day.month !== month.month ? ' outside' : ''}${key === selectedDay ? ' selected' : ''}${key === dayKey(today) ? ' today' : ''}`} type="button" role="gridcell" aria-selected={key === selectedDay} aria-label={`${day.setLocale('es').toFormat('d LLLL yyyy')}, ${dayEvents.length} eventos`} onClick={() => { setSelectedDay(key); if (day.month !== month.month) setMonth(day.startOf('month')) }}><span className="day-number">{day.day}</span><span className="day-events">{dayEvents.slice(0, 2).map((item) => <span className="event-chip" key={item.id}>{item.title}</span>)}{dayEvents.length > 2 && <span className="more-events">+{dayEvents.length - 2} más</span>}</span>{dayEvents.length > 0 && <span className="mobile-dot" />}</button> })}
      </div>
    </div><aside className="day-panel" aria-live="polite"><div className="panel-heading"><span>EN ESTA FECHA</span><h3>{selectedDate.setLocale('es').toFormat('d LLLL')}</h3><p>{selectedDate.setLocale('es').toFormat('cccc')}</p></div>
      {loading ? <p className="panel-empty">Cargando eventos…</p> : loadError ? <div className="panel-empty"><p>{loadError}</p><button type="button" onClick={() => void loadEvents()}>Reintentar</button></div> : selectedEvents.length ? <div className="event-list">{selectedEvents.map((event) => <article className="event-item" key={event.id}><span className="event-accent" /><div className="event-content"><span className="event-time"><Clock3 size={14} /> {madridDate(event.starts_at).toFormat('HH:mm')} – {madridDate(event.ends_at).toFormat('HH:mm')}</span><h4><Link to={`/eventos/${event.id}`}>{event.title}</Link></h4>{event.location && <p className="event-location"><MapPin size={14} /> {event.location}</p>}{event.description && <p className="event-description">{event.description}</p>}<Link className="edit-link" to={`/eventos/${event.id}`}>Ver detalles <ArrowRight size={14} /></Link>{user && <button type="button" className="edit-link edit-control" onClick={() => onEdit(event)}>Editar</button>}</div></article>)}</div> : <div className="panel-empty"><div className="empty-icon"><CalendarDays size={25} /></div><h4>Un día por descubrir</h4><p>Todavía no hay encuentros programados para esta fecha.</p>{user && <button type="button" onClick={() => onNew(selectedDate)}>Añadir un evento →</button>}</div>}
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
      const { data } = await supabase.from('events').select('id,title,description,location,starts_at,ends_at,created_at,created_by,images').order('starts_at', { ascending: true })
      if (active) { setEvents((data ?? []) as CalendarEvent[]); setLoading(false) }
    })()
    return () => { active = false }
  }, [user, refreshKey])
  if (!user) return <main className="admin-page"><h1>Área de administración</h1><p>Inicia sesión con una cuenta admin para gestionar el calendario.</p></main>
  return <main className="admin-page"><div className="admin-title"><div><span className="section-kicker">GESTIÓN DEL SITIO</span><h1>Dashboard</h1><p>Administra únicamente los eventos del calendario.</p></div><button className="primary-button" onClick={() => onNew(today)}><Plus size={18} /> Crear evento</button></div><section className="admin-panel"><div className="admin-panel-head"><h2>Eventos</h2><span>{events.length} en total</span></div>{loading ? <p>Cargando…</p> : events.length ? <div className="admin-event-list">{events.map((event) => <article key={event.id}><div><strong>{event.title}</strong><span>{madridDate(event.starts_at).setLocale('es').toFormat('d LLL yyyy · HH:mm')} · {event.images.length} imágenes</span></div><div className="admin-event-actions"><Link to={`/eventos/${event.id}`}>Ver</Link><button onClick={() => onEdit(event)}>Editar</button></div></article>)}</div> : <p>Aún no hay eventos. Crea el primero para publicarlo en el calendario.</p>}</section></main>
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
      const result = await supabase.from('events').select('id,title,description,location,starts_at,ends_at,created_at,created_by,images').eq('id', id).maybeSingle()
      if (!active) return
      setEvent(result.data as CalendarEvent | null)
      setError(result.error ? 'No se pudo cargar el evento.' : '')
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
    <div className="detail-heading"><div><span className="section-kicker">ENCUENTRO · TINKUS SAN SIMÓN</span><h1>{event.title}</h1></div>{user && <button type="button" className="secondary-button" onClick={() => onEdit(event)}>Editar evento</button>}</div>
    <div className="detail-grid"><article className="detail-main">
      {event.images.length > 0 && <div className="event-gallery" aria-label="Imágenes del evento">{event.images.map((path, index) => <img key={path} src={path} alt={`${event.title} — imagen ${index + 1}`} loading={index ? 'lazy' : 'eager'} />)}</div>}
      <h2>Sobre este encuentro</h2><p className="detail-description">{event.description || 'Pronto compartiremos más información sobre este encuentro.'}</p>
    </article><aside className="detail-facts"><h2>Información</h2><div><CalendarDays size={20} /><span><strong>Fecha</strong>{start.toFormat('cccc d LLLL yyyy')}{!start.hasSame(end, 'day') && ` – ${end.toFormat('cccc d LLLL yyyy')}`}</span></div><div><Clock3 size={20} /><span><strong>Horario</strong>{start.toFormat('HH:mm')} – {end.toFormat('HH:mm')}<small>Hora de Valencia</small></span></div>{event.location && <div><MapPin size={20} /><span><strong>Lugar</strong>{event.location}</span></div>}</aside></div>
  </main>
}

function GroupPage() {
  return <main><div className="page-banner"><span className="eyebrow">TINKUS SAN SIMÓN · VALENCIA</span><h1>El grupo</h1><p>Danza, tradición y comunidad. Un lugar para encontrarnos y compartir el Tinkus en Valencia.</p></div>
    <section className="group-content"><div><span className="section-kicker">QUIÉNES SOMOS</span><h2>La fuerza de estar juntos.</h2><p>Este espacio reúne las actividades de Tinkus San Simón Valencia. En el calendario encontrarás las fechas, los horarios y el lugar de cada encuentro.</p><Link className="secondary-button" to="/calendario">Ver calendario <ArrowRight size={17} /></Link></div><img src="/tinkus-san-simon-valencia.png" alt="Logo de Tinkus San Simón Valencia" loading="lazy" /></section>
    <section className="group-location" aria-labelledby="group-location-title"><div className="group-location-heading"><div><span className="section-kicker">DÓNDE ENCONTRARNOS</span><h2 id="group-location-title">Nos vemos en <em>Valencia.</em></h2><p>Tinkus San Simón Filial Valencia</p></div><a className="secondary-button" href="https://www.google.com/maps/search/?api=1&query=TINKUS%20SAN%20SIMON%20FILIAL%20VALENCIA&query_place_id=0xd604f005933caf7%3A0x1eb5ff6b311cd0ce" target="_blank" rel="noreferrer">Abrir en Google Maps <ArrowRight size={17} /></a></div><div className="map-frame"><iframe title="Mapa de Tinkus San Simón Filial Valencia" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.818320343149!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd604f005933caf7%3A0x1eb5ff6b311cd0ce!2sTINKUS%20SAN%20SIMON%20FILIAL%20VALENCIA!5e0!3m2!1sit!2ses!4v1794519588242!5m2!1sit!2ses" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></section>
  </main>
}

function NotFoundPage() { return <main className="detail-page"><h1>Página no encontrada</h1><p>La dirección que buscas no existe.</p><Link className="secondary-button" to="/">Volver al inicio</Link></main> }

function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [modal, setModal] = useState<'login' | 'event' | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
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
    const startsAt = toUtcIso(form.startsAt)
    const endsAt = toUtcIso(form.endsAt)
    if (!startsAt || !endsAt || endsAt <= startsAt) { setFormError('La fecha de fin debe ser posterior a la de inicio.'); return }
    const images = form.imagesText.split(/\r?\n/).map((path) => path.trim()).filter(Boolean)
    if (images.length > 12 || images.some((path) => !imagePathPattern.test(path))) { setFormError('Usa hasta 12 imágenes con rutas /events/nombre.jpg, .png, .webp o .avif.'); return }
    setSaving(true); setFormError('')
    for (const path of images) {
      try {
        const response = await fetch(path, { method: 'HEAD' })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) { setFormError(`La imagen ${path} no está disponible en el sitio.`); setSaving(false); return }
      } catch { setFormError(`No se pudo comprobar la imagen ${path}.`); setSaving(false); return }
    }
    const payload = { title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim() || null, starts_at: startsAt, ends_at: endsAt, images }
    const result = editingEvent
      ? await supabase.from('events').update(payload).eq('id', editingEvent.id).select('id').single()
      : await supabase.from('events').insert({ ...payload, created_by: user.id }).select('id').single()
    setSaving(false)
    if (result.error || !result.data) { setFormError('No se pudo guardar el evento. Inténtalo de nuevo.'); return }
    setModal(null)
    setRefreshKey((value) => value + 1)
    navigate(`/eventos/${result.data.id}`)
  }

  async function deleteEvent() {
    if (!supabase || !editingEvent || !window.confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return
    setSaving(true)
    const { error } = await supabase.from('events').delete().eq('id', editingEvent.id)
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
        : <form onSubmit={(event) => void saveEvent(event)} className="form-stack"><label>Título<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="form-pair"><label>Inicio<input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Fin<input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div><p className="timezone-note">Horario de Valencia</p><label>Lugar<input maxLength={200} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>Descripción<textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Imágenes del evento <span className="field-hint">Una ruta por línea, después de publicar el archivo en /public/events</span><textarea rows={3} value={form.imagesText} placeholder="/events/ensayo-01.jpg" onChange={(event) => setForm({ ...form, imagesText: event.target.value })} /></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="form-actions">{editingEvent && <button type="button" className="danger-link" disabled={saving} onClick={() => void deleteEvent()}>Eliminar</button>}<button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar evento'}</button></div></form>}
    </div></div>}
  </div>
}

export default App
