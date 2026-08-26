import { useId } from "react";
import type { ReactNode } from "react";

interface Props {
  /** O que a dica explica, para quem a alcança sem ver o cabeçalho ao lado. */
  rotulo: string;
  children: ReactNode;
}

/**
 * Uma nota curta ao lado de um rótulo, revelada ao passar o rato ou ao focar.
 *
 * Serve os cabeçalhos de coluna cujo número precisa de uma ressalva para não
 * ser lido a mais do que vale. O conteúdo está sempre no DOM e é escondido por
 * CSS, e não montado ao passar o rato: é isso que o torna alcançável por
 * `aria-describedby`, e portanto utilizável sem rato.
 */
export function DicaNota({ rotulo, children }: Props) {
  const id = useId();

  return (
    <span className="dica">
      <button type="button" className="dica-alvo dica-ajuda" aria-describedby={id} aria-label={rotulo}>
        ?
      </button>

      {/* Ancorada à direita: estas dicas vivem nas últimas colunas da tabela, e
          uma dica alinhada à esquerda sairia fora do painel. */}
      <span role="tooltip" id={id} className="dica-conteudo dica-conteudo-direita">
        {children}
      </span>
    </span>
  );
}
