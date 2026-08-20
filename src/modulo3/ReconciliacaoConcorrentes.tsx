import { escolherNomeCanonico, type GrupoConcorrentes } from "../core/reconciliacao";

interface Props {
  grupos: GrupoConcorrentes[];
  /** Quantas declarações trazem cada nome, tal como escrito no formulário. */
  contagemPorNome: Map<string, number>;
  onChange: (grupos: GrupoConcorrentes[]) => void;
}

const NOVO_GRUPO = "__novo__";

function declaracoes(n: number): string {
  return `${n} ${n === 1 ? "declaração" : "declarações"}`;
}

/**
 * Confirmação de quem é quem entre as declarações recebidas.
 *
 * Cada cartão é um concorrente; dentro dele estão os nomes com que as suas
 * declarações vieram assinadas. A aplicação propõe o agrupamento por semelhança
 * de escrita, mas nunca o decide — juntar ou separar concorrentes muda quem fica
 * com o lote, e essa é decisão do júri.
 */
export function ReconciliacaoConcorrentes({ grupos, contagemPorNome, onChange }: Props) {
  function renomear(grupoId: string, nomeCanonico: string) {
    onChange(grupos.map((g) => (g.id === grupoId ? { ...g, nomeCanonico } : g)));
  }

  function moverNome(nome: string, grupoOrigemId: string, destino: string) {
    const semNome = grupos.map((g) => {
      if (g.id !== grupoOrigemId) return g;
      const nomesOriginais = g.nomesOriginais.filter((n) => n !== nome);

      // Se saiu justamente o nome que dava nome ao grupo, o grupo passa a
      // chamar-se pelo que lhe sobra. De outro modo ficariam dois cartões com o
      // mesmo nome no ecrã — e, como é o nome que identifica o concorrente no
      // apuramento, os dois voltariam a contar como um só.
      const nomeCanonico =
        g.nomeCanonico === nome && nomesOriginais.length > 0 ? escolherNomeCanonico(nomesOriginais) : g.nomeCanonico;

      return { ...g, nomesOriginais, nomeCanonico };
    });

    const comDestino =
      destino === NOVO_GRUPO
        ? [...semNome, { id: `novo-${nome}`, nomeCanonico: nome, nomesOriginais: [nome] }]
        : semNome.map((g) => (g.id === destino ? { ...g, nomesOriginais: [...g.nomesOriginais, nome] } : g));

    onChange(comDestino.filter((g) => g.nomesOriginais.length > 0));
  }

  function totalDoGrupo(grupo: GrupoConcorrentes): number {
    return grupo.nomesOriginais.reduce((soma, nome) => soma + (contagemPorNome.get(nome) ?? 0), 0);
  }

  return (
    <div>
      <p className="resumo-reconciliacao">
        <strong>
          {grupos.length} {grupos.length === 1 ? "concorrente" : "concorrentes"}
        </strong>{" "}
        em {declaracoes(grupos.reduce((soma, g) => soma + totalDoGrupo(g), 0))}.
      </p>

      <div className="lista-grupos">
        {grupos.map((grupo) => (
          <article key={grupo.id} className="cartao-grupo">
            <header className="cartao-grupo-cabecalho">
              <h4>{grupo.nomeCanonico.trim() === "" ? "(concorrente sem nome)" : grupo.nomeCanonico}</h4>
              <span className="meta">{declaracoes(totalDoGrupo(grupo))}</span>
            </header>

            <label className="campo-largo">
              <span className="rotulo">Nome a usar no relatório</span>
              <input type="text" value={grupo.nomeCanonico} onChange={(e) => renomear(grupo.id, e.target.value)} />
            </label>

            <p className="ajuda">
              {grupo.nomesOriginais.length === 1
                ? "Nome tal como veio escrito na declaração:"
                : "Nomes que vieram escritos nas declarações e que a aplicação juntou neste concorrente:"}
            </p>

            <ul className="lista-nomes-originais">
              {grupo.nomesOriginais.map((nome) => (
                <li key={nome}>
                  <span>
                    «{nome}» <span className="meta">· {declaracoes(contagemPorNome.get(nome) ?? 0)}</span>
                  </span>
                  {grupos.length > 1 && (
                    <select
                      value={grupo.id}
                      onChange={(e) => moverNome(nome, grupo.id, e.target.value)}
                      aria-label={`A quem pertence a declaração assinada por "${nome}"`}
                    >
                      <option value={grupo.id}>é este concorrente</option>
                      {grupos
                        .filter((g) => g.id !== grupo.id)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            afinal é: {g.nomeCanonico}
                          </option>
                        ))}
                      <option value={NOVO_GRUPO}>é um concorrente à parte</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
