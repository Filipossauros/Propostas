import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface AcaoDoMenu {
  rotulo: string;
  perigo?: boolean;
  onEscolher: () => void;
}

interface Props {
  /** O nome lido pelos leitores de ecrã no botão («Mais ações para …»). */
  rotulo: string;
  acoes: AcaoDoMenu[];
}

/**
 * Um botão ⋯ com um menu que flutua por cima do resto da página.
 *
 * O menu vive no fim do documento, em posição fixa, junto ao botão: assim não
 * fica cortado pela tabela (que desliza na horizontal) nem a empurra. Abre por
 * baixo do botão, ou por cima se não couber; fecha ao escolher, ao clicar fora,
 * com Escape, ou quando a página desliza.
 */
export function MenuFlutuante({ rotulo, acoes }: Props) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<React.CSSProperties>({});
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  // A posição mede-se antes de pintar, para o menu não aparecer noutro sítio primeiro.
  useLayoutEffect(() => {
    if (!aberto || botao.current === null) return;
    const r = botao.current.getBoundingClientRect();
    const altura = lista.current?.offsetHeight ?? 0;
    const cabeEmBaixo = r.bottom + 4 + altura <= window.innerHeight - 8;
    const direita = Math.max(8, window.innerWidth - r.right);
    // oxlint-disable-next-line react/set-state-in-effect
    setPosicao(
      cabeEmBaixo ? { top: r.bottom + 4, right: direita } : { bottom: window.innerHeight - r.top + 4, right: direita },
    );
    lista.current?.querySelector("button")?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!lista.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fechar();
        botao.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const itens = Array.from(lista.current?.querySelectorAll("button") ?? []);
      if (itens.length === 0) return;
      e.preventDefault();
      const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
      const proximo = e.key === "ArrowDown" ? (atual + 1) % itens.length : (atual - 1 + itens.length) % itens.length;
      itens[proximo].focus();
    };
    // Ao deslizar a página (ou a tabela), o botão sai do sítio: o menu fecha.
    const deslizou = (e: Event) => {
      if (!lista.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", deslizou, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", deslizou, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="menu-flutuante-botao"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        ⋯
      </button>
      {aberto &&
        createPortal(
          <div ref={lista} className="menu-flutuante" role="menu" aria-label={rotulo} style={posicao}>
            {acoes.map((a) => (
              <button
                key={a.rotulo}
                type="button"
                role="menuitem"
                className={a.perigo ? "botao-perigo" : undefined}
                onClick={() => {
                  setAberto(false);
                  a.onEscolher();
                }}
              >
                {a.rotulo}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
