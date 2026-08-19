import type { LotesJSON } from "../core/types";
import {
  formatarMoeda,
  formatarNumero,
  linhasTabelaValores,
  taxaIva,
  totalLote,
  totalProcedimento,
} from "../core/lotes";

interface Props {
  config: LotesJSON;
}

export function TabelaValores({ config }: Props) {
  const linhas = linhasTabelaValores(config);
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
