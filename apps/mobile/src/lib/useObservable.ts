import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/**
 * Suscribe un componente a un Observable de WatermelonDB (o cualquier rxjs).
 * Devuelve el último valor emitido, o `initial` hasta la primera emisión.
 *
 * La factory se memoiza por las `deps` que pases (típicamente [profile?.id] o
 * el/los parámetros de la query), para no re-suscribir en cada render.
 *
 * Uso:
 *   const services = useObservable(
 *     () => (profile ? observeServices(profile) : undefined),
 *     [profile?.id],
 *     [] as ServiceModel[],
 *   );
 */
export function useObservable<T>(
  factory: () => Observable<T> | undefined,
  deps: ReadonlyArray<unknown>,
  initial: T,
): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const observable = factory();
    if (!observable) {
      return;
    }
    const subscription = observable.subscribe({
      next: (next) => setValue(next),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
