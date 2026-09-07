import { formatarMoeda } from "../core/lotes";
import { rateVariavel, ratesPorPerfil, type PerfilComRates, type VistaDirecao } from "../core/vistaGeralDirecao";
import { DicaNota } from "../ui/DicaNota";
import { BotaoQueAbre } from "./LinhaQueAbre";
import { useLinhasAbertas } from "./linhasAbertas";

interface Props {
  vista: VistaDirecao;
  anos: number[];
}

/** A rate de um perfil, ou o intervalo delas quando não foi sempre a mesma. */
function intervalo(minimo: number, maximo: number): string {
  return minimo === maximo ? formatarMoeda(minimo) : `${formatarMoeda(minimo)} – ${formatarMoeda(maximo)}`;
}

/**
 * Os perfis e as rates a que foram contratados, em toda a direção.
 *
 * É a pergunta que só daqui se pode fazer: dentro de uma unidade a rate de um
 * perfil é a que aquele procedimento fixou, mas entre unidades pode não ser a
 * mesma. Um perfil com intervalo em vez de um valor é exatamente o caso que a
 * Direção quer ver — e abrir a linha diz onde cada preço foi praticado.
 */
export function TabelaDeRates({ vista, anos }: Props) {
  const linhas = useLinhasAbertas();
  const perfis = ratesPorPerfil(vista, anos);

  if (perfis.length === 0) {
    return <p className="estado-vazio">Sem perfis contratados para mostrar.</p>;
  }

  return (
    <div className="tabela-envolvente">
      <table className="tabela">
        <caption className="tabela-legenda">
          Um perfil por linha, com a rate a que foi contratado. Quando aparece um intervalo, o mesmo perfil foi
          contratado a preços diferentes — abra a linha para ver em que unidade e em que projeto.
        </caption>

        <thead>
          <tr>
            <th scope="col">Perfil / Unidade</th>
            <th scope="col">Projeto</th>
            <th scope="col" className="numerico">
              Lote
            </th>
            <th scope="col" className="numerico">
              Pessoas
            </th>
            <th scope="col" className="numerico">
              Rate (€/h) <span className="cabecalho-nota">s/ IVA</span>
            </th>
            <th scope="col" className="numerico">
              <span className="cabecalho-com-dica">
                Rate (€/h) <span className="cabecalho-nota">c/ IVA</span>
                <DicaNota rotulo="Como se apura a rate média">
                  A média é ponderada pelas pessoas: contratar dez elementos a 40 €/h pesa mais na média do que um a
                  60 €/h.
                </DicaNota>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          {perfis.map((perfil) => (
            <LinhasDoPerfil
              key={perfil.perfil}
              perfil={perfil}
              aberta={linhas.esta(perfil.perfil)}
              onAlternar={() => linhas.alternar(perfil.perfil)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhasDoPerfil({
  perfil,
  aberta,
  onAlternar,
}: {
  perfil: PerfilComRates;
  aberta: boolean;
  onAlternar: () => void;
}) {
  return (
    <>
      <tr className="linha-unidade">
        <th scope="row" colSpan={2}>
          <BotaoQueAbre
            aberto={aberta}
            texto={perfil.perfil}
            meta={`${perfil.usos.length} contratação(ões) em ${perfil.unidades} unidade(s)`}
            onAlternar={onAlternar}
          />
        </th>
        <td className="numerico">
          <span className="meta">—</span>
        </td>
        <td className="numerico">{perfil.pessoas}</td>
        <td className="numerico intervalo-rate">{intervalo(perfil.minimoSemIva, perfil.maximoSemIva)}</td>
        <td className="numerico intervalo-rate">{intervalo(perfil.minimoComIva, perfil.maximoComIva)}</td>
      </tr>

      {aberta && (
        <>
          {/* A média só aparece aberta a linha: fechada, o que interessa é o
              intervalo — se houve ou não preços diferentes pelo mesmo perfil. */}
          {rateVariavel(perfil) && (
            <tr className="linha-detalhe">
              <th scope="row" colSpan={4}>
                <span className="meta">Rate média, ponderada pelas pessoas</span>
              </th>
              <td className="numerico">
                <strong>{formatarMoeda(perfil.mediaSemIva)}</strong>
              </td>
              <td className="numerico">
                <strong>{formatarMoeda(perfil.mediaComIva)}</strong>
              </td>
            </tr>
          )}

          {perfil.usos.map((uso, i) => (
            <tr key={`${uso.unidade}|${uso.projeto}|${uso.lote}|${i}`} className="linha-detalhe">
              <th scope="row">{uso.unidade}</th>
              <td>{uso.projeto}</td>
              <td className="numerico">{uso.lote}</td>
              <td className="numerico">{uso.pessoas}</td>
              <td className="numerico">{formatarMoeda(uso.valorHoraSemIva)}</td>
              <td className="numerico">{formatarMoeda(uso.valorHoraComIva)}</td>
            </tr>
          ))}
        </>
      )}
    </>
  );
}
