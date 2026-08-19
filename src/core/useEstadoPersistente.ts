import { useEffect, useState } from "react";
import { guardarEstado, lerEstado } from "./persistencia";

/**
 * useState que se repõe a partir do localStorage e grava a cada alteração.
 * `validar` protege contra estado gravado por uma versão anterior da aplicação.
 */
export function useEstadoPersistente<T>(
  chave: string,
  inicial: () => T,
  validar: (valor: unknown) => valor is T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => {
    const guardado = lerEstado<unknown>(chave);
    return guardado !== null && validar(guardado) ? guardado : inicial();
  });

  useEffect(() => {
    guardarEstado(chave, valor);
  }, [chave, valor]);

  return [valor, setValor];
}
