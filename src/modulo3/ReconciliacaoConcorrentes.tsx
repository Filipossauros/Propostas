import type { AtribuicaoConcorrente } from "../core/reconciliacao";
import { agruparAtribuicoes } from "../core/reconciliacao";

interface Props {
  atribuicoes: AtribuicaoConcorrente[];
  /** Quantas declarações trazem cada nome, tal como escrito no formulário. */
  contagemPorNome: Map<string, number>;
  onChange: (atribuicoes: AtribuicaoConcorrente[]) => void;
}

function declaracoes(n: number): string {
  return `${n} ${n === 1 ? "declaração" : "declarações"}`;
}

/**
 * Confirmação de quem é quem entre as declarações recebidas.
 *
 * Uma linha por nome encontrado: à esquerda o que está escrito na declaração,
 * que não se mexe; à direita o nome a usar no relatório, que se corrige. Dois
 * nomes de relatório iguais são o mesmo concorrente — é essa a única manobra,
 * e é visível de uma vista de olhos na coluna da direita.
 *
 * A aplicação propõe, nunca decide: juntar ou separar concorrentes muda quem
 * fica com o lote.
 */
export function ReconciliacaoConcorrentes({ atribuicoes, contagemPorNome, onChange }: Props) {
  const concorrentes = agruparAtribuicoes(atribuicoes);
  const total = atribuicoes.reduce((soma, a) => soma + (contagemPorNome.get(a.nomeOriginal) ?? 0), 0);

  function renomear(nomeOriginal: string, nomeCanonico: string) {
    onChange(atribuicoes.map((a) => (a.nomeOriginal === nomeOriginal ? { ...a, nomeCanonico } : a)));
  }

  return (
    <div>
      <div className="tabela-envolvente">
        <table className="tabela tabela-reconciliacao">
          <thead>
            <tr>
              <th>Nome escrito na declaração</th>
              <th>Declarações</th>
              <th>Nome a usar no relatório</th>
            </tr>
          </thead>
          <tbody>
            {atribuicoes.map((a) => (
              <tr key={a.nomeOriginal}>
                <td>{a.nomeOriginal}</td>
                <td className="numerico">{contagemPorNome.get(a.nomeOriginal) ?? 0}</td>
                <td>
                  <input
                    type="text"
                    value={a.nomeCanonico}
                    placeholder={a.nomeOriginal}
                    aria-label={`Nome a usar no relatório para «${a.nomeOriginal}»`}
                    onChange={(e) => renomear(a.nomeOriginal, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="resumo-reconciliacao">
        Dá{" "}
        <strong>
          {concorrentes.length} {concorrentes.length === 1 ? "concorrente" : "concorrentes"}
        </strong>{" "}
        em {declaracoes(total)}: {concorrentes.map((c) => c.nomeCanonico).join(" · ")}
      </p>
    </div>
  );
}
