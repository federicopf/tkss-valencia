import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { writeFileSync } from 'node:fs'
import WebSocket from 'ws'

export const adminEmail = 'admin@tkss.test'
export const adminPassword = 'TkssLocal2026!'
const localNetwork = 'tkss-valencia-local'
const supabaseBinary = 'node_modules/.bin/supabase'

function command(binary, args, options = {}) {
  return execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options })
}

export function startSupabase() {
  try { command('docker', ['info', '--format', '{{.ServerVersion}}']) }
  catch { throw new Error('Docker non è avviato. Avvialo e riprova.') }

  try { command('docker', ['network', 'inspect', localNetwork]) }
  catch { command('docker', ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', localNetwork]) }

  try {
    command(supabaseBinary, ['start', '--network-id', localNetwork, '--exclude', 'realtime,imgproxy,edge-runtime,vector'], { maxBuffer: 50 * 1024 * 1024 })
    command(supabaseBinary, ['migration', 'up'])
  } catch (error) {
    const details = error.stderr?.toString() || error.message
    throw new Error(`Supabase locale non è partito:\n${details}`)
  }
}

export function localStatus() {
  const output = command(supabaseBinary, ['status', '--output', 'env'])
  const env = Object.fromEntries(output.trim().split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
    const separator = line.indexOf('=')
    const value = line.slice(separator + 1).replace(/^"|"$/g, '')
    return [line.slice(0, separator), value]
  }))
  if (!env.API_URL || !env.PUBLISHABLE_KEY || !env.SECRET_KEY) throw new Error('Chiavi Supabase locali mancanti.')
  return env
}

export async function bootstrapLocal(status) {
  // The Vite proxy keeps the Docker API on WSL loopback while remaining
  // reachable from a browser running on the Windows host.
  writeFileSync('.env.local', `VITE_SUPABASE_URL=/supabase\nVITE_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}\n`)

  const adminClient = createClient(status.API_URL, status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } })
  const { data: users, error: usersError } = await adminClient.auth.admin.listUsers()
  if (usersError) throw usersError
  const existing = users.users.find((user) => user.email === adminEmail)
  if (existing) {
    const { error } = await adminClient.auth.admin.updateUserById(existing.id, { password: adminPassword, email_confirm: true })
    if (error) throw error
  } else {
    const { error } = await adminClient.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true })
    if (error) throw error
  }

  const userClient = createClient(status.API_URL, status.PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } })
  const { data: login, error: loginError } = await userClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (loginError || !login.user) throw loginError ?? new Error('Login admin locale non riuscito.')

  const { count, error: countError } = await userClient.from('events').select('id', { count: 'exact', head: true })
  if (countError) throw countError
  if (count === 0) {
    const zone = 'Europe/Madrid'
    const first = DateTime.now().setZone(zone).plus({ days: 2 }).startOf('day')
    const second = first.plus({ days: 4 })
    const samples = [
      { title: '[Demo] Ensayo abierto', description: 'Evento de ejemplo para probar el calendario local.', location: 'Valencia', starts_at: first.plus({ hours: 18 }).toUTC().toISO(), ends_at: first.plus({ hours: 20 }).toUTC().toISO(), images: ['/events/demo/logo-grupo.png'], created_by: login.user.id },
      { title: '[Demo] Encuentro del grupo', description: 'Evento de ejemplo. Puedes editarlo o eliminarlo desde el área admin.', location: 'Valencia', starts_at: second.plus({ hours: 17 }).toUTC().toISO(), ends_at: second.plus({ hours: 19 }).toUTC().toISO(), created_by: login.user.id },
    ]
    const { error } = await userClient.from('events').insert(samples)
    if (error) throw error
  }
  const { data: demo, error: demoError } = await userClient.from('events').select('id,images').eq('title', '[Demo] Ensayo abierto').limit(1).maybeSingle()
  if (demoError) throw demoError
  if (demo && demo.images.length === 0) {
    const { error } = await userClient.from('events').update({ images: ['/events/demo/logo-grupo.png'] }).eq('id', demo.id)
    if (error) throw error
  }
  await userClient.auth.signOut()
}
