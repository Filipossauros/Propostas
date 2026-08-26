import { useId } from "react";
import type { Requisito } from "../core/types";
import { ROTULO_CERTIFICACAO, ROTULO_CERTIFICACOES, anosDeMeses } from "../core/types";

interface Props {
  requisitos: Requisito[];
  /** Designações das certificações exigidas; vazio na maioria dos perfis. */
  certificacoes?: string[];
}

/**
 * Mostra os requisitos de um perfil ao passar o rato ou ao focar pelo teclado.
 *
 * O conteúdo está sempre no DOM e é revelado por CSS, em vez de montado ao
 * passar o rato: assim um leitor de ecrã encontra-o por `aria-describedby`,
 * que é o que torna a dica utilizável sem rato.
 */
export function DicaRequisitos({ requisitos, certificacoes = [] }: Props) {
  const id = useId();
  const exigidas = certificacoes;

  return (
    <span className="dica">
      {/* A existência de certificação vai também no rótulo, e não só dentro da
          dica: é uma exigência que se verifica fora desta ferramenta, e quem
          percorre a lista de perfis tem de dar por ela sem ter de abrir cada uma. */}
      <button type="button" className="dica-alvo" aria-describedby={id}>
        {requisitos.length} requisito(s)
        {exigidas.length > 0 && ` + ${exigidas.length === 1 ? "formação/certificação" : "formações/certificações"}`}
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

        {exigidas.length > 0 && (
          <span className="dica-certificacoes">
            <strong>{exigidas.length === 1 ? `${ROTULO_CERTIFICACAO} exigida` : `${ROTULO_CERTIFICACOES} exigidas`}</strong>
            {exigidas.join("; ")}
          </span>
        )}
      </span>
    </span>
  );
}
