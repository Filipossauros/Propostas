import { chaveDeProjeto, type DeclaracaoAtribuida } from "../core/avaliacaoProcedimento";
import { blocoSemDatas, blocoSemIdentificacao } from "../core/regraA";
import { blocoPreenchido } from "../core/validar";

interface Props {
  atribuidas: DeclaracaoAtribuida[];
  excluidos: ReadonlySet<string>;
  onAlterar: (chave: string, excluir: boolean) => void;
}

/**
 * Projetos sem cliente/entidade, projeto ou função.
 *
 * As regras já não anulam estes projetos: contam. Mas o júri pode pedir ao
 * concorrente evidências do projeto (n.º 14 das regras) e, não as obtendo,
 * não o considerar — é o que a caixa de cada linha faz. A decisão fica só
 * nesta sessão, como as declarações: nunca é guardada no navegador.
 */
export function ProjetosAConfirmar({ atribuidas, excluidos, onAlterar }: Props) {
  const projetos = atribuidas.flatMap(({ declaracao }) =>
    declaracao.blocos
      .filter((b) => blocoPreenchido(b) && !blocoSemDatas(b) && blocoSemIdentificacao(b))
      .map((bloco) => ({ declaracao, bloco, chave: chaveDeProjeto(declaracao.id, bloco.indice) })),
  );

  if (projetos.length === 0) {
    return <p className="ajuda">Todos os projetos declarados identificam o cliente/entidade, o projeto e a função.</p>;
  }

  const campo = (texto: string) => (texto.trim() === "" ? <span className="estado-falha">por preencher</span> : texto);

  return (
    <>
      <div className="tabela-envolvente">
        <table className="tabela tabela-projetos-a-confirmar">
          <thead>
            <tr>
              <th scope="col">Concorrente · elemento</th>
              <th scope="col" className="numerico">
                Projeto n.º
              </th>
              <th scope="col">Cliente / entidade</th>
              <th scope="col">Projeto</th>
              <th scope="col">Função</th>
              <th scope="col">Decisão do júri</th>
            </tr>
          </thead>
          <tbody>
            {projetos.map(({ declaracao, bloco, chave }) => (
              <tr key={chave} className={excluidos.has(chave) ? "linha-excluida" : undefined}>
                <td>
                  {declaracao.identificacao.entidadeConcorrente || "(entidade por preencher)"}
                  <span className="meta"> · {declaracao.identificacao.nome || declaracao.ficheiro}</span>
                </td>
                <td className="numerico">{bloco.indice}</td>
                <td>{campo(bloco.cliente)}</td>
                <td>{campo(bloco.projeto)}</td>
                <td>{campo(bloco.funcao)}</td>
                <td>
                  <label className="campo-opcao">
                    <input
                      type="checkbox"
                      checked={excluidos.has(chave)}
                      onChange={(e) => onAlterar(chave, e.target.checked)}
                    />
                    <span>Não considerar (sem evidências)</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ajuda">
        Estes projetos contam para o apuramento. Se o júri pedir evidências do projeto (n.º 14 das regras) e o
        concorrente não as apresentar, assinale «Não considerar»: a experiência desse projeto deixa de contar, e o
        relatório indica-o.
      </p>
    </>
  );
}
