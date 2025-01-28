import { http, HttpResponse } from 'msw';

const encoder = new TextEncoder();

export const handlers = [
  http.get('http://localhost:8001/execute', () => HttpResponse.json({})),
  http.get('http://localhost:8001/subscribe', () => {
    const { readable, writable } = new TransformStream({
      transform(activity, controller) {
        controller.enqueue(encoder.encode(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`));
      }
    });

    const writer = writable.getWriter();

    writer.write({
      from: { id: 'bot', role: 'bot' },
      id: 'a-00001',
      text: 'Hello, World!',
      timestamp: new Date().toISOString(),
      type: 'message'
    });

    writer.write({
      from: { id: 'bot', role: 'bot' },
      id: 'a-00002',
      text: 'Aloha!',
      timestamp: new Date().toISOString(),
      type: 'message'
    });

    return new HttpResponse(readable, { headers: { 'content-type': 'text/event-stream' } });
  })
];
