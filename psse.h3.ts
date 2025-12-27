import build from 'pino-abstract-transport'
import {createEventStream, defineEventHandler, H3, handleCors, serve } from 'h3'
import { v4 as uuid } from 'uuid'

interface SSETransportOptions {

}

export default async function (opts: SSETransportOptions) {
  const app = new H3()
  let event_stream: any = null

  app.get("/", (event) => {
    const cors = handleCors(event, {
      origin: '*',
      preflight: {
        statusCode: 204,
      },
      methods: '*',
    })
    if (cors !== false) return cors

    event_stream = createEventStream(event);
    return event_stream.send();
  });

  const server = serve(app, {port: 3333})

  return build(async (stream) => {
    for await (const obj of stream) {
      obj["log_id"] = uuid()
      const log = JSON.stringify(obj)
      if (!event_stream)
        continue
      await event_stream.push(log)
    }
  }, {
    async close(_) {
      console.log('Killing sse transport');
      await server.close()
    },
    parseLine(line) {
      return JSON.parse(line)
    },
  })
}
