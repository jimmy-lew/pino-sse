import build from 'pino-abstract-transport'
import { v4 as uuid } from 'uuid'
import { App } from 'uWebSockets.js'
import type { HttpResponse } from 'uWebSockets.js'
import {cors} from 'uws-cors'

interface SSETransportOptions {
  port: number
}

export default async function (opts: SSETransportOptions = {port: 3333}) {
  const app = cors(App())
  const connections: Record<string, HttpResponse> = {}

  app.get("/", (conn) => {
    const conn_id = uuid()
    conn.cork(() => {
      conn.writeHeader('Content-Type', 'text/event-stream')
      conn.writeHeader('Connection', 'keep-alive')
      conn.writeHeader('Cache-Control', 'no-cache')
    })
    conn.writeStatus('200 OK')

    connections[conn_id] = conn

    conn.onAborted(() => {
      delete connections[conn_id]
    })

  })
  app.listen(opts.port, () => {})


  return build(async (stream) => {
    for await (const obj of stream) {
      obj["log_id"] = uuid()
      const log = JSON.stringify(obj)
      for (const conn of Object.values(connections)) {
        conn.cork(() => conn.write(`data: ${log}\n\n`))
      }
    }
  }, {
    async close(_) {
      for (const conn of Object.values(connections)) {
        conn.cork(() => conn.write('event: close\n'))
        conn.close()
      }
      app.close()
    },
    parseLine(line) {
      return JSON.parse(line)
    },
  })
}
