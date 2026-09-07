// Que linhas de uma tabela estão abertas.
//
// Vive à parte do botão que as abre para o ficheiro dele exportar só o
// componente — é o que mantém a recarga rápida a funcionar em edição.

import { useState } from "react";

/** O conjunto de linhas abertas de uma tabela, e como se alterna cada uma. */
export function useLinhasAbertas() {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());

  return {
    esta: (chave: string) => abertas.has(chave),
    alternar: (chave: string) =>
      setAbertas((atual) => {
        const proximo = new Set(atual);
        if (proximo.has(chave)) proximo.delete(chave);
        else proximo.add(chave);
        return proximo;
      }),
  };
}
