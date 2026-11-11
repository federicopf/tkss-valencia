import { spawn } from 'node:child_process'
import { adminEmail, adminPassword, bootstrapLocal, localStatus, startSupabase } from './local-supabase.mjs'

try {
  console.log('Avvio Supabase locale…')
  startSupabase()
  const status = localStatus()
  await bootstrapLocal(status)
  console.log('\nSito: http://localhost:5173')
  console.log('Supabase Studio: http://127.0.0.1:54323')
  console.log(`Admin locale: ${adminEmail} / ${adminPassword}`)
  console.log('Gli eventi [Demo] esistono solo nel database locale.\n')

  const vite = spawn('node_modules/.bin/vite', ['--host', '127.0.0.1'], { stdio: 'inherit' })
  vite.on('exit', (code) => { process.exitCode = code ?? 0 })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
