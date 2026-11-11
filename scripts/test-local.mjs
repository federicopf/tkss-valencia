import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { adminEmail, adminPassword, localStatus } from './local-supabase.mjs'
import WebSocket from 'ws'

try {
  const status = localStatus()
  const browserApi = 'http://127.0.0.1:5173/supabase'
  const anon = createClient(browserApi, status.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } })
  const { error: readError } = await anon.from('events').select('id').limit(1)
  assert.equal(readError, null, 'La lettura pubblica deve essere consentita')

  const now = new Date()
  const title = `Audit test ${now.toISOString()}`
  const draft = { title, starts_at: new Date(now.getTime() + 3_600_000).toISOString(), ends_at: new Date(now.getTime() + 7_200_000).toISOString(), images: ['/events/demo/logo-grupo.png'] }
  const { error: anonWriteError } = await anon.from('events').insert(draft)
  assert.ok(anonWriteError, 'La scrittura anonima deve essere negata')

  const admin = createClient(browserApi, status.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } })
  const { data: login, error: loginError } = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  assert.equal(loginError, null, `Login admin: ${loginError?.message}`)
  assert.ok(login.user)

  const { data: inserted, error: insertError } = await admin.from('events').insert({ ...draft, created_by: login.user.id }).select('id').single()
  assert.equal(insertError, null, `Creazione evento: ${insertError?.message}`)
  const id = inserted.id
  const { data: publicEvent, error: publicEventError } = await anon.from('events').select('images').eq('id', id).single()
  assert.equal(publicEventError, null, 'Il dettaglio pubblico deve poter leggere le immagini')
  assert.deepEqual(publicEvent.images, ['/events/demo/logo-grupo.png'])
  const imageResponse = await fetch('http://127.0.0.1:5173/events/demo/logo-grupo.png', { method: 'HEAD' })
  assert.equal(imageResponse.status, 200, 'Il file immagine deve essere servito dal sito')
  assert.ok(imageResponse.headers.get('content-type')?.startsWith('image/'))
  try {
    const { error: provenanceError } = await admin.from('events').update({ created_at: new Date(0).toISOString() }).eq('id', id)
    assert.ok(provenanceError, 'La data di creazione non deve essere modificabile dal client')
    const { error: pathError } = await admin.from('events').update({ images: ['/outside/logo.png'] }).eq('id', id)
    assert.ok(pathError, 'I percorsi immagine fuori da /events devono essere rifiutati')
    const { error: updateError } = await admin.from('events').update({ title: `${title} aggiornato` }).eq('id', id)
    assert.equal(updateError, null, `Modifica evento: ${updateError?.message}`)
  } finally {
    const { error: deleteError } = await admin.from('events').delete().eq('id', id)
    assert.equal(deleteError, null, `Eliminazione evento: ${deleteError?.message}`)
  }

  const service = createClient(status.API_URL, status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } })
  const { data: audit, error: auditError } = await service.from('admin_audit_log').select('actor_id,operation').eq('event_id', id).order('id')
  assert.equal(auditError, null, `Lettura audit: ${auditError?.message}`)
  assert.deepEqual(audit.map((entry) => entry.operation), ['INSERT', 'UPDATE', 'DELETE'])
  assert.ok(audit.every((entry) => entry.actor_id === login.user.id), 'Ogni modifica deve identificare l’admin')

  const { error: anonAuditError } = await anon.from('admin_audit_log').select('id').limit(1)
  assert.ok(anonAuditError, 'Il log non deve essere accessibile ai visitatori')
  const { error: adminAuditError } = await admin.from('admin_audit_log').select('id').limit(1)
  assert.ok(adminAuditError, 'Il log non deve essere accessibile tramite una sessione client')
  console.log('OK: lettura pubblica, scrittura anonima negata, CRUD admin e audit verificati.')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
