import { formatarMoeda, formatarNumero } from "../core/lotes";
import {
  percentagemNaUnidade,
  pessoasDaUnidade,
  pessoasDoProjeto,
  valorDaUnidade,
  valorDoProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";

interface Props {
  orcamento: OrcamentoUnidade;
}

/**
 * O resumo da unidade: um projeto por linha, e só o que se compara entre eles.
 *
 * Vive à parte da tabela de detalhe porque responde a outra pergunta. A de
 * detalhe diz o que cada projeto tem lá dentro; esta diz onde está a equipa —
 * e para isso tem de caber num relance, sem rolar por dezenas de linhas de
 * perfis nem por uma dúzia de colunas de anos.
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
              Total Pessoas
            </th>
            <th scope="col" className="numerico">
              % na unidade
            </th>
            <th scope="col" className="numerico">
              Valor por projeto
            </th>
          </tr>
        </thead>

        <tbody>
          {orcamento.projetos.map((projeto) => {
            const percentagem = percentagemNaUnidade(orcamento, projeto);
            return (
              <tr key={projeto.id}>
                <th scope="row">{projeto.nome}</th>
                <td className="numerico">{pessoasDoProjeto(projeto)}</td>
                <td className="numerico">
                  {/* A barra dá a comparação que os números sozinhos obrigam a
                      fazer de cabeça: é para isto que se abre este quadro. */}
                  <span className="barra-percentagem" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, percentagem)}%` }} />
                  </span>
                  {formatarNumero(Math.round(percentagem * 10) / 10)} %
                </td>
                <td className="numerico">{formatarMoeda(valorDoProjeto(projeto))}</td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <th scope="row">Total da unidade</th>
            <td className="numerico">
              <strong>{pessoas}</strong>
            </td>
            <td className="numerico">{pessoas === 0 ? "—" : "100,0 %"}</td>
            <td className="numerico">
              <strong>{formatarMoeda(valorDaUnidade(orcamento))}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
