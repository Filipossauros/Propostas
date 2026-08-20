import { useMemo, useState } from "react";
import type { ResultadoConcorrenteLote, ResultadoLote, ResultadoProcedimento } from "../core/avaliacaoProcedimento";
import { requisitosFalhados } from "../core/avaliacaoProcedimento";
import { anosDeMeses } from "../core/types";
import { DicaApuramento } from "./DicaApuramento";

interface Props {
  resultado: ResultadoProcedimento;
}

const TODOS = "__todos__";

/** Situação do concorrente no lote: admitido ou não, e nada mais. */
function situacao(c: ResultadoConcorrenteLote): { texto: string; classe: string } {
  return c.admitido
    ? { texto: "Admitido", classe: "estado-cumpre" }
    : { texto: "Não admitido", classe: "estado-falha" };
}

/**
 * Impedimento potencial: os outros lotes em que o mesmo concorrente também é
 * admitido. Não é exclusão — qual dos lotes lhe fica decide-se pelo preço.
 */
function textoImpedimento(c: ResultadoConcorrenteLote): string {
  if (c.potencialImpedimento.length === 0) return "—";
  const lotes = c.potencialImpedimento.join(", ");
  const onde = c.potencialImpedimento.length === 1 ? `no lote ${lotes}` : `nos lotes ${lotes}`;
  return `Também admitido ${onde}: só pode ficar com um`;
}

/** Um par (lote, concorrente) que passou o filtro. */
interface Par {
  lote: ResultadoLote;
  c: ResultadoConcorrenteLote;
}

export function ResultadosTabelas({ resultado }: Props) {
  const [loteEscolhido, setLoteEscolhido] = useState(TODOS);
  const [concorrenteEscolhido, setConcorrenteEscolhido] = useState(TODOS);

  const concorrentes = useMemo(() => {
    const nomes = new Set<string>();
    for (const lote of resultado.lotes) for (const c of lote.concorrentes) nomes.add(c.concorrente);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [resultado]);

  // O filtro é um só, ao nível dos resultados, e vale para todas as tabelas:
  // uma tabela filtrada ao lado de outra por filtrar leria como contradição.
  const lotesVisiveis = resultado.lotes.filter((l) => loteEscolhido === TODOS || l.loteId === loteEscolhido);
  const pares: Par[] = lotesVisiveis.flatMap((lote) =>
    lote.concorrentes
      .filter((c) => concorrenteEscolhido === TODOS || c.concorrente === concorrenteEscolhido)
      .map((c) => ({ lote, c })),
  );

  const falhas = pares.flatMap(({ lote, c }) =>
    c.perfis.flatMap((p) =>
      p.elementos
        .filter((e) => !e.apuramento.cumpre)
        .map((e) => ({ lote, c, p, e, falhados: requisitosFalhados(e.apuramento, p.requisitos) })),
    ),
  );

  const aFiltrar = loteEscolhido !== TODOS || concorrenteEscolhido !== TODOS;

  return (
    <div className="resultados">
      <div className="filtro-resultados">
        <label>
          <span className="rotulo">Lote</span>
          <select value={loteEscolhido} onChange={(e) => setLoteEscolhido(e.target.value)}>
            <option value={TODOS}>Todos os lotes</option>
            {resultado.lotes.map((lote) => (
              <option key={lote.loteId} value={lote.loteId}>
                {lote.numero} · {lote.designacao}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="rotulo">Concorrente</span>
          <select value={concorrenteEscolhido} onChange={(e) => setConcorrenteEscolhido(e.target.value)}>
            <option value={TODOS}>Todos os concorrentes</option>
            {concorrentes.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </label>

        {aFiltrar && (
          <button
            type="button"
            className="botao-discreto"
            onClick={() => {
              setLoteEscolhido(TODOS);
              setConcorrenteEscolhido(TODOS);
            }}
          >
            Limpar filtro
          </button>
        )}
      </div>

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
                <th>Impedimento potencial</th>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {lotesVisiveis.flatMap((lote) => {
                const doLote = pares.filter((p) => p.lote.loteId === lote.loteId);
                if (doLote.length === 0) {
                  return [
                    <tr key={lote.loteId}>
                      <td>
                        {lote.numero} · {lote.designacao}
                      </td>
                      <td colSpan={5} className="meta">
                        Sem propostas
                      </td>
                    </tr>,
                  ];
                }
                return doLote.map(({ c }) => {
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
                      <td className={c.potencialImpedimento.length > 0 ? "estado-impedido" : undefined}>
                        {textoImpedimento(c)}
                      </td>
                      <td>{c.nAlertas}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {resultado.umLotePorConcorrente && (
          <p className="ajuda">
            A limitação de um lote por concorrente está ativa. Esta ferramenta verifica apenas o cumprimento dos
            requisitos mínimos: a adjudicação decide-se pelo preço, que não consta do formulário de declaração de
            experiência. Por isso quem é admitido em mais do que um lote fica aqui assinalado como impedimento
            potencial — só poderá ficar com um deles, e é a ordenação por preço, no Módulo 4, que determina qual.
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

      <section>
        <h4>Por perfil</h4>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Concorrente</th>
                <th>Perfil</th>
                <th>Elementos</th>
                <th>Mínimo</th>
                <th>Cumpre</th>
              </tr>
            </thead>
            <tbody>
              {pares.flatMap(({ lote, c }) =>
                c.perfis.map((p) => (
                  <tr key={`${lote.loteId}-${c.concorrente}-${p.perfilEmLoteId}`}>
                    <td>{lote.numero}</td>
                    <td>{c.concorrente}</td>
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
        <p className="ajuda">
          Passe o rato pelos meses apurados — ou alcance-os pelo teclado — para ver a conta: que períodos entraram,
          de que bloco vieram e o que ficou de fora.
        </p>
        <div className="tabela-envolvente">
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Concorrente</th>
                <th>Perfil</th>
                <th>Elemento</th>
                <th>Requisito</th>
                <th>Apurado</th>
                <th>Mínimo</th>
                <th>Cumpre</th>
              </tr>
            </thead>
            <tbody>
              {pares.flatMap(({ lote, c }) =>
                c.perfis.flatMap((p) => {
                  const porId = new Map(p.requisitos.map((r) => [r.id, r.designacao]));
                  return p.elementos.flatMap((e) =>
                    e.apuramento.requisitos.map((r) => (
                      <tr key={`${e.declaracao.id}-${r.requisitoId}`}>
                        <td>{lote.numero}</td>
                        <td>{c.concorrente}</td>
                        <td>{p.perfil}</td>
                        <td>{e.declaracao.identificacao.nome || "(sem nome)"}</td>
                        <td>{porId.get(r.requisitoId) ?? r.requisitoId}</td>
                        <td>
                          <DicaApuramento apuramento={r} />
                        </td>
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
    </div>
  );
}
