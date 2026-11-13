import { useRef, useState } from "react";
import {
  bibliotecaParaJSON,
  comNoOrcamento,
  comPedidoAlterado,
  comPedidoNovo,
  estadoDoPedido,
  importarParaBiblioteca,
  nomeDoPedido,
  nomeParaListas,
  pedidoDuplicado,
  pedidoParaJSON,
  questoesDoPedido,
  resumoDoPedido,
  semPedido,
  valorEstimadoDoPedido,
  type Biblioteca,
  type EstadoDoPedido,
  type PedidoNaBiblioteca,
  type TipoPedido,
} from "../core/biblioteca";
import { ErroImportacao } from "../core/perfil";
import { formatarMoeda } from "../core/lotes";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { carimboDeData } from "../ui/pacote";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { EtiquetaDoEstado, EtiquetaDoTipo } from "./BarraSuperior";

interface Props {
  biblioteca: Biblioteca;
  onAlterar: (atualizar: (atual: Biblioteca) => Biblioteca) => void;
  onAbrir: (id: string) => void;
  onNovo: (tipo: TipoPedido) => void;
  onDescarregarTudo: (id: string) => void;
}

type Filtro = "todos" | "preparacao" | "prontos" | "arquivados";

const FILTROS: Array<[Filtro, string]> = [
  ["todos", "Todos"],
  ["preparacao", "Em preparação"],
  ["prontos", "Prontos"],
  ["arquivados", "Arquivados"],
];

function passaNoFiltro(estado: EstadoDoPedido, filtro: Filtro): boolean {
  switch (filtro) {
    case "todos":
      return estado !== "arquivado";
    case "preparacao":
      return estado === "preparacao";
    case "prontos":
      return estado === "pronto" || estado === "revisto";
    case "arquivados":
      return estado === "arquivado";
  }
}

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia
    ? `hoje, ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("pt-PT");
}

/**
 * A página inicial: a biblioteca de pedidos. Daqui se abre, cria, importa,
 * duplica, descarrega, arquiva e apaga cada pedido.
 */
export function PaginaBiblioteca({ biblioteca, onAlterar, onAbrir, onNovo, onDescarregarTudo }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const ficheiros = useRef<HTMLInputElement>(null);

  const comEstado = biblioteca.pedidos.map((p) => ({ pedido: p, estado: estadoDoPedido(p) }));
  const contagem = (f: Filtro) => comEstado.filter((x) => passaNoFiltro(x.estado, f)).length;
  const visiveis = comEstado
    .filter((x) => passaNoFiltro(x.estado, filtro))
    .sort((a, b) => b.pedido.atualizadoEm.localeCompare(a.pedido.atualizadoEm));

  async function importar(lista: FileList) {
    setMensagem(null);
    let atual = biblioteca;
    const acrescentados: string[] = [];
    const atualizados: string[] = [];
    const falhas: string[] = [];
    for (const f of Array.from(lista)) {
      try {
        const r = importarParaBiblioteca(atual, await f.text());
        atual = r.biblioteca;
        acrescentados.push(...r.acrescentados);
        atualizados.push(...r.atualizados);
      } catch (erro) {
        falhas.push(`${f.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }
    const final = atual;
    onAlterar(() => final);
    const partes: string[] = [];
    if (acrescentados.length > 0) partes.push(`Acrescentado(s): ${acrescentados.join(", ")}`);
    if (atualizados.length > 0) partes.push(`Atualizado(s): ${atualizados.join(", ")}`);
    if (falhas.length > 0) partes.push(`Por ler: ${falhas.join(" · ")}`);
    setMensagem({ tipo: falhas.length > 0 ? "erro" : "sucesso", texto: partes.join(" — ") || "Nada a importar." });
  }

  function exportar(p: PedidoNaBiblioteca) {
    const sufixo = p.tipo === "bolsa" ? "Pedido_Bolsa_de_Horas" : "Pedido_Licenciamento";
    descarregarBlob(
      new Blob([pedidoParaJSON(p)], { type: "application/json" }),
      `${nomeSeguro(nomeDoPedido(p), "Pedido")}_${sufixo}.json`,
    );
  }

  function apagar(p: PedidoNaBiblioteca) {
    if (!confirm(`Apagar o pedido «${nomeParaListas(p)}»? Não se pode desfazer. Pode exportá-lo antes, em JSON.`))
      return;
    onAlterar((b) => semPedido(b, p.id));
  }

  return (
    <div className="pagina-biblioteca">
      <div className="biblioteca-cabecalho">
        <h2>Biblioteca de pedidos</h2>
        <div className="acoes-linha">
          <button type="button" className="botao-principal" onClick={() => onNovo("bolsa")}>
            + Novo pedido de bolsa de horas
          </button>
          <button type="button" className="botao-principal botao-licenciamento" onClick={() => onNovo("licenciamento")}>
            + Novo pedido de licenciamento
          </button>
          <button type="button" className="botao-secundario" onClick={() => ficheiros.current?.click()}>
            Importar (JSON)
          </button>
          <button
            type="button"
            className="botao-secundario"
            disabled={biblioteca.pedidos.length === 0}
            onClick={() =>
              descarregarBlob(
                new Blob([bibliotecaParaJSON(biblioteca)], { type: "application/json" }),
                `Biblioteca_de_pedidos_${carimboDeData()}.json`,
              )
            }
          >
            Descarregar biblioteca
          </button>
          <input
            ref={ficheiros}
            type="file"
            accept="application/json,.json"
            multiple
            className="input-ficheiro-oculto"
            onChange={(e) => {
              if (e.target.files !== null && e.target.files.length > 0) void importar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="ajuda">
        Todos os pedidos — de bolsa de horas e de licenciamento — ficam guardados neste navegador; nada sai deste
        computador. Importa-se uma biblioteca descarregada, um pedido, um agrupamento de lotes ou um ficheiro de perfis.
        A análise de propostas abre-se na barra de cima: é outro momento, depois de recebidas as propostas.
      </p>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <div className="filtros-biblioteca" role="tablist" aria-label="Filtrar pedidos">
        {FILTROS.map(([f, titulo]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filtro === f}
            className={filtro === f ? "passo-grupo passo-grupo-ativo" : "passo-grupo"}
            onClick={() => setFiltro(f)}
          >
            {titulo} ({contagem(f)})
          </button>
        ))}
      </div>

      {biblioteca.pedidos.length === 0 ? (
        <section className="painel">
          <p className="estado-vazio">
            A biblioteca ainda não tem pedidos. Crie o primeiro — de bolsa de horas ou de licenciamento — ou importe um
            ficheiro.
          </p>
        </section>
      ) : visiveis.length === 0 ? (
        <p className="estado-vazio">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="tabela-envolvente tabela-biblioteca-envolvente">
          <table className="tabela tabela-biblioteca">
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Versão</th>
                <th scope="col" className="numerico">
                  Valor estimado <span className="cabecalho-nota">sem IVA</span>
                </th>
                <th scope="col">No orçamento</th>
                <th scope="col">Atualizado</th>
                <th scope="col">
                  <span className="rotulo-oculto">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ pedido: p, estado }) => {
                const questoes = estado === "preparacao" ? questoesDoPedido(p) : 0;
                const valor = valorEstimadoDoPedido(p);
                const ativo = biblioteca.ativoId === p.id;
                return (
                  <tr key={p.id} className={ativo ? "linha-pedido-ativo" : undefined}>
                    <td>
                      <button type="button" className="nome-pedido" onClick={() => onAbrir(p.id)}>
                        {nomeParaListas(p)}
                      </button>
                      <span className="meta">{resumoDoPedido(p)}</span>
                    </td>
                    <td>
                      <EtiquetaDoTipo tipo={p.tipo} />
                    </td>
                    <td>
                      <EtiquetaDoEstado pedido={p} />
                      {questoes > 0 && (
                        <span className="meta meta-falta">
                          {questoes === 1 ? "1 questão por resolver" : `${questoes} questões por resolver`}
                        </span>
                      )}
                    </td>
                    <td>
                      v{p.versao}
                      {p.historico.length > 0 && (
                        <span
                          className="meta meta-bloco"
                          title={p.historico.map((h) => `v${h.versao}: ${h.nota}`).join("\n")}
                        >
                          {p.historico.at(-1)?.nota}
                        </span>
                      )}
                    </td>
                    <td className="numerico">{valor === null ? "—" : formatarMoeda(valor)}</td>
                    <td className="celula-no-orcamento">
                      <input
                        type="checkbox"
                        checked={p.noOrcamento}
                        disabled={p.arquivado}
                        aria-label={`${nomeParaListas(p)} no orçamento`}
                        title={
                          p.arquivado ? "Um pedido arquivado não entra no orçamento" : "Entra no orçamento da unidade"
                        }
                        onChange={(e) => onAlterar((b) => comNoOrcamento(b, [p.id], e.target.checked))}
                      />
                    </td>
                    <td>{quando(p.atualizadoEm)}</td>
                    <td>
                      <div className="acoes-linha acoes-pedido">
                        <button type="button" className="botao-secundario" onClick={() => onAbrir(p.id)}>
                          Abrir
                        </button>
                        <details className="menu-pedido">
                          <summary aria-label={`Mais ações para ${nomeParaListas(p)}`}>⋯</summary>
                          <div className="menu-pedido-lista">
                            <button
                              type="button"
                              onClick={() => onAlterar((b) => comPedidoNovo(b, pedidoDuplicado(p), false))}
                            >
                              Duplicar
                            </button>
                            <button type="button" onClick={() => onDescarregarTudo(p.id)}>
                              Descarregar tudo
                            </button>
                            <button type="button" onClick={() => exportar(p)}>
                              Exportar (JSON)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAlterar((b) => comPedidoAlterado(b, p.id, (x) => ({ ...x, arquivado: !x.arquivado })))
                              }
                            >
                              {p.arquivado ? "Desarquivar" : "Arquivar"}
                            </button>
                            <button type="button" className="botao-perigo" onClick={() => apagar(p)}>
                              Apagar
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
