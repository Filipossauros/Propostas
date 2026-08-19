import { useState } from "react";
import type { ConfiguracaoJSON } from "../core/types";
import type { ResultadoConcorrente } from "../core/agregacao";
import { requisitosFalhados } from "../core/agregacao";

interface Props {
  resultados: ResultadoConcorrente[];
  config: ConfiguracaoJSON;
}

type Vista = "agregada" | "elemento" | "detalhada";

export function ResultadosTabelas({ resultados, config }: Props) {
  const [vista, setVista] = useState<Vista>("agregada");
  const designacaoPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));

  return (
    <div>
      <div className="seletor-vista">
        <button type="button" onClick={() => setVista("agregada")} disabled={vista === "agregada"}>
          Vista agregada
        </button>
        <button type="button" onClick={() => setVista("elemento")} disabled={vista === "elemento"}>
          Vista por elemento
        </button>
        <button type="button" onClick={() => setVista("detalhada")} disabled={vista === "detalhada"}>
          Vista detalhada
        </button>
      </div>

      {vista === "agregada" && (
        <table className="tabela-resultados">
          <thead>
            <tr>
              <th>Concorrente</th>
              <th>N.º de elementos</th>
              <th>Cumpre</th>
              <th>N.º de alertas</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.concorrente}>
                <td>{r.concorrente}</td>
                <td>
                  {r.nElementos}
                  {!r.nElementosSuficiente && (
                    <span className="etiqueta-alerta"> (insuficiente, mínimo {config.nMinimoElementos})</span>
                  )}
                </td>
                <td className={r.cumpre ? "veredicto-cumpre" : "veredicto-nao-cumpre"}>
                  {r.cumpre ? "Cumpre" : "Não cumpre"}
                </td>
                <td>{r.nAlertas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {vista === "elemento" && (
        <table className="tabela-resultados">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Concorrente</th>
              <th>Cumpre</th>
              <th>Requisitos falhados</th>
            </tr>
          </thead>
          <tbody>
            {resultados.flatMap((r) =>
              r.elementos.map((e) => (
                <tr key={e.declaracao.ficheiro}>
                  <td>{e.declaracao.identificacao.nome}</td>
                  <td>{e.concorrente}</td>
                  <td className={e.apuramento.cumpre ? "veredicto-cumpre" : "veredicto-nao-cumpre"}>
                    {e.apuramento.cumpre ? "Cumpre" : "Não cumpre"}
                  </td>
                  <td>{requisitosFalhados(e.apuramento, config).join(", ")}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}

      {vista === "detalhada" && (
        <table className="tabela-resultados">
          <thead>
            <tr>
              <th>Elemento</th>
              <th>Requisito</th>
              <th>Meses apurados</th>
              <th>Mínimo</th>
              <th>Cumpre</th>
            </tr>
          </thead>
          <tbody>
            {resultados.flatMap((r) =>
              r.elementos.flatMap((e) =>
                e.apuramento.requisitos.map((req) => (
                  <tr key={`${e.declaracao.ficheiro}-${req.requisitoId}`}>
                    <td>{e.declaracao.identificacao.nome}</td>
                    <td>{designacaoPorId.get(req.requisitoId) ?? req.requisitoId}</td>
                    <td>{req.mesesApurados}</td>
                    <td>{req.mesesMinimos}</td>
                    <td className={req.cumpre ? "veredicto-cumpre" : "veredicto-nao-cumpre"}>
                      {req.cumpre ? "Cumpre" : "Não cumpre"}
                    </td>
                  </tr>
                )),
              ),
            )}
          </tbody>
        </table>
      )}

      {resultados.some((r) => r.nAlertas > 0) && (
        <details className="painel-alertas">
          <summary>Alertas por ficheiro ({resultados.reduce((n, r) => n + r.nAlertas, 0)})</summary>
          <ul>
            {resultados.flatMap((r) =>
              r.elementos.flatMap((e) =>
                e.alertas.map((a, i) => (
                  <li key={`${e.declaracao.ficheiro}-${i}`}>
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
