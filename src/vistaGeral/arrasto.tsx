import { useState } from "react";

// Reordenação dos projetos por arrasto, partilhada pelas duas tabelas.
//
// Vive aqui, e não dentro de uma delas, porque a ordem é uma só: arrastar no
// resumo tem de mexer no detalhe e vice-versa. As duas tabelas usam o mesmo
// mecanismo sobre o mesmo estado, e é isso que as mantém a par sem nada as
// sincronizar.

interface Props {
  onMover: (arrastadoId: string, alvoId: string) => void;
  onDeslocar: (projetoId: string, passos: number) => void;
}

export interface Arrasto {
  /** Props do elemento que se agarra para arrastar. */
  pega: (projetoId: string, nome: string) => React.HTMLAttributes<HTMLElement> & { draggable: true };
  /** Props da linha ou do bloco onde o projeto arrastado pode cair. */
  zona: (projetoId: string) => React.HTMLAttributes<HTMLElement>;
  /** Classe a juntar à linha ou bloco, conforme o seu estado no arrasto. */
  classe: (projetoId: string) => string;
}

export function useArrastoDeProjetos({ onMover, onDeslocar }: Props): Arrasto {
  const [aArrastar, setAArrastar] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  function largar() {
    setAArrastar(null);
    setAlvo(null);
  }

  return {
    pega: (projetoId, nome) => ({
      draggable: true,
      role: "button",
      tabIndex: 0,
      className: "pega-arrasto",
      "aria-label": `Reordenar ${nome}: arraste, ou use as setas para cima e para baixo`,
      title: "Arraste para reordenar",
      onDragStart: (e: React.DragEvent) => {
        setAArrastar(projetoId);
        e.dataTransfer.effectAllowed = "move";
        // O Firefox só inicia o arrasto se houver dados associados.
        e.dataTransfer.setData("text/plain", projetoId);
      },
      onDragEnd: largar,
      onKeyDown: (e: React.KeyboardEvent) => {
        const passos = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        if (passos === 0) return;
        e.preventDefault();
        onDeslocar(projetoId, passos);
      },
    }),

    zona: (projetoId) => ({
      onDragOver: (e: React.DragEvent) => {
        if (aArrastar === null) return;
        // Sem isto o navegador recusa o largar: é a maneira de dizer que este
        // sítio aceita o que vem a caminho.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (alvo !== projetoId) setAlvo(projetoId);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (aArrastar !== null) onMover(aArrastar, projetoId);
        largar();
      },
    }),

    classe: (projetoId) => {
      if (projetoId === aArrastar) return "projeto-a-arrastar";
      if (projetoId === alvo && aArrastar !== null) return "projeto-alvo";
      return "";
    },
  };
}
