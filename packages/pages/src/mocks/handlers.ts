import { http, HttpResponse, passthrough } from 'msw';

const encoder = new TextEncoder();

export const handlers = [
  http.post(
    'http://localhost:8000/environments/:environmentId/bots/:botId/test/conversations/:conversationId',
    () => HttpResponse.json({})
  ),
  http.get(
    'http://localhost:8000/environments/:environmentId/bots/:botId/test/conversations/:conversationId/subscribe',
    () => {
      const { readable, writable } = new TransformStream<[string, string], Uint8Array>({
        transform([type, content], controller) {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${content}\n\n`));
        }
      });

      const writer = writable.getWriter();

      writer.write([
        'activity',
        JSON.stringify({
          conversation: { id: 'c-00001' },
          from: { id: 'bot', role: 'bot' },
          id: 'a-00003',
          text: 'Good morning!',
          timestamp: new Date().toISOString(),
          type: 'message'
        })
      ]);

      writer.write([
        'activity',
        JSON.stringify({
          conversation: { id: 'c-00001' },
          from: { id: 'bot', role: 'bot' },
          id: 'a-00004',
          text: 'Good afternoon!',
          timestamp: new Date().toISOString(),
          type: 'message'
        })
      ]);

      return new HttpResponse(readable, {
        headers: {
          'content-type': 'text/event-stream',
          'x-ms-conversationid': 'c-00001'
        }
      });
    }
  ),
  http.post('http://localhost:8000/environments/:environmentId/bots/:botId/test/conversations', () => {
    const { readable, writable } = new TransformStream<[string, string], Uint8Array>({
      transform([type, content], controller) {
        controller.enqueue(encoder.encode(`event: ${type}\ndata: ${content}\n\n`));
      }
    });

    const writer = writable.getWriter();

    writer.write([
      'activity',
      JSON.stringify({
        conversation: { id: 'c-00001' },
        from: { id: 'bot', role: 'bot' },
        id: 'a-00001',
        text: 'Hello, World!',
        timestamp: new Date().toISOString(),
        type: 'message'
      })
    ]);

    writer.write([
      'activity',
      JSON.stringify({
        conversation: { id: 'c-00001' },
        from: { id: 'bot', role: 'bot' },
        id: 'a-00002',
        text: 'Aloha!',
        timestamp: new Date().toISOString(),
        type: 'message'
      })
    ]);

    writer.write(['end', 'end']);

    writer.close();

    return new HttpResponse(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'x-ms-conversationid': 'c-00001'
      }
    });
  }),
  http.all('*', () => passthrough())
];
