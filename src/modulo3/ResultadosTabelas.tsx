import { useState } from "react";
import type { ConfiguracaoAvaliacao } from "../core/types";
import type { ResultadoConcorrente } from "../core/agregacao";
import { requisitosFalhados } from "../core/agregacao";

interface Props {
  resultados: ResultadoConcorrente[];
  config: ConfiguracaoAvaliacao;
}

type Vista = "agregada" | "elemento" | "detalhada";

const VISTAS: Array<{ chave: Vista; etiqueta: string }> = [
  { chave: "agregada", etiqueta: "Por concorrente" },
  { chave: "elemento", etiqueta: "Por elemento" },
  { chave: "detalhada", etiqueta: "Detalhe por requisito" },
];

function Veredicto({ cumpre }: { cumpre: boolean }) {
  return (
    <span className={cumpre ? "selo selo-cumpre" : "selo selo-nao-cumpre"}>
      {cumpre ? "Cumpre" : "Não cumpre"}
    </span>
  );
}

export function ResultadosTabelas({ resultados, config }: Props) {
  const [vista, setVista] = useState<Vista>("agregada");
  const designacaoPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
  const totalAlertas = resultados.reduce((n, r) => n + r.nAlertas, 0);

  return (
    <div>
      <div className="seletor-vista" role="tablist">
        {VISTAS.map((v) => (
          <button
            key={v.chave}
            type="button"
            role="tab"
            aria-selected={vista === v.chave}
            className={vista === v.chave ? "aba-ativa" : ""}
            onClick={() => setVista(v.chave)}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <div className="tabela-envolvente">
        {vista === "agregada" && (
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Concorrente</th>
                <th scope="col" className="numerico">
                  Elementos
                </th>
                <th scope="col">Veredicto</th>
                <th scope="col" className="numerico">
                  Alertas
                </th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.concorrente}>
                  <td>{r.concorrente}</td>
                  <td className="numerico">
                    {r.nElementos}
                    {!r.nElementosSuficiente && (
                      <span className="meta"> mínimo {config.nMinimoElementos}</span>
                    )}
                  </td>
                  <td>
                    <Veredicto cumpre={r.cumpre} />
                    {!r.nElementosSuficiente && (
                      <span className="meta"> elementos insuficientes</span>
                    )}
                  </td>
                  <td className="numerico">{r.nAlertas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {vista === "elemento" && (
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Concorrente</th>
                <th scope="col">Veredicto</th>
                <th scope="col">Requisitos falhados</th>
              </tr>
            </thead>
            <tbody>
              {resultados.flatMap((r) =>
                r.elementos.map((e) => (
                  <tr key={e.declaracao.id}>
                    <td>{e.declaracao.identificacao.nome || "(sem nome)"}</td>
                    <td>{e.concorrente}</td>
                    <td>
                      <Veredicto cumpre={e.apuramento.cumpre} />
                    </td>
                    <td>{requisitosFalhados(e.apuramento, config).join(", ") || "—"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}

        {vista === "detalhada" && (
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Elemento</th>
                <th scope="col">Requisito</th>
                <th scope="col" className="numerico">
                  Apurado
                </th>
                <th scope="col" className="numerico">
                  Mínimo
                </th>
                <th scope="col">Veredicto</th>
              </tr>
            </thead>
            <tbody>
              {resultados.flatMap((r) =>
                r.elementos.flatMap((e) =>
                  e.apuramento.requisitos.map((req) => (
                    <tr key={`${e.declaracao.id}-${req.requisitoId}`}>
                      <td>{e.declaracao.identificacao.nome || "(sem nome)"}</td>
                      <td>{designacaoPorId.get(req.requisitoId) ?? req.requisitoId}</td>
                      <td className="numerico">{req.mesesApurados} m</td>
                      <td className="numerico">{req.mesesMinimos} m</td>
                      <td>
                        <Veredicto cumpre={req.cumpre} />
                      </td>
                    </tr>
                  )),
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalAlertas > 0 && (
        <details className="painel-alertas">
          <summary>Alertas ({totalAlertas})</summary>
          <ul>
            {resultados.flatMap((r) =>
              r.elementos.flatMap((e) =>
                e.alertas.map((a, i) => (
                  <li key={`${e.declaracao.id}-${i}`}>
                    <strong>{e.declaracao.ficheiro}</strong>: {a.mensagem}
                  </li>
                )),
              ),
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
