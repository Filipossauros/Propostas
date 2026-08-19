import type { LotesJSON } from "../core/types";
import { formatarMoeda, formatarNumero, linhasTabelaValores, totalProcedimento } from "../core/lotes";

interface Props {
  config: LotesJSON;
}

export function TabelaValores({ config }: Props) {
  const linhas = linhasTabelaValores(config);

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
              Preço/hora
            </th>
            <th scope="col" className="numerico">
              Preço base
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
              <td className="numerico">{formatarMoeda(l.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Preço base total do procedimento
            </th>
            <td className="numerico">
              <strong>{formatarMoeda(totalProcedimento(config))}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
