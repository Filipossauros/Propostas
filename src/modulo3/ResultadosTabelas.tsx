import { useMemo, useState } from "react";
import type { ResultadoConcorrenteLote, ResultadoProcedimento } from "../core/avaliacaoProcedimento";
import { requisitosFalhados } from "../core/avaliacaoProcedimento";
import { anosDeMeses } from "../core/types";

interface Props {
  resultado: ResultadoProcedimento;
}

/** Situação final no lote, já com a limitação de um lote por concorrente aplicada. */
function situacao(c: ResultadoConcorrenteLote): { texto: string; classe: string } {
  if (c.impedidoPeloLote !== null) {
    return { texto: `Impedido — já ficou com o lote ${c.impedidoPeloLote}`, classe: "estado-impedido" };
  }
  return c.cumpreRequisitos
    ? { texto: "Cumpre", classe: "estado-cumpre" }
    : { texto: "Não cumpre", classe: "estado-falha" };
}

/** Todos os concorrentes do procedimento, por ordem alfabética e sem repetições. */
function concorrentesDoProcedimento(resultado: ResultadoProcedimento): string[] {
  const nomes = new Set<string>();
  for (const lote of resultado.lotes) for (const c of lote.concorrentes) nomes.add(c.concorrente);
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
}

export function ResultadosTabelas({ resultado }: Props) {
  const concorrentes = useMemo(() => concorrentesDoProcedimento(resultado), [resultado]);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  // O detalhe é sempre de um concorrente só: com quatro perfis e vários
  // elementos cada, a lista de todos junta centenas de linhas onde ninguém
  // encontra a proposta que está a apreciar. Se o escolhido desaparecer — por
  // uma alteração na reconciliação —, cai no primeiro da lista.
  const emDetalhe = escolhido !== null && concorrentes.includes(escolhido) ? escolhido : concorrentes[0] ?? null;

  /** Os lotes a que este concorrente se apresentou, com o respetivo apuramento. */
  const lotesDoConcorrente = resultado.lotes
    .map((lote) => ({ lote, c: lote.concorrentes.find((x) => x.concorrente === emDetalhe) }))
    .filter((x): x is { lote: (typeof resultado.lotes)[number]; c: ResultadoConcorrenteLote } => x.c !== undefined);

  const falhas = resultado.lotes.flatMap((lote) =>
    lote.concorrentes.flatMap((c) =>
      c.perfis.flatMap((p) =>
        p.elementos
          .filter((e) => !e.apuramento.cumpre)
          .map((e) => ({ lote, c, p, e, falhados: requisitosFalhados(e.apuramento, p.requisitos) })),
      ),
    ),
  );

  return (
    <div className="resultados">
      <section>
        <h4>Resultado por lote</h4>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Concorrente</th>
                <th>Requisitos</th>
                <th>Situação</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {resultado.lotes.flatMap((lote) =>
                lote.concorrentes.length === 0
                  ? [
                      <tr key={lote.loteId}>
                        <td>
                          {lote.numero} · {lote.designacao}
                        </td>
                        <td colSpan={4} className="meta">
                          Sem propostas
                        </td>
                      </tr>,
                    ]
                  : lote.concorrentes.map((c) => {
                      const s = situacao(c);
                      return (
                        <tr key={`${lote.loteId}-${c.concorrente}`}>
                          <td>
                            {lote.numero} · {lote.designacao}
                          </td>
                          <td>{c.concorrente}</td>
                          <td className={c.cumpreRequisitos ? "estado-cumpre" : "estado-falha"}>
                            {c.cumpreRequisitos ? "Cumpre" : "Não cumpre"}
                          </td>
                          <td className={s.classe}>{s.texto}</td>
                          <td>{c.nAlertas}</td>
                        </tr>
                      );
                    }),
              )}
            </tbody>
          </table>
        </div>
        {resultado.umLotePorConcorrente && (
          <p className="ajuda">
            A limitação de um lote por concorrente está ativa: os lotes são apreciados por ordem do número, e quem já
            ficou com um fica impedido nos seguintes.
          </p>
        )}
      </section>

      <section>
        <h4>Elementos que não cumprem</h4>
        {falhas.length === 0 ? (
          <p className="estado-vazio">Todos os elementos apresentados cumprem os requisitos.</p>
        ) : (
          <ul className="lista-erros">
            {falhas.map(({ lote, c, p, e, falhados }) => (
              <li key={e.declaracao.id}>
                Lote {lote.numero} · {c.concorrente} · {p.perfil} ·{" "}
                <strong>{e.declaracao.identificacao.nome || "(sem nome)"}</strong>: {falhados.join("; ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      {emDetalhe === null ? null : (
        <>
          <div className="seletor-concorrente">
            <label>
              <span className="rotulo">Concorrente em detalhe</span>
              <select value={emDetalhe} onChange={(e) => setEscolhido(e.target.value)}>
                {concorrentes.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <p className="ajuda">As duas tabelas seguintes mostram apenas a proposta deste concorrente.</p>
          </div>

          <section>
            <h4>Por perfil</h4>
            <div className="tabela-envolvente">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Perfil</th>
                    <th>Elementos</th>
                    <th>Mínimo</th>
                    <th>Cumpre</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesDoConcorrente.flatMap(({ lote, c }) =>
                    c.perfis.map((p) => (
                      <tr key={`${lote.loteId}-${p.perfilEmLoteId}`}>
                        <td>{lote.numero}</td>
                        <td>{p.perfil}</td>
                        <td className={p.nElementosSuficiente ? undefined : "estado-falha"}>{p.nElementos}</td>
                        <td>{p.nMinimoElementos}</td>
                        <td className={p.cumpre ? "estado-cumpre" : "estado-falha"}>{p.cumpre ? "Sim" : "Não"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h4>Por requisito, elemento a elemento</h4>
            <div className="tabela-envolvente">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Perfil</th>
                    <th>Elemento</th>
                    <th>Requisito</th>
                    <th>Apurado</th>
                    <th>Mínimo</th>
                    <th>Cumpre</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesDoConcorrente.flatMap(({ lote, c }) =>
                    c.perfis.flatMap((p) => {
                      const porId = new Map(p.requisitos.map((r) => [r.id, r.designacao]));
                      return p.elementos.flatMap((e) =>
                        e.apuramento.requisitos.map((r) => (
                          <tr key={`${e.declaracao.id}-${r.requisitoId}`}>
                            <td>{lote.numero}</td>
                            <td>{p.perfil}</td>
                            <td>{e.declaracao.identificacao.nome || "(sem nome)"}</td>
                            <td>{porId.get(r.requisitoId) ?? r.requisitoId}</td>
                            <td>{r.mesesApurados} meses</td>
                            <td>
                              {r.mesesMinimos} meses ({anosDeMeses(r.mesesMinimos)} anos)
                            </td>
                            <td className={r.cumpre ? "estado-cumpre" : "estado-falha"}>{r.cumpre ? "Sim" : "Não"}</td>
                          </tr>
                        )),
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
