import { useRef } from "react";

/**
 * Controla cargas concorrentes. Cada chamada marca uma nova carga e devolve uma
 * função que diz se ela ainda é a mais recente.
 */
export function createLoadTracker() {
  let latest = 0;
  return () => {
    const id = ++latest;
    return () => id === latest;
  };
}

/** Evita que a resposta de um mês antigo substitua a do mês escolhido por último. */
export function useLatestLoad() {
  const tracker = useRef(createLoadTracker());
  return tracker.current;
}
