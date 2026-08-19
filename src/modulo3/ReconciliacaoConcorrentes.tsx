import type { GrupoConcorrentes } from "../core/reconciliacao";

interface Props {
  grupos: GrupoConcorrentes[];
  onChange: (grupos: GrupoConcorrentes[]) => void;
}

const NOVO_GRUPO = "__novo__";

export function ReconciliacaoConcorrentes({ grupos, onChange }: Props) {
  function renomear(grupoId: string, nomeCanonico: string) {
    onChange(grupos.map((g) => (g.id === grupoId ? { ...g, nomeCanonico } : g)));
  }

  function moverNome(nome: string, grupoOrigemId: string, destino: string) {
    const semNome = grupos.map((g) =>
      g.id === grupoOrigemId ? { ...g, nomesOriginais: g.nomesOriginais.filter((n) => n !== nome) } : g,
    );

    const comDestino =
      destino === NOVO_GRUPO
        ? [...semNome, { id: `novo-${nome}`, nomeCanonico: nome, nomesOriginais: [nome] }]
        : semNome.map((g) => (g.id === destino ? { ...g, nomesOriginais: [...g.nomesOriginais, nome] } : g));

    onChange(comDestino.filter((g) => g.nomesOriginais.length > 0));
  }

  return (
    <div>
      <p className="painel-nota">
        Os agrupamentos abaixo foram propostos por semelhança de escrita (maiúsculas, acentos, pontuação e formas
        societárias ignoradas). Confirme ou corrija antes de prosseguir — a aplicação nunca decide isto sozinha.
      </p>

      <div className="lista-grupos">
        {grupos.map((grupo) => (
          <article key={grupo.id} className="cartao-grupo">
            <label>
              <span className="rotulo">Nome do concorrente a usar no relatório</span>
              <input type="text" value={grupo.nomeCanonico} onChange={(e) => renomear(grupo.id, e.target.value)} />
            </label>

            <ul className="lista-nomes-originais">
              {grupo.nomesOriginais.map((nome) => (
                <li key={nome}>
                  <span>{nome}</span>
                  {grupos.length > 1 && (
                    <select
                      value={grupo.id}
                      onChange={(e) => moverNome(nome, grupo.id, e.target.value)}
                      aria-label={`Mover "${nome}" para outro grupo`}
                    >
                      <option value={grupo.id}>manter neste grupo</option>
                      {grupos
                        .filter((g) => g.id !== grupo.id)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            mover para: {g.nomeCanonico}
                          </option>
                        ))}
                      <option value={NOVO_GRUPO}>mover para novo grupo</option>
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
