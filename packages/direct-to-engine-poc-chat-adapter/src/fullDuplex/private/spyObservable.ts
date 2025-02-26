import { Observable, type Observer } from 'iter-fest';

export default function spyObservable<T>(source$: Observable<T>, spy: Observer<T>) {
  return new Observable<T>(subscriber => {
    const spySubscription = source$.subscribe({
      complete() {
        spy.complete?.();
        subscriber.complete();
      },
      error(error: unknown) {
        spy.error?.(error);
        subscriber.error(error);
      },
      next(value: T) {
        spy.next?.(value);
        subscriber.next(value);
      }
    });

    spy.start?.(spySubscription);

    return spySubscription;
  });
}
