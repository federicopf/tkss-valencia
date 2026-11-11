import { bootstrapLocal, localStatus } from './local-supabase.mjs'

try {
  await bootstrapLocal(localStatus())
  console.log('Admin ed eventi demo locali pronti.')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
