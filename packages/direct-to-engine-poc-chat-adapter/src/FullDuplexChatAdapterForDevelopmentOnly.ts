import { EventSourceParserStream, type EventSourceMessage } from 'eventsource-parser/stream';
import { observableFromAsync, readableStreamValues } from 'iter-fest';
import { looseObject, parse } from 'valibot';
import shareObservable from './private/shareObservable';

type Activity = Record<string, any>;
type ConnectionStatus = 0 | 1 | 2 | 3 | 4;
type FullDuplexChatAdapterInit = { DO_NOT_USE_THIS_FOR_PRODUCTION: true; token: string };

class FullDuplexChatAdapterForDevelopmentOnly {
  constructor(baseURL: string | URL, options: FullDuplexChatAdapterInit) {
    let lastConnectionStatus: ConnectionStatus | undefined;

    this.#baseURL = new URL(baseURL);
    this.#headers = new Headers({
      accept: 'text/event-stream,application/json;q=0.9',
      authorization: options?.token ? `Bearer ${options.token}` : '',
      'content-type': 'application/json'
    });

    const connectionStatusTransform = new TransformStream<ConnectionStatus, ConnectionStatus>({
      start(controller) {
        controller.enqueue(0);
      },
      transform(connectionStatus, controller) {
        // Dedupe connectionStatus.
        if (!Object.is(lastConnectionStatus, connectionStatus)) {
          controller.enqueue(connectionStatus);

          lastConnectionStatus = connectionStatus;
        }
      }
    });

    const connectionStatusWriter = connectionStatusTransform.writable.getWriter();

    const activityStream = new TransformStream<Activity, Activity>({
      start: async controller => {
        connectionStatusWriter.write(1);

        for (let numTurn = 0; numTurn < 1_000; numTurn++) {
          const [url, bodyJSON] = numTurn
            ? [new URL(`conversations/${this.conversationId || '.'}/subscribe`, baseURL), {}]
            : [
                new URL(this.baseURL),
                {
                  emitStartConversationEvent: true,
                  locale: navigator.language
                }
              ];

          const res = await fetch(url, { body: JSON.stringify(bodyJSON), headers: this.#headers, method: 'POST' });

          if (!res.ok) {
            return controller.error(new Error(`Failed to perform turn ${numTurn}, server returned ${res.status}.`));
          } else if (!res.body) {
            return controller.error(new Error(`Failed to read from SSE, not readable stream.`));
          }

          if (!numTurn) {
            this.#conversationId = res.headers.get('x-ms-conversationid') || '';

            // When conversationId is known, user will be able to start sending messages.
            connectionStatusWriter.write(2);
          }

          const typingMap = new Map();

          const readableStream = res.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream())
            .pipeThrough(
              new TransformStream<EventSourceMessage, Activity>({
                transform: ({ data, event }, controller) => {
                  if (event === 'end') {
                    controller.terminate();
                  } else if (event === 'activity') {
                    const activity = JSON.parse(data);

                    // Specific to DtE SSE protocol, this will accumulate intermediate result by concatenating with previous result.
                    if (
                      activity.type === 'typing' &&
                      activity.text &&
                      activity.channelData?.streamType === 'streaming' &&
                      activity.channelData?.chunkType === 'delta'
                    ) {
                      const streamId = activity.channelData?.streamId || activity.id;
                      const accumulated = (typingMap.get(streamId) || '') + activity.text;

                      typingMap.set(streamId, accumulated);
                      activity.text = accumulated;
                    }

                    controller.enqueue(activity);
                  }
                }
              })
            );

          for await (const activity of readableStreamValues(readableStream)) {
            controller.enqueue(parse(looseObject({}), activity));
          }
        }
      }
    });

    this.#activityIterator = readableStreamValues(activityStream.readable);
    this.#activityWriter = activityStream.writable.getWriter();
    this.#connectionStatusIterator = readableStreamValues(connectionStatusTransform.readable);
  }

  #activityIterator: AsyncIterableIterator<Activity, void, void>;
  #activityWriter: WritableStreamDefaultWriter<Activity>;
  #baseURL: URL;
  #connectionStatusIterator: AsyncIterableIterator<ConnectionStatus, void, void>;
  #conversationId: string | undefined;
  #headers: Headers;

  get activityIterator(): AsyncIterableIterator<Activity, void, void> {
    return this.#activityIterator;
  }

  get baseURL(): URL {
    return this.#baseURL;
  }

  get connectionStatusIterator(): AsyncIterableIterator<ConnectionStatus, void, void> {
    return this.#connectionStatusIterator;
  }

  get conversationId(): string | undefined {
    return this.#conversationId;
  }

  get headers(): Headers | undefined {
    return this.#headers;
  }

  toDirectLineJS() {
    const activity$ = shareObservable(observableFromAsync(this.activityIterator));
    const connectionStatus$ = shareObservable(observableFromAsync(this.connectionStatusIterator));

    return {
      activity$,
      connectionStatus$,
      postActivity: (activity: Activity) => {
        const { conversationId, baseURL } = this;
        const activityWriter = this.#activityWriter;
        const headers = this.#headers;

        return observableFromAsync<string>(
          (async function* (): AsyncGenerator<string, void, void> {
            const req = await fetch(new URL(`conversations/${conversationId || '.'}`, baseURL), {
              body: JSON.stringify({ activity }),
              headers,
              method: 'POST'
            });

            if (!req.ok) {
              throw new Error(`Failed to post activity, server returned ${req.status}.`);
            }

            const id = crypto.randomUUID();

            activityWriter.write({ ...activity, id, timestamp: new Date().toISOString() });

            yield id;
          })()
        );
      }
    };
  }
}

export default FullDuplexChatAdapterForDevelopmentOnly;
