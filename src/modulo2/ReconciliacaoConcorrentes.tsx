import type { GrupoConcorrentes } from "../core/reconciliacao";

interface Props {
  grupos: GrupoConcorrentes[];
  onChange: (grupos: GrupoConcorrentes[]) => void;
}

const NOVO_GRUPO = "__novo__";

export function ReconciliacaoConcorrentes({ grupos, onChange }: Props) {
  function renomear(indiceGrupo: number, nomeCanonico: string) {
    const copia = grupos.slice();
    copia[indiceGrupo] = { ...copia[indiceGrupo], nomeCanonico };
    onChange(copia);
  }

  function moverNome(nome: string, indiceOrigem: number, destino: string) {
    const copia = grupos.map((g) => ({ ...g, nomesOriginais: g.nomesOriginais.slice() }));
    copia[indiceOrigem].nomesOriginais = copia[indiceOrigem].nomesOriginais.filter((n) => n !== nome);

    if (destino === NOVO_GRUPO) {
      copia.push({ nomeCanonico: nome, nomesOriginais: [nome] });
    } else {
      const indiceDestino = Number(destino);
      copia[indiceDestino].nomesOriginais.push(nome);
    }

    onChange(copia.filter((g) => g.nomesOriginais.length > 0));
  }

  return (
    <div>
      <p>
        Os agrupamentos abaixo foram propostos por semelhança de escrita (maiúsculas, acentos, pontuação e formas
        societárias ignoradas). Confirme ou corrija antes de prosseguir — a aplicação nunca decide isto sozinha.
      </p>
      <ul className="lista-grupos">
        {grupos.map((grupo, indiceGrupo) => (
          <li key={indiceGrupo} className="grupo-concorrente">
            <label>
              Nome canónico do concorrente
              <input
                type="text"
                value={grupo.nomeCanonico}
                onChange={(e) => renomear(indiceGrupo, e.target.value)}
              />
            </label>
            <ul className="lista-nomes-originais">
              {grupo.nomesOriginais.map((nome) => (
                <li key={nome}>
                  <span>{nome}</span>
                  {grupos.length > 1 && (
                    <select
                      value={indiceGrupo}
                      onChange={(e) => moverNome(nome, indiceGrupo, e.target.value)}
                      aria-label={`Mover "${nome}" para outro grupo`}
                    >
                      <option value={indiceGrupo}>manter neste grupo</option>
                      {grupos.map((g, i) =>
                        i === indiceGrupo ? null : (
                          <option key={i} value={i}>
                            mover para: {g.nomeCanonico}
                          </option>
                        ),
                      )}
                      <option value={NOVO_GRUPO}>mover para novo grupo</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
