import { formatarNumero } from "../core/lotes";
import {
  externosDaUnidade,
  externosDoProjeto,
  internosDaUnidade,
  internosDoProjeto,
  pessoasDaUnidade,
  pessoasDoProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import {
  externosDaDirecao,
  internosDaDirecao,
  nomeDaUnidade,
  percentagemNaDirecao,
  percentagemNaSuaUnidade,
  pessoasDaDirecao,
  type VistaDirecao,
} from "../core/vistaGeralDirecao";
import { DicaNota } from "../ui/DicaNota";
import { BotaoQueAbre } from "./LinhaQueAbre";
import { useLinhasAbertas } from "./linhasAbertas";

interface Props {
  vista: VistaDirecao;
}

const umaCasa = (valor: number) => formatarNumero(Math.round(valor * 10) / 10);

/**
 * O resumo da direção: uma unidade por linha, e só pessoas.
 *
 * É o mesmo quadro que a unidade tem sobre os seus projetos, um nível acima —
 * e por isso responde à mesma pergunta, com a mesma leitura: quanto de cada
 * unidade se contrata, quanto sai da casa, e que fatia da direção ocupa. Abrir
 * uma unidade mostra os projetos que a compõem, aí com a fatia da sua unidade:
 * é a pergunta seguinte de quem vê uma unidade a pesar mais do que esperava.
 */
export function ResumoPorUnidade({ vista }: Props) {
  const linhas = useLinhasAbertas();

  if (vista.unidades.length === 0) {
    return <p className="estado-vazio">Sem unidades para resumir.</p>;
  }

  const pessoas = pessoasDaDirecao(vista);

  return (
    <div className="tabela-envolvente">
      <table className="tabela tabela-resumo-unidade">
        <caption className="tabela-legenda">
          A percentagem é a fatia das pessoas da direção que a unidade ocupa — contando os elementos exigidos nos
          perfis e os elementos internos que cada unidade registou. Dentro de uma unidade, a percentagem é a fatia
          dessa unidade.
        </caption>

        <thead>
          <tr>
            <th scope="col">Unidade</th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                Elementos externos
                <DicaNota rotulo="O que são os elementos externos">
                  O número mínimo de elementos exigido aos concorrentes em cada perfil dos projetos da unidade.
                </DicaNota>
              </span>
            </th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                Elementos internos
                <DicaNota rotulo="O que são os elementos internos">
                  As pessoas da casa afetas aos projetos, registadas pelo nome na Vista Geral de cada unidade. Cada
                  uma conta um.
                </DicaNota>
              </span>
            </th>
            <th scope="col" className="numerico">
              Total
            </th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                % na direção
                <DicaNota rotulo="Como se calcula o peso na direção">
                  O peso é calculado sobre o total de elementos (internos e externos) da direção. Não entra em conta
                  o valor de cada unidade, uma vez que apenas são contabilizados custos de FSE.
                </DicaNota>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          {vista.unidades.map((unidade) => (
            <LinhasDaUnidade
              key={nomeDaUnidade(unidade)}
              unidade={unidade}
              vista={vista}
              aberta={linhas.esta(nomeDaUnidade(unidade))}
              onAlternar={() => linhas.alternar(nomeDaUnidade(unidade))}
            />
          ))}
        </tbody>

        <tfoot>
          <tr>
            <th scope="row">Total da direção</th>
            <td className="numerico">
              <strong>{externosDaDirecao(vista)}</strong>
            </td>
            <td className="numerico">
              <strong>{internosDaDirecao(vista)}</strong>
            </td>
            <td className="numerico celula-destacada">
              <strong>{pessoas}</strong>
            </td>
            <td className="numerico">
              <span className="percentagem">
                <span className="percentagem-valor">{pessoas === 0 ? "—" : "100,0 %"}</span>
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LinhasDaUnidade({
  unidade,
  vista,
  aberta,
  onAlternar,
}: {
  unidade: OrcamentoUnidade;
  vista: VistaDirecao;
  aberta: boolean;
  onAlternar: () => void;
}) {
  const peso = percentagemNaDirecao(vista, unidade);

  return (
    <>
      <tr className="linha-unidade">
        <th scope="row">
          <BotaoQueAbre
            aberto={aberta}
            texto={nomeDaUnidade(unidade)}
            meta={`${unidade.projetos.length} projeto(s)`}
            onAlternar={onAlternar}
          />
        </th>
        <td className="numerico">{externosDaUnidade(unidade)}</td>
        <td className="numerico">{internosDaUnidade(unidade)}</td>
        <td className="numerico celula-destacada">{pessoasDaUnidade(unidade)}</td>
        <td className="numerico">
          <span className="percentagem">
            <span className="barra-percentagem" aria-hidden="true">
              <span style={{ width: `${Math.min(100, peso)}%` }} />
            </span>
            <span className="percentagem-valor">{umaCasa(peso)} %</span>
          </span>
        </td>
      </tr>

      {aberta &&
        unidade.projetos.map((projeto) => (
          <tr key={projeto.id} className="linha-detalhe">
            <th scope="row">{projeto.nome}</th>
            <td className="numerico">{externosDoProjeto(projeto)}</td>
            <td className="numerico">{internosDoProjeto(projeto)}</td>
            <td className="numerico celula-destacada">{pessoasDoProjeto(projeto)}</td>
            <td className="numerico">
              <span className="percentagem">
                <span className="percentagem-valor">
                  {umaCasa(percentagemNaSuaUnidade(unidade, projeto))} % <span className="meta">da unidade</span>
                </span>
              </span>
            </td>
          </tr>
        ))}
    </>
  );
}
