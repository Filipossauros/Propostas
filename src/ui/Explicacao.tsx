import type { ReactNode } from "react";

interface Props {
  /** A pergunta que a explicação responde: «O que é o sublicenciamento?». */
  pergunta: string;
  children: ReactNode;
}

/**
 * Uma explicação para quem não conhece o termo: um (i) com a pergunta, que se
 * abre por baixo do campo. Fica fora dos rótulos — dentro de um, carregar no
 * texto mudava a opção.
 *
 * É um `<details>`: abre-se com o teclado e com o toque, e não depende de
 * passar o rato por cima.
 */
export function Explicacao({ pergunta, children }: Props) {
  return (
    <details className="explicacao">
      <summary>
        <span className="explicacao-icone" aria-hidden="true">
          i
        </span>
        {pergunta}
      </summary>
      <div className="explicacao-texto">{children}</div>
    </details>
  );
}
