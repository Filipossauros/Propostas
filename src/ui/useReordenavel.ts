import { useState, type DragEvent } from "react";

/** Move um elemento de `de` para `para`, devolvendo uma lista nova. */
export function moverItem<T>(itens: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= itens.length || para >= itens.length) return itens;
  const copia = itens.slice();
  const [movido] = copia.splice(de, 1);
  copia.splice(para, 0, movido);
  return copia;
}

interface PropsAlvo {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  "data-alvo": boolean | undefined;
}

interface PropsPega {
  draggable: true;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export interface Reordenavel {
  /** Índice do item em arrasto, ou null. */
  aArrastar: number | null;
  /** Props do elemento que recebe a largada — a linha inteira. */
  propsAlvo: (indice: number) => PropsAlvo;
  /** Props da pega de arrasto. Só ela é arrastável — ver abaixo. */
  propsPega: (indice: number) => PropsPega;
}

/**
 * Reordenação por arrasto, com a API nativa do browser (sem dependências).
 *
 * O arrasto parte de uma pega própria, e não da linha inteira: com a linha
 * arrastável, selecionar texto dentro de um campo iniciava um arrasto em vez
 * de selecionar. A largada, essa, é aceite em qualquer ponto da linha, para o
 * alvo ser generoso.
 *
 * O arrasto é um atalho, não o único caminho: quem navega por teclado continua
 * a dispor das setas de subir e descer, que fazem exatamente o mesmo.
 */
export function useReordenavel(onReordenar: (de: number, para: number) => void): Reordenavel {
  const [aArrastar, setAArrastar] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);

  function limpar() {
    setAArrastar(null);
    setAlvo(null);
  }

  return {
    aArrastar,
    propsAlvo: (indice) => ({
      onDragOver: (e) => {
        if (aArrastar === null) return;
        // Sem preventDefault o browser recusa a largada neste elemento.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (alvo !== indice) setAlvo(indice);
      },
      onDrop: (e) => {
        e.preventDefault();
        if (aArrastar !== null) onReordenar(aArrastar, indice);
        limpar();
      },
      "data-alvo": alvo === indice && aArrastar !== null && aArrastar !== indice ? true : undefined,
    }),
    propsPega: (indice) => ({
      draggable: true,
      onDragStart: (e) => {
        setAArrastar(indice);
        e.dataTransfer.effectAllowed = "move";
        // O Firefox só inicia o arrasto se houver dados associados.
        e.dataTransfer.setData("text/plain", String(indice));
      },
      onDragEnd: limpar,
    }),
  };
}
