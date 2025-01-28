import { Observable, type Subscription, type SubscriptionObserver } from 'iter-fest';

export default function shareObservable<T>(observable: Observable<T>): Observable<T> {
  const observers: SubscriptionObserver<T>[] = [];
  let subscription: Subscription | undefined;

  return new Observable(observer => {
    observers.push(observer);

    if (!subscription) {
      subscription = observable.subscribe({
        complete: () => observers.forEach(observer => observer.complete()),
        error: err => observers.forEach(observer => observer.error(err)),
        next: value => observers.forEach(observer => observer.next(value))
      });
    }

    return () => {
      const index = observers.indexOf(observer);

      ~index && observers.splice(index, 1);

      if (!observers.length) {
        subscription?.unsubscribe();
        subscription = undefined;
      }
    };
  });
}
