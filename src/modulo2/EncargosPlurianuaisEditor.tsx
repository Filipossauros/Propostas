import type { EncargosPlurianuais, LotesJSON } from "../core/types";
import { ANO_MAXIMO, ANO_MINIMO, ANOS_PLURIANUAIS } from "../core/types";
import {
  anosPlurianuais,
  comHorasPlurianuaisAlteradas,
  formatarMoeda,
  formatarNumero,
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
 * Só se reparte: as horas de cada perfil distribuem-se pelos anos do contrato,
 * e é dessa repartição que sai o valor de cada ano. Tudo o resto — quem é o
 * perfil, a que lote pertence, quantas pessoas leva, quanto custa a hora — está
 * decidido no agrupamento e aqui só se mostra. Escrevê-lo outra vez seria abrir
 * a porta a dizer duas coisas diferentes na mesma peça.
 */
export function EncargosPlurianuaisEditor({ config, onAlterar }: Props) {
  const encargos = config.encargosPlurianuais;
  const anos = anosPlurianuais(encargos.anoInicio);
  const linhas = linhasPlurianuais(config);
  const totais = totaisPorAnoPlurianual(config);
  const ultimoAno = ANO_MAXIMO - ANOS_PLURIANUAIS + 1;
  const anoValido =
    Number.isInteger(encargos.anoInicio) && encargos.anoInicio >= ANO_MINIMO && encargos.anoInicio <= ultimoAno;

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
        Os encargos pedidos respeitam ao ano económico do início dos contratos mais os 2 anos económicos seguintes.
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
                <th className="numerico">Horas do lote</th>
                {anos.map((ano) => (
                  <th key={ano} className="numerico">
                    Total € c/ IVA {ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => {
                const repartidas = linha.horas.reduce((soma, h) => soma + h, 0);
                const porRepartir = linha.horasContratadas - repartidas;

                return (
                  <tr key={linha.perfilEmLoteId}>
                    <td className="numerico">{linha.pessoas}</td>
                    <td>{linha.perfil}</td>
                    <td className="numerico">{formatarMoeda(linha.valorHoraSemIva)}</td>
                    <td className="numerico">{formatarMoeda(linha.valorHoraComIva)}</td>
                    <td className="numerico">{linha.lote}</td>
                    <td className="numerico">
                      {formatarNumero(linha.horasContratadas)} h
                      {porRepartir !== 0 && (
                        <span className="aviso-inline">
                          {porRepartir > 0
                            ? `faltam repartir ${formatarNumero(porRepartir)} h`
                            : `repartiu ${formatarNumero(-porRepartir)} h a mais`}
                        </span>
                      )}
                    </td>
                    {anos.map((ano, i) => (
                      <td key={ano} className="celula-ano">
                        <CampoNumero
                          valor={linha.horas[i]}
                          min={0}
                          step={1}
                          sufixo="h"
                          invalido={!(linha.horas[i] >= 0)}
                          aria-label={`Horas de ${ano} para ${linha.perfil}, lote ${linha.lote}`}
                          onChange={(horas) =>
                            onAlterar(
                              comHorasPlurianuaisAlteradas(
                                encargos,
                                linha.perfilEmLoteId,
                                linha.horas.map((atual, j) => (j === i ? horas : atual)),
                              ),
                            )
                          }
                        />
                        <span className="valor-do-ano">{formatarMoeda(linha.totais[i])}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total a assumir</td>
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

      {/* A explicação de fundo vive na dica junto ao título do painel: aqui só
          o que é preciso saber para escrever o número certo. */}
      <p className="ajuda">
        Escreva as horas de cada ano; o valor por baixo é o que delas resulta —{" "}
        <strong>pessoas × horas do ano × preço/hora com IVA</strong>. As rates e os totais não se escrevem aqui: vêm
        do lote, e é lá que se alteram.
      </p>
    </>
  );
}
