import { useEffect, useState } from "react";
import { guardarEstado, lerEstado } from "./persistencia";

/**
 * useState que se repõe a partir do localStorage e grava a cada alteração.
 *
 * `validar` protege contra estado gravado por uma versão anterior da aplicação;
 * `normalizar` põe em dia o que for recuperável, em vez de o deitar fora. Sem
 * ele, o que está guardado atravessa incólume todas as versões seguintes — que
 * é como um texto de partida antigo sobrevive a ter sido substituído.
 */
export function useEstadoPersistente<T>(
  chave: string,
  inicial: () => T,
  validar: (valor: unknown) => valor is T,
  normalizar: (valor: T) => T = (valor) => valor,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => {
    const guardado = lerEstado<unknown>(chave);
    return guardado !== null && validar(guardado) ? normalizar(guardado) : inicial();
  });

  useEffect(() => {
    guardarEstado(chave, valor);
  }, [chave, valor]);

  return [valor, setValor];
}
