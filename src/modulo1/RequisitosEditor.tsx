import type { Requisito } from "../core/types";
import { sugereAgrupamento } from "../core/perfil";
import { gerarId } from "../core/id";
import { CampoNumero } from "../ui/CampoNumero";

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
    onChange([...requisitos, { id: gerarId(), designacao: "", mesesMinimos: 12 }]);
  }

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>Requisitos mínimos de experiência</h3>
        <p className="painel-nota">
          A ordem desta lista é a ordem das linhas no formulário entregue aos concorrentes.
        </p>
      </header>

      {requisitos.length === 0 && (
        <p className="estado-vazio">Ainda não há requisitos. Adicione o primeiro para começar.</p>
      )}

      <ul className="lista-requisitos">
        {requisitos.map((r, idx) => {
          const vazio = r.designacao.trim() === "";
          const repetido = !vazio && contarOcorrencias(requisitos, r.designacao) > 1;
          const agrupado = !vazio && sugereAgrupamento(r.designacao);

          return (
            <li key={r.id} className="linha-requisito">
              <div className="linha-requisito-campos">
                <span className="ordem" aria-hidden="true">
                  {idx + 1}
                </span>

                <label className="campo-crescente">
                  <span className="rotulo">Designação do requisito</span>
                  <input
                    type="text"
                    value={r.designacao}
                    placeholder="ex.: Desenvolvimento de software (geral)"
                    onChange={(e) => atualizar(idx, { designacao: e.target.value })}
                    aria-invalid={vazio || repetido}
                  />
                </label>

                <label className="campo-estreito">
                  <span className="rotulo">Meses mínimos</span>
                  <CampoNumero
                    valor={r.mesesMinimos}
                    min={1}
                    step={1}
                    sufixo="meses"
                    invalido={!Number.isInteger(r.mesesMinimos) || r.mesesMinimos < 1}
                    onChange={(mesesMinimos) => atualizar(idx, { mesesMinimos })}
                  />
                </label>

                <div className="acoes-linha">
                  <button
                    type="button"
                    className="botao-icone"
                    onClick={() => mover(idx, -1)}
                    disabled={idx === 0}
                    title="Mover para cima"
                    aria-label="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="botao-icone"
                    onClick={() => mover(idx, 1)}
                    disabled={idx === requisitos.length - 1}
                    title="Mover para baixo"
                    aria-label="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="botao-discreto botao-perigo"
                    onClick={() => remover(idx)}
                    title="Remover requisito"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {vazio && <p className="aviso aviso-erro">A designação não pode ficar vazia.</p>}
              {repetido && <p className="aviso aviso-erro">Esta designação está repetida.</p>}
              {agrupado && (
                <p className="aviso aviso-atencao">
                  Esta designação parece agrupar várias tecnologias. Um requisito agrupado torna ambíguo se é exigida
                  experiência em <em>todas</em> ou em <em>alguma</em> delas — um risco de impugnação conhecido.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className="botao-secundario" onClick={adicionar}>
        + Adicionar requisito
      </button>
    </section>
  );
}
