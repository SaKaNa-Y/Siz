import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.SIZ_UPGRADE_POLICY_PROTOTYPE_PORT ?? 4179)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1)
  const path = join(root, filename)

  response.setHeader('Content-Type', contentTypes[extname(path)] ?? 'text/plain; charset=utf-8')
  createReadStream(path)
    .on('error', () => {
      response.statusCode = 404
      response.end('Not found')
    })
    .pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(
    `Policy-aware upgrade prototype: http://127.0.0.1:${port}/?variant=A&view=upgrade&scenario=mixed`,
  )
})
