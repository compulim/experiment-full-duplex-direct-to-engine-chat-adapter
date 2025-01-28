import { asyncIteratorToAsyncIterable, observableFromAsync, readableStreamValues, type Observable } from 'iter-fest';
import { looseObject, parse } from 'valibot';

type Activity = Record<string, any>;
type ConnectionStatus = 0 | 1 | 2 | 3 | 4;

class FullDuplexChatAdapter {
  constructor(url: string | URL) {
    let lastConnectionStatus: ConnectionStatus | undefined;

    const connectionStatusTransform = new TransformStream<ConnectionStatus, ConnectionStatus>({
      start(controller) {
        controller.enqueue(0);
      },
      transform(connectionStatus, controller) {
        if (!Object.is(lastConnectionStatus, connectionStatus)) {
          controller.enqueue(connectionStatus);

          lastConnectionStatus = connectionStatus;
        }
      }
    });

    const connectionStatusWriter = connectionStatusTransform.writable.getWriter();

    const activityStream = new ReadableStream<Activity>({
      start(controller) {
        connectionStatusWriter.write(1);

        const eventSource = new EventSource(url);

        eventSource.addEventListener('message', event => {
          const activity = parse(looseObject({}), JSON.parse(event.data));

          console.log({ event, activity });

          controller.enqueue(activity);

          connectionStatusWriter.write(2);
        });
      }
    });

    this.#activityIterator = readableStreamValues(activityStream);
    this.#connectionStatusIterator = readableStreamValues(connectionStatusTransform.readable);
  }

  #activityIterator: AsyncIterator<Activity, void, void>;

  get activityIterator(): AsyncIterator<Activity, void, void> {
    return this.#activityIterator;
  }

  #connectionStatusIterator: AsyncIterator<ConnectionStatus, void, void>;

  get connectionStatusIterator(): AsyncIterator<ConnectionStatus, void, void> {
    return this.#connectionStatusIterator;
  }

  toDirectLineJS() {
    const activity$ = observableFromAsync(asyncIteratorToAsyncIterable(this.#activityIterator));
    const connectionStatus$ = observableFromAsync(asyncIteratorToAsyncIterable(this.#connectionStatusIterator));

    return {
      activity$,
      connectionStatus$,
      postActivity(): Observable<string> {
        console.log('Not implemented.');

        return observableFromAsync<string>(
          (async function* () {
            return 'a-00001';
          })()
        );
      }
    };
  }
}

export default FullDuplexChatAdapter;
