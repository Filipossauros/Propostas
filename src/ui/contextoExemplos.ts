import { createContext, useContext } from "react";

/** Pergunta se está autorizado a carregar exemplos, pedindo a palavra-passe se for preciso. */
export type Perguntar = () => Promise<boolean>;

/**
 * Fora do `ProtecaoExemplos` ninguém está autorizado — e ninguém devia estar a
 * perguntar. Responder que não é mais seguro do que assumir que sim.
 */
export const ContextoExemplos = createContext<Perguntar>(() => Promise.resolve(false));

/**
 * Usa-se assim, num tratador de clique:
 * `if (!(await podeCarregarExemplo())) return;`
 */
export function usePodeCarregarExemplo(): Perguntar {
  return useContext(ContextoExemplos);
}
