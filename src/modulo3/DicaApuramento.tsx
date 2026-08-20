import { useId } from "react";
import type { ApuramentoRequisito } from "../core/regraA";

interface Props {
  apuramento: ApuramentoRequisito;
}

function mesAno(data: { mes: number; ano: number }): string {
  return `${String(data.mes).padStart(2, "0")}/${data.ano}`;
}

/**
 * Como é que se chegou a este número de meses.
 *
 * Mostra a conta por inteiro: cada período que entrou, quantos meses vale e de
 * onde veio, e cada período que ficou de fora com o respetivo motivo. Quando a
 * soma dos períodos excede o apurado, é porque houve meses sobrepostos — que a
 * Regra A conta uma só vez — e a dica di-lo, em vez de deixar o leitor a
 * suspeitar de um erro de cálculo.
 */
export function DicaApuramento({ apuramento }: Props) {
  const id = useId();
  const { periodosAdmitidos, periodosDescartados, mesesApurados } = apuramento;

  const parcelas = periodosAdmitidos.map((p) => ({
    periodo: `${mesAno(p.inicio)} – ${mesAno(p.fim)}`,
    meses: p.fimInt - p.inicioInt + 1,
    bloco: p.blocoIndice,
    origem: p.origem === "linha" ? "datas da linha" : "período do projeto",
  }));
  const soma = parcelas.reduce((total, p) => total + p.meses, 0);

  return (
    <span className="dica">
      <button type="button" className="dica-alvo" aria-describedby={id}>
        {mesesApurados} meses
      </button>

      <span role="tooltip" id={id} className="dica-conteudo dica-apuramento">
        {parcelas.length === 0 ? (
          <span className="dica-vazia">Nenhum período entrou na contagem.</span>
        ) : (
          <>
            <ul>
              {parcelas.map((p, idx) => (
                <li key={`${p.periodo}-${idx}`}>
                  <span className="dica-designacao">
                    {p.periodo} <span className="meta">· bloco {p.bloco}, {p.origem}</span>
                  </span>
                  <span className="dica-exigencia">{p.meses} meses</span>
                </li>
              ))}
            </ul>

            <span className="dica-total">
              <strong>Total apurado</strong>
              {mesesApurados} meses
              {soma !== mesesApurados && (
                <span className="meta">
                  {" "}
                  (a soma dá {soma}: há meses declarados em mais do que um projeto, e contam uma só vez)
                </span>
              )}
            </span>
          </>
        )}

        {periodosDescartados.length > 0 && (
          <span className="dica-descartados">
            <strong>Fora da contagem</strong>
            {periodosDescartados.map((d, idx) => (
              <span key={`${d.blocoIndice}-${idx}`}>
                Bloco {d.blocoIndice}: {d.motivo}
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
