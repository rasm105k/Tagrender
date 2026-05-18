import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'),
})

const { env } = await import('./config/env.js')
const { buildServer } = await import('./server.js')

const server = await buildServer()

await server.listen({
  port: env.GATEWAY_PORT,
  host: '0.0.0.0',
})
