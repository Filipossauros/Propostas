import type { InformacaoEavalia } from "../core/types";
import { medidasPerguntadas } from "../excel/eavaliaModelo";

interface Props {
  eavalia: InformacaoEavalia;
  onChange: (eavalia: InformacaoEavalia) => void;
}

/**
 * As perguntas e as respostas são as do modelo eAvalia (`eavaliaModelo.ts`),
 * pela ordem das linhas do formulário — as mesmas que o ficheiro-padrão oferece
 * a quem o preenche à mão. As opções estão escritas tal e qual as listas de
 * escolha do formulário, incluindo o "Já cumpre" com minúscula.
 */
const MEDIDAS = medidasPerguntadas();

/**
 * Muda uma resposta só.
 *
 * O campo vem de uma união e o valor de um `select`, pelo que a ligação entre
 * os dois — que a lista de opções já garante — tem de ser afirmada aqui.
 */
function comResposta(eavalia: InformacaoEavalia, campo: keyof InformacaoEavalia, valor: string): InformacaoEavalia {
  return { ...eavalia, [campo]: valor } as InformacaoEavalia;
}

export function InformacaoEavaliaEditor({ eavalia, onChange }: Props) {
  const porResponder = MEDIDAS.filter((m) => eavalia[m.campo] === "").length;

  return (
    <>
      <div className="grelha-eavalia">
        {MEDIDAS.map((medida) => (
          <label key={medida.campo}>
            <span className="rotulo">{medida.pergunta}</span>
            <select
              value={eavalia[medida.campo]}
              aria-invalid={eavalia[medida.campo] === ""}
              onChange={(e) => onChange(comResposta(eavalia, medida.campo, e.target.value))}
            >
              <option value="">— por responder —</option>
              {medida.opcoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {porResponder > 0 && (
        <p className="aviso aviso-erro">
          {porResponder === 1 ? "Falta responder a uma medida." : `Faltam responder a ${porResponder} medidas.`} As
          {" "}
          {MEDIDAS.length} são de preenchimento obrigatório.
        </p>
      )}

      <p className="ajuda">
        Preenchem as medidas correspondentes na folha «Alinhamento Tecnológico» do pedido de parecer prévio. A da
        usabilidade e acessibilidade responde-se na escala dos selos, que é a que o formulário traz para essa linha.
        Duas outras medidas seguem com resposta fixa, que não se decide procedimento a procedimento: o ponto de troca
        de tráfego (PTT) vai como «Já cumpre», e o Quadro Nacional de Referência para a Cibersegurança como «Não
        aplicável».
      </p>
    </>
  );
}
