import { observableFromAsync, readableStreamValues, type Observable } from 'iter-fest';
import { looseObject, parse } from 'valibot';
import shareObservable from './private/shareObservable';

type Activity = Record<string, any>;
type ConnectionStatus = 0 | 1 | 2 | 3 | 4;

class FullDuplexChatAdapter {
  constructor(url: string | URL) {
    let lastConnectionStatus: ConnectionStatus | undefined;

    this.#url = new URL(url);

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
      start(controller) {
        connectionStatusWriter.write(1);

        const eventSource = new EventSource(url);

        eventSource.addEventListener('open', () => connectionStatusWriter.write(2));

        eventSource.addEventListener('activity', event =>
          controller.enqueue(parse(looseObject({}), JSON.parse(event.data)))
        );
      }
    });

    this.#activityIterator = readableStreamValues(activityStream.readable);
    this.#activityWriter = activityStream.writable.getWriter();
    this.#connectionStatusIterator = readableStreamValues(connectionStatusTransform.readable);
  }

  #activityIterator: AsyncIterableIterator<Activity, void, void>;
  #activityWriter: WritableStreamDefaultWriter<Activity>;
  #connectionStatusIterator: AsyncIterableIterator<ConnectionStatus, void, void>;
  #url: URL;

  get activityIterator(): AsyncIterableIterator<Activity, void, void> {
    return this.#activityIterator;
  }

  get connectionStatusIterator(): AsyncIterableIterator<ConnectionStatus, void, void> {
    return this.#connectionStatusIterator;
  }

  get url(): URL {
    return this.#url;
  }

  toDirectLineJS() {
    const activity$ = shareObservable(observableFromAsync(this.activityIterator));
    const connectionStatus$ = shareObservable(observableFromAsync(this.connectionStatusIterator));
    const { url } = this;
    const activityWriter = this.#activityWriter;

    return {
      activity$,
      connectionStatus$,
      postActivity(activity: Activity): Observable<string> {
        return observableFromAsync<string>(
          (async function* () {
            const req = await fetch(new URL('execute', url));

            if (!req.ok) {
              throw new Error(`Failed to post activity, server returned ${req.status}.`);
            }

            const id = crypto.randomUUID();

            activityWriter.write({ ...activity, id, timestamp: new Date().toISOString() });

            return id;
          })()
        );
      }
    };
  }
}

export default FullDuplexChatAdapter;
