import type { ItemPerfil } from "../core/types";
import { gerarId } from "../core/id";
import { moverItem, useReordenavel } from "../ui/useReordenavel";

interface Props {
  titulo: string;
  nota: string;
  /** Cabeçalho da coluna e base dos rótulos de acessibilidade, ex.: "certificação". */
  nomeItem: string;
  rotuloColuna: string;
  placeholder: string;
  textoVazio: string;
  rotuloAdicionar: string;
  /**
   * Entrada que fecha a lista e não se edita nem se remove. É a cláusula de
   * fecho do conteúdo funcional, que sai em todos os perfis por igual.
   */
  itemFixo?: string;
  itens: ItemPerfil[];
  onChange: (itens: ItemPerfil[]) => void;
}

function contarOcorrencias(itens: ItemPerfil[], designacao: string): number {
  const alvo = designacao.trim();
  if (alvo === "") return 0;
  return itens.filter((i) => i.designacao.trim() === alvo).length;
}

/**
 * Uma lista de texto do perfil — atividades do conteúdo funcional,
 * certificações exigidas —, editada linha a linha.
 *
 * Segue a mesma forma do editor de requisitos, e não um campo de texto corrido:
 * cada entrada é uma unidade autónoma, com nome próprio onde vírgulas e pontos
 * e vírgulas são parte do nome ("Oracle Certified Professional, Java SE") e não
 * separadores. A linha é a unidade, aqui e nas tabelas do documento Word.
 */
export function ListaItensEditor({
  titulo,
  nota,
  nomeItem,
  rotuloColuna,
  placeholder,
  textoVazio,
  rotuloAdicionar,
  itemFixo,
  itens,
  onChange,
}: Props) {
  const reordenavel = useReordenavel((de, para) => onChange(moverItem(itens, de, para)));

  function atualizar(idx: number, designacao: string) {
    const copia = itens.slice();
    copia[idx] = { ...copia[idx], designacao };
    onChange(copia);
  }

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>{titulo}</h3>
        <p className="painel-nota">{nota}</p>
      </header>

      {itens.length === 0 && itemFixo === undefined ? (
        <p className="estado-vazio">{textoVazio}</p>
      ) : (
        <div className="tabela-edicao">
          <div className="tabela-edicao-cabecalho grelha-certificacao">
            <span />
            <span>{rotuloColuna}</span>
            <span />
          </div>

          <ul className="lista-requisitos">
            {itens.map((item, idx) => {
              const vazio = item.designacao.trim() === "";
              const repetido = !vazio && contarOcorrencias(itens, item.designacao) > 1;

              return (
                <li
                  key={item.id}
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
                      value={item.designacao}
                      placeholder={placeholder}
                      aria-label={`${rotuloColuna} ${idx + 1}`}
                      onChange={(e) => atualizar(idx, e.target.value)}
                      aria-invalid={vazio || repetido}
                    />

                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => onChange(moverItem(itens, idx, idx - 1))}
                        disabled={idx === 0}
                        title="Mover para cima"
                        aria-label={`Mover a ${nomeItem} ${idx + 1} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => onChange(moverItem(itens, idx, idx + 1))}
                        disabled={idx === itens.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover a ${nomeItem} ${idx + 1} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao-icone botao-perigo"
                        onClick={() => onChange(itens.filter((_, i) => i !== idx))}
                        title={`Remover ${nomeItem}`}
                        aria-label={`Remover a ${nomeItem} ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {vazio && <p className="aviso aviso-erro">A designação não pode ficar vazia.</p>}
                  {repetido && <p className="aviso aviso-erro">Esta entrada está repetida.</p>}
                </li>
              );
            })}
            {itemFixo !== undefined && (
              <li className="linha-edicao linha-fixa">
                <div className="grelha-certificacao">
                  <span className="pega pega-fixa" aria-hidden="true">
                    {itens.length + 1}
                  </span>
                  <input type="text" value={itemFixo} readOnly aria-label={`${rotuloColuna}, fixa`} />
                  <span className="meta">fixa</span>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="botao-secundario"
        onClick={() => onChange([...itens, { id: gerarId(), designacao: "" }])}
      >
        {rotuloAdicionar}
      </button>
    </section>
  );
}
