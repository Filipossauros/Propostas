import type { EncargosPlurianuais, LotesJSON } from "../core/types";
import { ANO_MAXIMO, ANO_MINIMO, ANOS_PLURIANUAIS } from "../core/types";
import {
  anosPlurianuais,
  comLinhaPlurianualAlterada,
  formatarMoeda,
  linhasPlurianuais,
  totaisPorAnoPlurianual,
} from "../core/lotes";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  config: LotesJSON;
  onAlterar: (encargos: EncargosPlurianuais) => void;
}

/**
 * O pedido de autorização para assumir encargos em anos económicos futuros.
 *
 * As três primeiras colunas não se editam: quem é o perfil, a que lote pertence
 * e quantas pessoas leva é o que ficou decidido no agrupamento, e escrevê-lo
 * outra vez aqui seria abrir a porta a dizer duas coisas diferentes. O que se
 * edita são os preços e os totais de cada ano, que é o que o impresso pergunta.
 */
export function EncargosPlurianuaisEditor({ config, onAlterar }: Props) {
  const encargos = config.encargosPlurianuais;
  const anos = anosPlurianuais(encargos.anoInicio);
  const linhas = linhasPlurianuais(config);
  const totais = totaisPorAnoPlurianual(config);
  const ultimoAno = ANO_MAXIMO - ANOS_PLURIANUAIS;
  const anoValido = Number.isInteger(encargos.anoInicio) && encargos.anoInicio >= ANO_MINIMO && encargos.anoInicio <= ultimoAno;

  return (
    <>
      <label className="campo-estreito">
        <span className="rotulo">Ano de início do contrato</span>
        <CampoNumero
          valor={encargos.anoInicio}
          min={ANO_MINIMO}
          step={1}
          invalido={!anoValido}
          aria-label="Ano de início do contrato"
          onChange={(anoInicio) => onAlterar({ ...encargos, anoInicio })}
        />
      </label>
      <p className="ajuda">
        Os encargos pedidos são os dos {ANOS_PLURIANUAIS} anos económicos seguintes — {anos.join(", ")}. A despesa
        do ano de início cabe no orçamento em vigor e não carece desta autorização.
      </p>

      {linhas.length === 0 ? (
        <p className="estado-vazio">Atribua perfis aos lotes para haver encargos a pedir.</p>
      ) : (
        <div className="tabela-larga">
          <table className="tabela-plurianual">
            <thead>
              <tr>
                <th className="numerico">Pessoas</th>
                <th>Perfil</th>
                <th className="numerico">Rate (€/h) s/ IVA</th>
                <th className="numerico">Rate (€/h) c/ IVA</th>
                <th className="numerico">Lotes</th>
                {anos.map((ano) => (
                  <th key={ano} className="numerico">
                    Total € c/ IVA {ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.perfilEmLoteId}>
                  <td className="numerico">{linha.pessoas}</td>
                  <td>{linha.perfil}</td>
                  <td>
                    <CampoNumero
                      valor={linha.valorHoraSemIva}
                      min={0}
                      step={0.01}
                      sufixo="€"
                      invalido={!(linha.valorHoraSemIva >= 0)}
                      aria-label={`Rate sem IVA de ${linha.perfil}, lote ${linha.lote}`}
                      onChange={(valorHoraSemIva) =>
                        onAlterar(comLinhaPlurianualAlterada(encargos, linha, { valorHoraSemIva }))
                      }
                    />
                  </td>
                  <td>
                    <CampoNumero
                      valor={linha.valorHoraComIva}
                      min={0}
                      step={0.01}
                      sufixo="€"
                      invalido={!(linha.valorHoraComIva >= 0)}
                      aria-label={`Rate com IVA de ${linha.perfil}, lote ${linha.lote}`}
                      onChange={(valorHoraComIva) =>
                        onAlterar(comLinhaPlurianualAlterada(encargos, linha, { valorHoraComIva }))
                      }
                    />
                  </td>
                  <td className="numerico">{linha.lote}</td>
                  {anos.map((ano, i) => (
                    <td key={ano}>
                      <CampoNumero
                        valor={linha.totais[i]}
                        min={0}
                        step={0.01}
                        sufixo="€"
                        invalido={!(linha.totais[i] >= 0)}
                        aria-label={`Total de ${ano} para ${linha.perfil}, lote ${linha.lote}`}
                        onChange={(valor) =>
                          onAlterar(
                            comLinhaPlurianualAlterada(encargos, linha, {
                              totais: linha.totais.map((atual, j) => (j === i ? valor : atual)),
                            }),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total a assumir</td>
                {totais.map((total, i) => (
                  <td key={anos[i]} className="numerico">
                    {formatarMoeda(total)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
