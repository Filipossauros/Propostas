import type { Requisito } from "../core/types";
import { sugereAgrupamento } from "../core/configuracao";
import { gerarId } from "./id";

interface Props {
  requisitos: Requisito[];
  onChange: (requisitos: Requisito[]) => void;
}

function contarOcorrencias(requisitos: Requisito[], designacao: string): number {
  const alvo = designacao.trim();
  if (alvo === "") return 0;
  return requisitos.filter((r) => r.designacao.trim() === alvo).length;
}

export function RequisitosEditor({ requisitos, onChange }: Props) {
  function atualizar(idx: number, patch: Partial<Requisito>) {
    const copia = requisitos.slice();
    copia[idx] = { ...copia[idx], ...patch };
    onChange(copia);
  }

  function remover(idx: number) {
    onChange(requisitos.filter((_, i) => i !== idx));
  }

  function mover(idx: number, direcao: -1 | 1) {
    const alvo = idx + direcao;
    if (alvo < 0 || alvo >= requisitos.length) return;
    const copia = requisitos.slice();
    [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
    onChange(copia);
  }

  function adicionar() {
    onChange([...requisitos, { id: gerarId(), designacao: "", versaoMinima: null, mesesMinimos: 1 }]);
  }

  return (
    <fieldset className="painel">
      <legend>Requisitos mínimos de experiência</legend>

      {requisitos.length === 0 && <p className="texto-vazio">Sem requisitos definidos.</p>}

      <ul className="lista-requisitos">
        {requisitos.map((r, idx) => {
          const vazio = r.designacao.trim() === "";
          const repetido = !vazio && contarOcorrencias(requisitos, r.designacao) > 1;
          const agrupado = !vazio && sugereAgrupamento(r.designacao);

          return (
            <li key={r.id} className="linha-requisito">
              <div className="linha-requisito-campos">
                <span className="ordem">{idx + 1}.</span>

                <label className="campo-largo">
                  Designação
                  <input
                    type="text"
                    value={r.designacao}
                    onChange={(e) => atualizar(idx, { designacao: e.target.value })}
                    aria-invalid={vazio || repetido}
                  />
                </label>

                <label>
                  Versão mínima
                  <input
                    type="text"
                    value={r.versaoMinima ?? ""}
                    onChange={(e) => atualizar(idx, { versaoMinima: e.target.value === "" ? null : e.target.value })}
                    placeholder="opcional"
                  />
                </label>

                <label>
                  Meses mínimos
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={r.mesesMinimos}
                    onChange={(e) => atualizar(idx, { mesesMinimos: Number(e.target.value) })}
                  />
                </label>

                <div className="acoes-linha">
                  <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} title="Mover para cima">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(idx, 1)}
                    disabled={idx === requisitos.length - 1}
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => remover(idx)} title="Remover requisito">
                    Remover
                  </button>
                </div>
              </div>

              {vazio && <p className="erro-campo">A designação não pode ficar vazia.</p>}
              {repetido && <p className="erro-campo">Esta designação está repetida.</p>}
              {agrupado && (
                <p className="aviso-campo">
                  Esta designação parece agrupar várias tecnologias — considere se pretende exigir experiência em
                  todos os elementos ou em qualquer um deles, para evitar ambiguidade (risco de impugnação).
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={adicionar}>
        Adicionar requisito
      </button>
    </fieldset>
  );
}
