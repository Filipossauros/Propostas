import type { Requisito } from "../core/types";
import { mesesDeAnos } from "../core/types";
import { gerarId } from "../core/id";
import { CampoAnos } from "../ui/CampoAnos";
import { moverItem, useReordenavel } from "../ui/useReordenavel";

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
  const reordenavel = useReordenavel((de, para) => onChange(moverItem(requisitos, de, para)));

  function atualizar(idx: number, patch: Partial<Requisito>) {
    const copia = requisitos.slice();
    copia[idx] = { ...copia[idx], ...patch };
    onChange(copia);
  }

  function remover(idx: number) {
    onChange(requisitos.filter((_, i) => i !== idx));
  }

  function mover(idx: number, direcao: -1 | 1) {
    onChange(moverItem(requisitos, idx, idx + direcao));
  }

  function adicionar() {
    onChange([...requisitos, { id: gerarId(), designacao: "", mesesMinimos: mesesDeAnos(1) }]);
  }

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>Requisitos mínimos de experiência</h3>
        <p className="painel-nota">A ordem desta lista é a ordem das linhas que constará no formulário.</p>
      </header>

      {requisitos.length === 0 ? (
        <p className="estado-vazio">Ainda não há requisitos. Adicione o primeiro para começar.</p>
      ) : (
        <div className="tabela-edicao">
          {/* Os rótulos aparecem uma vez, no cabeçalho, em vez de se repetirem
              linha a linha: com dezenas de requisitos, era essa repetição que
              espalhava a lista e a tornava difícil de percorrer. */}
          <div className="tabela-edicao-cabecalho grelha-requisito">
            <span />
            <span>Designação do requisito</span>
            <span>Experiência mínima</span>
            <span />
          </div>

          <ul className="lista-requisitos">
            {requisitos.map((r, idx) => {
              const vazio = r.designacao.trim() === "";
              const repetido = !vazio && contarOcorrencias(requisitos, r.designacao) > 1;

              return (
                <li
                  key={r.id}
                  className={reordenavel.aArrastar === idx ? "linha-edicao linha-a-arrastar" : "linha-edicao"}
                  {...reordenavel.propsAlvo(idx)}
                >
                  <div className="grelha-requisito">
                    <span
                      className="pega"
                      title="Arrastar para reordenar"
                      aria-hidden="true"
                      {...reordenavel.propsPega(idx)}
                    >
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      value={r.designacao}
                      placeholder="ex.: Desenvolvimento de software (geral)"
                      aria-label={`Designação do requisito ${idx + 1}`}
                      onChange={(e) => atualizar(idx, { designacao: e.target.value })}
                      aria-invalid={vazio || repetido}
                    />

                    <CampoAnos
                      mesesMinimos={r.mesesMinimos}
                      rotuloVisivel={false}
                      onChange={(mesesMinimos) => atualizar(idx, { mesesMinimos })}
                    />

                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        title="Mover para cima"
                        aria-label={`Mover o requisito ${idx + 1} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, 1)}
                        disabled={idx === requisitos.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover o requisito ${idx + 1} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao-icone botao-perigo"
                        onClick={() => remover(idx)}
                        title="Remover requisito"
                        aria-label={`Remover o requisito ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {vazio && <p className="aviso aviso-erro">A designação não pode ficar vazia.</p>}
                  {repetido && <p className="aviso aviso-erro">Esta designação está repetida.</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button type="button" className="botao-secundario" onClick={adicionar}>
        + Adicionar requisito
      </button>
    </section>
  );
}
