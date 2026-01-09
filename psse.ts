import build from 'pino-abstract-transport'
import { Context, Hono } from 'hono'
import { SSEStreamingApi, streamSSE } from 'hono/streaming'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { nanoid } from 'nanoid'

type CORSOptions = {
    origin: string | string[] | ((origin: string, c: Context) => Promise<string | undefined | null> | string | undefined | null);
    allowMethods?: string[] | ((origin: string, c: Context) => Promise<string[]> | string[]);
    allowHeaders?: string[];
    maxAge?: number;
    credentials?: boolean;
    exposeHeaders?: string[];
};

interface SSETransportOptions {
  port: number
  route?: string
  cors?: CORSOptions
}

export default async function (opts: SSETransportOptions = {
  port: 3333,
  cors: { origin: '*' }
}) {
  const app = new Hono()
  const connections: Record<string, SSEStreamingApi> = {}

  const route = opts.route ?? '/'

  app.use(route, cors())
  app.get(route, (c) => {
    const conn_id = nanoid()
    return streamSSE(c, async (stream) => {
      connections[conn_id] = stream
      stream.onAbort(() => { delete connections[conn_id] })
      while (true) { await stream.sleep(1000) }
    })
  })

  const server = serve({ port: opts.port, fetch: app.fetch })

  return build(async (stream) => {
    for await (const obj of stream) {
      const data = JSON.stringify(obj)
      await Promise.all(Object.values(connections).map((conn) => conn.writeSSE({ data })))
    }
  }, {
    async close(_) {
      await Promise.all(Object.values(connections).map((conn) => conn.close()))
      server.close()
    },
    parseLine(line) {
      return JSON.parse(line)
    },
  })
}
