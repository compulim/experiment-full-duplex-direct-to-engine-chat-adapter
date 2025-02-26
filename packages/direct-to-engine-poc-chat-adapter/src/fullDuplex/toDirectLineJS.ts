import {
  TestCanvasBotStrategy,
  toDirectLineJS,
  type Activity,
  type Strategy,
  type TurnGenerator
} from 'copilot-studio-direct-to-engine-chat-adapter';
import { Observable } from 'iter-fest';
import shareObservable from '../private/shareObservable';
import spyObservable from './private/spyObservable';

declare global {
  const npm_package_name: string;
  const npm_package_version: string;
}

export class TestCanvasBotWithSubscribeStrategy extends TestCanvasBotStrategy {
  override async prepareStartNewConversation(): ReturnType<Strategy['prepareStartNewConversation']> {
    const preparation = await super.prepareStartNewConversation();

    console.log('-------------- startNewConversation', preparation);

    return {
      ...preparation,
      baseURL: new URL(preparation.baseURL + 'subscribe')
    };
  }

  override async prepareExecuteTurn(): ReturnType<Strategy['prepareExecuteTurn']> {
    const preparation = await super.prepareExecuteTurn();

    console.log('-------------- executeTurn', preparation);

    return {
      ...preparation,
      baseURL: new URL(preparation.baseURL + 'subscribe')
    };
  }
}

const CHAT_ADAPTER_HEADER_NAME = 'x-ms-chat-adapter';
const CONVERSATION_ID_HEADER_NAME = 'x-ms-conversationid';
// const CORRELATION_ID_HEADER_NAME = 'x-ms-correlation-id';

export function toDirectLineJSWithSubscribe(
  turnGenerator: TurnGenerator,
  strategy: TestCanvasBotWithSubscribeStrategy
) {
  let conversationId: string | undefined;
  const directLine = toDirectLineJS(turnGenerator);

  directLine
    .postActivity({ channelData: { dummy: true }, from: { id: 'user' }, text: '', type: 'message' })
    .subscribe(() => {});

  return {
    ...directLine,
    activity$: spyObservable(directLine.activity$, {
      next(activity: Activity) {
        if (activity.conversation?.id) {
          conversationId = activity.conversation.id;
        }
      }
    }),
    postActivity(activity: Activity): Observable<string> {
      return shareObservable(
        new Observable(subscriber => {
          const abortController = new AbortController();

          (async signal => {
            const preparation = await strategy.prepareExecuteTurn();
            const id = crypto.randomUUID();

            const headers = new Headers(preparation.headers);

            conversationId && headers.set(CONVERSATION_ID_HEADER_NAME, conversationId);
            headers.set('content-type', 'application/json');
            headers.set(
              CHAT_ADAPTER_HEADER_NAME,
              new URLSearchParams([
                ['name', npm_package_name],
                ['version', npm_package_version]
              ] satisfies string[][]).toString()
            );

            const res = await fetch(
              new URL(`${preparation.baseURL}${conversationId ? encodeURI(conversationId) : '.'}/execute`),
              {
                body: JSON.stringify({ ...preparation.body, activity }),
                headers,
                method: 'POST',
                signal
              }
            );

            if (!res.ok) {
              return subscriber.error(
                new Error(`Failed to send activity via /execute, server returned ${res.status}.`)
              );
            }

            await res.text();

            subscriber.next(id);
            subscriber.complete();
          })(abortController.signal);

          return () => abortController.abort();
        })
      );
    }
  };
}
