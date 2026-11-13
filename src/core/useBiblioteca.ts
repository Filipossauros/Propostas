import { useEffect, useState } from "react";
import { CHAVE_BIBLIOTECA, PERSISTENCIA_DISPONIVEL, guardarEstado, lerChave, lerEstado } from "./persistencia";
import {
  bibliotecaDaVersaoAnterior,
  ehBibliotecaGuardada,
  normalizarBiblioteca,
  type Biblioteca,
} from "./biblioteca";

/** Se a última alteração ficou guardada neste navegador. */
export type EstadoDaGravacao = "guardado" | "falhou" | "indisponivel";

/**
 * A biblioteca de pedidos, guardada a cada alteração. Sem biblioteca guardada
 * (primeira abertura desta versão), parte do que a versão anterior deixou.
 * Ao contrário das outras gravações, esta diz se conseguiu: perder um pedido
 * sem aviso não é aceitável.
 */
export function useBiblioteca(): [Biblioteca, React.Dispatch<React.SetStateAction<Biblioteca>>, EstadoDaGravacao] {
  const [biblioteca, setBiblioteca] = useState<Biblioteca>(() => {
    const guardada = lerEstado<unknown>(CHAVE_BIBLIOTECA);
    return guardada !== null && ehBibliotecaGuardada(guardada)
      ? normalizarBiblioteca(guardada)
      : bibliotecaDaVersaoAnterior(lerChave);
  });
  const [gravacao, setGravacao] = useState<EstadoDaGravacao>(PERSISTENCIA_DISPONIVEL ? "guardado" : "indisponivel");

  useEffect(() => {
    if (!PERSISTENCIA_DISPONIVEL) return;
    // O resultado da gravação vem de fora (o armazenamento do navegador): é
    // isso que este efeito sincroniza.
    // oxlint-disable-next-line react/set-state-in-effect
    setGravacao(guardarEstado(CHAVE_BIBLIOTECA, biblioteca) ? "guardado" : "falhou");
  }, [biblioteca]);

  return [biblioteca, setBiblioteca, gravacao];
}
