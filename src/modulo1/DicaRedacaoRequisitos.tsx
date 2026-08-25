import { useId } from "react";

/**
 * Regras de redação dos requisitos.
 *
 * Cada requisito vira uma linha do formulário de declaração, respondida com
 * «SIM» ou «NÃO» pelo próprio titular da experiência. Daí virem quase todas as
 * regras: o que não for mensurável, ou juntar duas exigências numa frase, não
 * admite resposta binária — e um requisito que não admite resposta clara é o
 * que depois se discute.
 */
const REGRAS = [
  "Um requisito por linha",
  "Apenas requisitos mensuráveis",
  "Não indicar habilitações académicas",
  "Não indicar línguas",
  "Não indicar competências vagas",
  "Não indicar experiência em ferramentas não específicas do projeto",
  "Não usar hífen",
  "Não usar “e” ou “ou”",
  "Não usar vírgulas ou ponto e vírgula",
];

export function DicaRedacaoRequisitos() {
  const id = useId();

  return (
    <span className="dica">
      <button type="button" className="dica-alvo dica-ajuda" aria-describedby={id} aria-label="Como preencher">
        ?
      </button>

      <span role="tooltip" id={id} className="dica-conteudo dica-lista">
        <strong>Como preencher</strong>
        <ul>
          {REGRAS.map((regra) => (
            <li key={regra}>{regra}</li>
          ))}
        </ul>
      </span>
    </span>
  );
}
