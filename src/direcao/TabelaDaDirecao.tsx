import { formatarMoeda } from "../core/lotes";
import { pessoasDaUnidade, valorDaEntradaNoAno, type ProjetoVistaGeral } from "../core/vistaGeral";
import {
  nomeDaUnidade,
  totaisPorAnoDaDirecao,
  totaisPorAnoDaDirecaoSemIva,
  valorDaUnidadeNosAnos,
  type VistaDirecao,
} from "../core/vistaGeralDirecao";
import { BotaoQueAbre } from "./LinhaQueAbre";
import { useLinhasAbertas } from "./linhasAbertas";

interface Props {
  vista: VistaDirecao;
  anos: number[];
}

/**
 * O detalhe da direção: as unidades, e dentro de cada uma os seus projetos.
 *
 * É a mesma tabela da vista da unidade, com um nível a mais por cima — e sem
 * nada para editar. Os elementos internos aparecem porque contam para a equipa,
 * mas não se acrescentam nem se apagam aqui: quem os conhece é a unidade, e é
 * lá que se registam.
 */
export function TabelaDaDirecao({ vista, anos }: Props) {
  const linhas = useLinhasAbertas();

  if (vista.unidades.length === 0) {
    return <p className="estado-vazio">Importe as Vistas Gerais das unidades para começar.</p>;
  }

  const nColunas = 5 + anos.length;
  const totais = totaisPorAnoDaDirecao(vista, anos);
  const totaisSemIva = totaisPorAnoDaDirecaoSemIva(vista, anos);

  return (
    <div className="tabela-envolvente">
      <table className="tabela tabela-unidade">
        <thead>
          <tr>
            <th scope="col">Projeto</th>
            <th scope="col" className="numerico">
              Lotes
            </th>
            <th scope="col">Perfil</th>
            <th scope="col" className="numerico">
              Pessoas
            </th>
            <th scope="col" className="numerico">
              Rate (€/h) <span className="cabecalho-nota">c/ IVA</span>
            </th>
            {anos.map((ano) => (
              <th key={ano} scope="col" className="numerico">
                Total € c/ IVA <span className="cabecalho-nota">(11 meses)</span>{" "}
                <span className="cabecalho-nota">{ano}</span>
              </th>
            ))}
          </tr>
        </thead>

        {vista.unidades.map((unidade) => {
          const nome = nomeDaUnidade(unidade);
          const aberta = linhas.esta(nome);

          return (
            <tbody key={nome}>
              <tr className="linha-grupo">
                <th scope="colgroup" colSpan={nColunas}>
                  <BotaoQueAbre
                    aberto={aberta}
                    texto={nome}
                    meta={
                      `${unidade.projetos.length} projeto(s) · ${pessoasDaUnidade(unidade)} pessoas · ` +
                      `${formatarMoeda(valorDaUnidadeNosAnos(unidade, anos))} c/ IVA`
                    }
                    onAlternar={() => linhas.alternar(nome)}
                  />
                </th>
              </tr>

              {aberta &&
                unidade.projetos.map((projeto) => (
                  <LinhasDoProjeto key={projeto.id} projeto={projeto} anos={anos} />
                ))}
            </tbody>
          );
        })}

        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Total da direção
            </th>
            {totais.map((total, i) => (
              <td key={anos[i]} className="numerico">
                {/* As duas versões só aqui, como na vista da unidade: é este o
                    valor que instrui o processo, e é aqui que a pergunta se faz. */}
                <strong>{formatarMoeda(total)}</strong>
                <span className="total-sem-iva">{formatarMoeda(totaisSemIva[i])} s/ IVA</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * As linhas de um projeto: uma por perfil e uma por elemento interno.
 *
 * O nome do projeto escreve-se uma vez e abrange as linhas todas — vê-lo
 * repetido em cada perfil tornava impossível dizer, de relance, onde acaba um
 * projeto e começa o seguinte.
 */
function LinhasDoProjeto({ projeto, anos }: { projeto: ProjetoVistaGeral; anos: number[] }) {
  const nLinhas = projeto.entradas.length + projeto.internos.length;
  if (nLinhas === 0) return null;

  const semValor = anos.map((ano) => (
    <td key={ano} className="numerico">
      <span className="meta">—</span>
    </td>
  ));

  const linhas = [
    ...projeto.entradas.map((entrada) => ({
      chave: entrada.id,
      celulas: (
        <>
          <td className="numerico">{entrada.lote}</td>
          <td>{entrada.perfil}</td>
          <td className="numerico">{entrada.pessoas}</td>
          <td className="numerico">{formatarMoeda(entrada.valorHoraComIva)}</td>
          {anos.map((ano) => {
            const valor = valorDaEntradaNoAno(projeto, entrada, ano);
            return (
              <td key={ano} className="numerico">
                {valor === null ? <span className="meta">—</span> : formatarMoeda(valor)}
              </td>
            );
          })}
        </>
      ),
    })),
    ...projeto.internos.map((interno) => ({
      chave: interno.id,
      celulas: (
        <>
          <td className="numerico">
            <span className="meta">—</span>
          </td>
          <td>
            <span className="etiqueta-interno">Interno</span> {interno.nome}
          </td>
          <td className="numerico">1</td>
          <td className="numerico">
            <span className="meta">—</span>
          </td>
          {semValor}
        </>
      ),
    })),
  ];

  return (
    <>
      {linhas.map((linha, i) => (
        <tr key={linha.chave}>
          {i === 0 && (
            <th scope="rowgroup" rowSpan={linhas.length} className="celula-projeto">
              <div className="projeto-nome">
                <strong>{projeto.nome}</strong>
              </div>
              <p className="meta">A partir de {projeto.anoInicio}</p>
            </th>
          )}
          {linha.celulas}
        </tr>
      ))}
    </>
  );
}
