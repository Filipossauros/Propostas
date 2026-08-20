import type { Certificacao } from "../core/types";
import { gerarId } from "../core/id";
import { moverItem, useReordenavel } from "../ui/useReordenavel";

interface Props {
  certificacoes: Certificacao[];
  onChange: (certificacoes: Certificacao[]) => void;
}

function contarOcorrencias(certificacoes: Certificacao[], designacao: string): number {
  const alvo = designacao.trim();
  if (alvo === "") return 0;
  return certificacoes.filter((c) => c.designacao.trim() === alvo).length;
}

/**
 * Certificações exigidas ao elemento, uma por linha.
 *
 * Segue a mesma forma do editor de requisitos, e não um campo de texto corrido:
 * cada certificação é uma exigência autónoma, com nome próprio onde vírgulas e
 * pontos e vírgulas são parte do nome ("Oracle Certified Professional, Java SE")
 * e não separadores. A linha é a unidade, aqui e na tabela do documento Word.
 */
export function CertificacoesEditor({ certificacoes, onChange }: Props) {
  const reordenavel = useReordenavel((de, para) => onChange(moverItem(certificacoes, de, para)));

  function atualizar(idx: number, designacao: string) {
    const copia = certificacoes.slice();
    copia[idx] = { ...copia[idx], designacao };
    onChange(copia);
  }

  function mover(idx: number, direcao: -1 | 1) {
    onChange(moverItem(certificacoes, idx, idx + direcao));
  }

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>Certificações</h3>
        <p className="painel-nota">
          Opcional. Uma certificação por linha. Saem no documento Word, em tabela própria com uma linha por
          certificação; não aparecem em nenhum formulário Excel, porque a certificação é verificada fora desta
          ferramenta, contra as peças da proposta.
        </p>
      </header>

      {certificacoes.length === 0 ? (
        <p className="estado-vazio">Este perfil não exige certificações.</p>
      ) : (
        <div className="tabela-edicao">
          <div className="tabela-edicao-cabecalho grelha-certificacao">
            <span />
            <span>Designação da certificação</span>
            <span />
          </div>

          <ul className="lista-requisitos">
            {certificacoes.map((c, idx) => {
              const vazio = c.designacao.trim() === "";
              const repetido = !vazio && contarOcorrencias(certificacoes, c.designacao) > 1;

              return (
                <li
                  key={c.id}
                  className={reordenavel.aArrastar === idx ? "linha-edicao linha-a-arrastar" : "linha-edicao"}
                  {...reordenavel.propsAlvo(idx)}
                >
                  <div className="grelha-certificacao">
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
                      value={c.designacao}
                      placeholder="ex.: Oracle Certified Professional, Java SE Programmer"
                      aria-label={`Designação da certificação ${idx + 1}`}
                      onChange={(e) => atualizar(idx, e.target.value)}
                      aria-invalid={vazio || repetido}
                    />

                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        title="Mover para cima"
                        aria-label={`Mover a certificação ${idx + 1} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, 1)}
                        disabled={idx === certificacoes.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover a certificação ${idx + 1} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao-icone botao-perigo"
                        onClick={() => onChange(certificacoes.filter((_, i) => i !== idx))}
                        title="Remover certificação"
                        aria-label={`Remover a certificação ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {vazio && <p className="aviso aviso-erro">A designação não pode ficar vazia.</p>}
                  {repetido && <p className="aviso aviso-erro">Esta certificação está repetida.</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="botao-secundario"
        onClick={() => onChange([...certificacoes, { id: gerarId(), designacao: "" }])}
      >
        + Adicionar certificação
      </button>
    </section>
  );
}
