import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('http://localhost:8001/subscribe', () =>
    HttpResponse.text(`data: { "from": { "id": "bot" }, "id": "a-00001", "text": "Hello, World!", "type": "message" }\n\n`, {
      headers: { 'content-type': 'text/event-stream' }
    })
  )
];
