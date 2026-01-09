import build from 'pino-abstract-transport'
import { v4 as uuid } from 'uuid'
import { App } from 'uWebSockets.js'
import type { HttpResponse, HttpRequest } from 'uWebSockets.js'
import {cors} from 'uws-cors'

type Origin = string | RegExp | ((req: HttpRequest) => boolean | void);
type HTTPMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE'
type MaybeArray<T> = T | T[];
interface CORSConfig {
    origin?: Origin | boolean | Origin[];
    methods?: boolean | undefined | null | '' | '*' | MaybeArray<HTTPMethod | (string & {})>;
    allowedHeaders?: true | string | string[];
    exposeHeaders?: true | string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflight?: boolean;
}

interface SSETransportOptions {
  port: number
  route?: string
  cors?: CORSConfig
}

export default async function (opts: SSETransportOptions = {
  port: 3333,
  cors: {}
}) {
  const app = cors(App(), opts.cors)
  const connections: Record<string, HttpResponse> = {}

  const route = opts.route ?? '/'

  app.get(route, (conn) => {
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
  .listen(opts.port, () => {})

  return build(async (stream) => {
    for await (const obj of stream) {
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
