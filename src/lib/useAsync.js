import { useCallback, useEffect, useRef, useState } from 'react';

/** Načte data a drží stav načítání a chyby. Starší odpověď přepsat novější nemůže. */
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await load();
      if (id === requestId.current) setState({ data, loading: false, error: '' });
    } catch (err) {
      if (id === requestId.current) setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

/** Spustí akci a drží stav odesílání a chyby. Vrací true při úspěchu. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return { busy, error, run, clearError };
}
