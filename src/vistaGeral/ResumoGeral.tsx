import { formatarNumero } from "../core/lotes";
import {
  externosDaUnidade,
  externosDoProjeto,
  internosDaUnidade,
  internosDoProjeto,
  percentagemNaUnidade,
  pessoasDaUnidade,
  pessoasDoProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import { DicaNota } from "../ui/DicaNota";

interface Props {
  orcamento: OrcamentoUnidade;
}

/**
 * O resumo da unidade: um projeto por linha, e só pessoas.
 *
 * Vive à parte da tabela de detalhe porque responde a outra pergunta. A de
 * detalhe diz o que cada projeto tem lá dentro — perfis, lotes, valores por
 * ano; esta diz onde está a equipa, e para isso tem de caber num relance.
 *
 * Sem euros, deliberadamente: só se apuram custos de FSE, pelo que uma coluna
 * de valor punha lado a lado um projeto todo externo com outro feito de gente
 * da casa, como se o segundo não custasse nada. Separar externos de internos
 * responde melhor à mesma pergunta — quanto de cada projeto se contrata, e
 * quanto sai da unidade.
 */
export function ResumoGeral({ orcamento }: Props) {
  if (orcamento.projetos.length === 0) {
    return <p className="estado-vazio">Sem projetos para resumir.</p>;
  }

  const pessoas = pessoasDaUnidade(orcamento);

  return (
    <div className="tabela-envolvente">
      <table className="tabela tabela-resumo-unidade">
        <caption className="tabela-legenda">
          A percentagem é a fatia das pessoas da unidade que o projeto ocupa — contando os elementos exigidos nos
          perfis e os elementos internos registados.
        </caption>

        <thead>
          <tr>
            <th scope="col">Projeto</th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                Elementos externos
                <DicaNota rotulo="O que são os elementos externos">
                  O número mínimo de elementos exigido aos concorrentes em cada perfil do projeto.
                </DicaNota>
              </span>
            </th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                Elementos internos
                <DicaNota rotulo="O que são os elementos internos">
                  As pessoas da unidade afetas ao projeto, registadas pelo nome na tabela de detalhe. Cada uma conta
                  um.
                </DicaNota>
              </span>
            </th>
            <th scope="col" className="numerico">
              Total
            </th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                % na unidade
                <DicaNota rotulo="Como se calcula o peso na unidade">
                  O peso na unidade é calculado tendo por base o total de elementos (internos e externos) por
                  projeto. Este peso não tem em consideração o valor por projeto, uma vez que apenas são
                  contabilizados custos de FSE.
                </DicaNota>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orcamento.projetos.map((projeto) => {
            const percentagem = percentagemNaUnidade(orcamento, projeto);
            return (
              <tr key={projeto.id}>
                <th scope="row">{projeto.nome}</th>
                <td className="numerico">{externosDoProjeto(projeto)}</td>
                <td className="numerico celula-interna">{internosDoProjeto(projeto)}</td>
                <td className="numerico">{pessoasDoProjeto(projeto)}</td>
                <td className="numerico">
                  {/* A barra dá a comparação que os números sozinhos obrigam a
                      fazer de cabeça: é para isto que se abre este quadro. */}
                  <span className="barra-percentagem" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, percentagem)}%` }} />
                  </span>
                  {formatarNumero(Math.round(percentagem * 10) / 10)} %
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <th scope="row">Total da unidade</th>
            <td className="numerico">
              <strong>{externosDaUnidade(orcamento)}</strong>
            </td>
            <td className="numerico celula-interna">
              <strong>{internosDaUnidade(orcamento)}</strong>
            </td>
            <td className="numerico">
              <strong>{pessoas}</strong>
            </td>
            <td className="numerico">{pessoas === 0 ? "—" : "100,0 %"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
