import { useState } from "react";
import type { Ordenacao, PropostaOrdenada } from "../core/ordenacao";
import { formatarPreco } from "../core/ordenacao";

interface Props {
  ordenacao: Ordenacao;
}

/** A situação de uma proposta na ordenação do seu lote. */
function situacao(p: PropostaOrdenada): { texto: string; classe: string } {
  if (p.impedidaPeloLote !== null) {
    return { texto: `Impedida — venceu o lote ${p.impedidaPeloLote}`, classe: "estado-impedido" };
  }
  if (p.preco === null) return { texto: "Sem preço indicado", classe: "estado-impedido" };
  return p.vencedora
    ? { texto: "Vencedora", classe: "estado-cumpre" }
    : { texto: "Ordenada", classe: "" };
}

export function TabelaOrdenacao({ ordenacao }: Props) {
  const [soVencedores, setSoVencedores] = useState(false);

  const empates = ordenacao.lotes.some((l) => l.propostas.some((p) => p.empatada));

  return (
    <div>
      <label className="campo-opcao">
        <input type="checkbox" checked={soVencedores} onChange={(e) => setSoVencedores(e.target.checked)} />
        <span>
          <strong>Ver apenas os vencedores de cada lote</strong>
          <span className="ajuda">Esconde os segundos e demais classificados, deixando só a decisão.</span>
        </span>
      </label>

      <div className="tabela-envolvente">
        <table className="tabela">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Posição</th>
              <th>Concorrente</th>
              <th>Preço (s/ IVA)</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {ordenacao.lotes.flatMap((lote) => {
              const visiveis = soVencedores ? lote.propostas.filter((p) => p.vencedora) : lote.propostas;

              if (visiveis.length === 0) {
                return [
                  <tr key={lote.loteId}>
                    <td>
                      {lote.numero} · {lote.designacao}
                    </td>
                    <td colSpan={4} className="meta">
                      {soVencedores ? "Sem proposta vencedora" : "Sem propostas admitidas"}
                    </td>
                  </tr>,
                ];
              }

              return visiveis.map((p) => {
                const s = situacao(p);
                return (
                  <tr key={`${lote.loteId}-${p.concorrente}`}>
                    <td>
                      {lote.numero} · {lote.designacao}
                    </td>
                    <td className="numerico">{p.posicao ?? "—"}</td>
                    <td>
                      {p.concorrente}
                      {p.empatada && <span className="meta"> · preço empatado</span>}
                    </td>
                    <td className="numerico">{formatarPreco(p.preco)}</td>
                    <td className={s.classe}>{s.texto}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {empates && (
        <p className="ajuda">
          Há propostas com o mesmo preço. A ordem entre elas é a alfabética, que não é critério de desempate:
          o desempate é decisão do júri, nos termos das peças do procedimento.
        </p>
      )}
    </div>
  );
}
