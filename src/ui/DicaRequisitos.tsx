import { useId } from "react";
import type { Requisito } from "../core/types";
import { anosDeMeses } from "../core/types";

interface Props {
  requisitos: Requisito[];
}

/**
 * Mostra os requisitos de um perfil ao passar o rato ou ao focar pelo teclado.
 *
 * O conteúdo está sempre no DOM e é revelado por CSS, em vez de montado ao
 * passar o rato: assim um leitor de ecrã encontra-o por `aria-describedby`,
 * que é o que torna a dica utilizável sem rato.
 */
export function DicaRequisitos({ requisitos }: Props) {
  const id = useId();

  return (
    <span className="dica">
      <button type="button" className="dica-alvo" aria-describedby={id}>
        {requisitos.length} requisito(s)
      </button>

      <span role="tooltip" id={id} className="dica-conteudo">
        {requisitos.length === 0 ? (
          <span className="dica-vazia">Este perfil ainda não tem requisitos.</span>
        ) : (
          <ul>
            {requisitos.map((r) => (
              <li key={r.id}>
                <span className="dica-designacao">{r.designacao || "(requisito sem designação)"}</span>
                <span className="dica-exigencia">
                  {anosDeMeses(r.mesesMinimos)} {anosDeMeses(r.mesesMinimos) === 1 ? "ano" : "anos"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </span>
    </span>
  );
}
