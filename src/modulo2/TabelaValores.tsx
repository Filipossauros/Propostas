import type { LotesJSON } from "../core/types";
import {
  anosPlurianuais,
  formatarMoeda,
  formatarNumero,
  linhasPlurianuais,
  linhasTabelaValores,
  totaisPorAnoDoLote,
  totaisPorAnoPlurianual,
  taxaIva,
  totalLote,
  totalProcedimento,
} from "../core/lotes";

interface Props {
  config: LotesJSON;
}

/**
 * O resumo com o pedido de encargos plurianuais: o que fica a pagar-se em cada
 * ano económico, e as horas de que resulta.
 *
 * É só de leitura, como todo o resumo. As horas escrevem-se nos lotes e o ano
 * de início nos parâmetros do procedimento; aqui vê-se o efeito das duas coisas
 * juntas, que é o que o pedido leva.
 */
function TabelaPlurianual({ config }: Props) {
  const anos = anosPlurianuais(config.encargosPlurianuais.anoInicio);
  const linhas = linhasPlurianuais(config);
  const totais = totaisPorAnoPlurianual(config);
  const total = totalProcedimento(config);

  return (
    <div className="tabela-envolvente">
      <table className="tabela">
        <caption className="tabela-legenda">
          Encargos a assumir por ano económico, com IVA incluído, e horas de que resultam.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="numerico">
              Pessoas
            </th>
            <th scope="col">Perfil</th>
            <th scope="col" className="numerico">
              Rate (€/h) <span className="cabecalho-nota">s/ IVA</span>
            </th>
            <th scope="col" className="numerico">
              Rate (€/h) <span className="cabecalho-nota">c/ IVA</span>
            </th>
            <th scope="col" className="numerico">
              Lotes
            </th>
            {anos.map((ano) => (
              <th key={ano} scope="col" className="numerico">
                Total € c/ IVA <span className="cabecalho-nota">{ano}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.perfilEmLoteId}>
              <td className="numerico">{l.pessoas}</td>
              <td>{l.perfil}</td>
              <td className="numerico">{formatarMoeda(l.valorHoraSemIva)}</td>
              <td className="numerico">{formatarMoeda(l.valorHoraComIva)}</td>
              <td className="numerico">{l.lote}</td>
              {anos.map((ano, i) => (
                <td key={ano} className="numerico">
                  {formatarMoeda(l.totais[i])}
                  <span className="meta"> {formatarNumero(l.horas[i])} h</span>
                </td>
              ))}
            </tr>
          ))}

          {/* Com um lote só, o subtotal seria o total repetido uma linha acima. */}
          {config.lotes.length > 1 &&
            config.lotes.map((lote) => {
              const subtotal = totaisPorAnoDoLote(config, lote.id);
              return (
                <tr key={`subtotal-${lote.id}`} className="linha-subtotal">
                  <th scope="row" colSpan={5}>
                    Subtotal do lote {lote.numero}
                  </th>
                  {subtotal.map((total, i) => (
                    <td key={anos[i]} className="numerico">
                      {formatarMoeda(total)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Total a assumir
            </th>
            {totais.map((total, i) => (
              <td key={anos[i]} className="numerico">
                <strong>{formatarMoeda(total)}</strong>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      {/* O preço base do procedimento é elemento da peça, e a tabela dos anos
          exprime-se toda com IVA: fica aqui, para não desaparecer com ela. */}
      <p className="ajuda">
        Preço base total do procedimento: <strong>{formatarMoeda(total.semIva)}</strong> sem IVA,{" "}
        <strong>{formatarMoeda(total.comIva)}</strong> com IVA.
      </p>
    </div>
  );
}

export function TabelaValores({ config }: Props) {
  const linhas = linhasTabelaValores(config);

  // Ou uma, ou outra: as duas tabelas dizem o mesmo preço base por caminhos
  // diferentes, e apresentá-las juntas obrigava a lê-las uma contra a outra.
  if (config.encargosPlurianuais.ativo && linhas.length > 0) {
    return <TabelaPlurianual config={config} />;
  }
  const taxa = taxaIva(config);
  const total = totalProcedimento(config);

  if (linhas.length === 0) {
    return <p className="estado-vazio">Atribua perfis aos lotes para ver a tabela.</p>;
  }

  return (
    <div className="tabela-envolvente">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Lote</th>
            <th scope="col">Perfil</th>
            <th scope="col" className="numerico">
              N.º mín. elementos
            </th>
            <th scope="col" className="numerico">
              Horas
            </th>
            <th scope="col" className="numerico">
              Preço/hora <span className="cabecalho-nota">sem IVA</span>
            </th>
            <th scope="col" className="numerico">
              Preço base <span className="cabecalho-nota">sem IVA</span>
            </th>
            <th scope="col" className="numerico">
              IVA <span className="cabecalho-nota">{formatarNumero(taxa)}%</span>
            </th>
            <th scope="col" className="numerico">
              Preço base <span className="cabecalho-nota">com IVA</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.perfilEmLoteId}>
              <td>
                {l.lote}
                {l.loteDesignacao && <span className="meta"> {l.loteDesignacao}</span>}
              </td>
              <td>{l.perfil}</td>
              <td className="numerico">{l.nMinimoElementos}</td>
              <td className="numerico">{formatarNumero(l.horas)}</td>
              <td className="numerico">{formatarMoeda(l.valorHora)}</td>
              <td className="numerico">{formatarMoeda(l.valores.semIva)}</td>
              <td className="numerico">{formatarMoeda(l.valores.iva)}</td>
              <td className="numerico">{formatarMoeda(l.valores.comIva)}</td>
            </tr>
          ))}

          {config.lotes.length > 1 &&
            config.lotes.map((lote) => {
              const subtotal = totalLote(lote, taxa);
              return (
                <tr key={`subtotal-${lote.id}`} className="linha-subtotal">
                  <th scope="row" colSpan={5}>
                    Subtotal do lote {lote.numero}
                  </th>
                  <td className="numerico">{formatarMoeda(subtotal.semIva)}</td>
                  <td className="numerico">{formatarMoeda(subtotal.iva)}</td>
                  <td className="numerico">{formatarMoeda(subtotal.comIva)}</td>
                </tr>
              );
            })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Preço base total do procedimento
            </th>
            <td className="numerico">
              <strong>{formatarMoeda(total.semIva)}</strong>
            </td>
            <td className="numerico">{formatarMoeda(total.iva)}</td>
            <td className="numerico">
              <strong>{formatarMoeda(total.comIva)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
