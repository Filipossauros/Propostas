import { useRef, useState } from "react";
import { CHAVE_VISTA_GERAL } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { ErroImportacao } from "../core/perfil";
import {
  comInterno,
  comProjetoDeslocado,
  comProjetoMovido,
  ehOrcamentoGuardado,
  importarOrcamentoJSON,
  normalizarOrcamento,
  orcamentoInicial,
  semInterno,
  semProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import {
  comNoOrcamento,
  importarParaBiblioteca,
  nomeParaListas,
  valorEstimadoDoPedido,
  type Biblioteca,
} from "../core/biblioteca";
import { orcamentoComBiblioteca } from "../core/orcamentoDaBiblioteca";
import { formatarMoeda } from "../core/lotes";
import { descarregarPacote } from "../ui/pacote";
import { ficheirosDaVistaGeral, nomeDoPacoteDaVistaGeral } from "../saidas/pacotes";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { EtiquetaDoEstado, EtiquetaDoTipo } from "../inicio/BarraSuperior";
import { ResumoGeral } from "./ResumoGeral";
import { TabelaVistaGeral } from "./TabelaVistaGeral";
import { CenariosDeCorte } from "./CenariosDeCorte";

interface Props {
  biblioteca: Biblioteca;
  onAlterarBiblioteca: (atualizar: (atual: Biblioteca) => Biblioteca) => void;
  onAbrirPedido: (id: string) => void;
}

/**
 * O orçamento da unidade.
 *
 * Lê os pedidos da biblioteca marcados «no orçamento» — de bolsa de horas e de
 * licenciamento — e acompanha-os: corrigir um pedido corrige o orçamento. O que
 * é só do orçamento — os elementos internos, a ordem dos projetos e os
 * cenários de corte — fica guardado aqui, neste navegador. Ver
 * `orcamentoDaBiblioteca.ts`.
 */
export function VistaGeral({ biblioteca, onAlterarBiblioteca, onAbrirPedido }: Props) {
  const [guardado, setGuardado] = useEstadoPersistente<OrcamentoUnidade>(
    CHAVE_VISTA_GERAL,
    orcamentoInicial,
    ehOrcamentoGuardado,
    normalizarOrcamento,
  );
  // O que se mostra e soma: só os pedidos marcados, postos em dia.
  const orcamento = orcamentoComBiblioteca(guardado, biblioteca);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  // O orçamento e os cenários de corte são duas leituras do mesmo módulo: os
  // cenários partem do orçamento e nunca o alteram.
  const [leitura, setLeitura] = useState<"orcamento" | "cenarios">("orcamento");
  const [colapsados, setColapsados] = useState<ReadonlySet<string>>(() => new Set());
  const inputAgrupamentosRef = useRef<HTMLInputElement>(null);
  const inputOrcamentoRef = useRef<HTMLInputElement>(null);

  const semDados = orcamento.projetos.length === 0;
  const barraColapso = semDados ? null : (
    <div className="acoes-linha acoes-colapsar">
      <button
        type="button"
        className="botao-discreto"
        onClick={() => setColapsados(new Set(orcamento.projetos.map((p) => p.id)))}
      >
        Colapsar todos os projetos
      </button>
      <button type="button" className="botao-discreto" onClick={() => setColapsados(new Set())}>
        Expandir todos
      </button>
    </div>
  );
  const candidatos = biblioteca.pedidos.filter((p) => !p.arquivado);

  /**
   * Altera o orçamento guardado. A alteração parte da versão guardada já posta
   * em dia com a biblioteca — com os projetos dos pedidos fora do orçamento, que
   * guardam os seus internos —, para nada se perder.
   */
  function setOrcamento(alterar: OrcamentoUnidade | ((atual: OrcamentoUnidade) => OrcamentoUnidade)) {
    setGuardado((atual) => {
      const posto = orcamentoComBiblioteca(atual, biblioteca, { manterFora: true });
      return typeof alterar === "function" ? alterar(posto) : alterar;
    });
  }

  function alternarColapso(projetoId: string) {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(projetoId)) novo.delete(projetoId);
      else novo.add(projetoId);
      return novo;
    });
  }

  /** Um projeto de um pedido sai do orçamento desmarcando o pedido; um importado sai mesmo. */
  function removerProjeto(projetoId: string) {
    const projeto = orcamento.projetos.find((p) => p.id === projetoId);
    if (projeto === undefined) return;
    if (projeto.pedidoId !== undefined) {
      const pedidoId = projeto.pedidoId;
      onAlterarBiblioteca((b) => comNoOrcamento(b, [pedidoId], false));
      return;
    }
    if (!confirm(`Remover «${projeto.nome}» do orçamento, com os elementos internos que lhe estão afetos?`)) return;
    setOrcamento((atual) => semProjeto(atual, projetoId));
  }

  /**
   * Os ficheiros de colegas (lotes, pedidos, perfis…) entram na biblioteca, e
   * ficam logo marcados no orçamento.
   */
  async function carregarAgrupamentos(ficheiros: FileList) {
    setMensagem(null);
    let acumulada = biblioteca;
    const lidos: string[] = [];
    const falhas: string[] = [];
    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const r = importarParaBiblioteca(acumulada, await ficheiro.text());
        acumulada = comNoOrcamento(r.biblioteca, r.ids, true);
        lidos.push(...r.acrescentados, ...r.atualizados);
      } catch (erro) {
        falhas.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }
    const final = acumulada;
    onAlterarBiblioteca(() => final);
    const partes: string[] = [];
    if (lidos.length > 0) partes.push(`Na biblioteca e no orçamento: ${lidos.join(", ")}`);
    if (falhas.length > 0) partes.push(`Por ler: ${falhas.join(" · ")}`);
    setMensagem({ tipo: falhas.length > 0 ? "erro" : "sucesso", texto: partes.join(" — ") || "Nada a importar." });
  }

  async function carregarOrcamento(ficheiro: File) {
    setMensagem(null);
    try {
      const lido = importarOrcamentoJSON(await ficheiro.text());
      setGuardado(lido);
      setMensagem({
        tipo: "sucesso",
        texto: `Orçamento carregado, com ${lido.projetos.length} projeto(s).`,
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível ler o ficheiro.",
      });
    }
  }

  async function descarregarVistaGeral() {
    setMensagem(null);
    try {
      await descarregarPacote(nomeDoPacoteDaVistaGeral(orcamento), await ficheirosDaVistaGeral(orcamento));
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o pacote da Vista Geral." });
    }
  }

  /**
   * Repõe a vista do zero.
   *
   * Pergunta antes, e diz o que leva com ela: os nomes dos elementos internos
   * foram escritos à mão, um a um, e não voltam de nenhum ficheiro importado.
   */
  // A ordem dos projetos é uma só, e vive aqui: as duas tabelas arrastam sobre
  // ela, e é por isso que arrastar numa se vê logo na outra.
  function moverProjeto(arrastadoId: string, alvoId: string) {
    setOrcamento((atual) => comProjetoMovido(atual, arrastadoId, alvoId));
  }

  function deslocarProjeto(projetoId: string, passos: number) {
    setOrcamento((atual) => comProjetoDeslocado(atual, projetoId, passos));
  }

  function recomecar() {
    if (
      !confirm(
        "Apagar os elementos internos, os cenários e os projetos importados de ficheiro, e recomeçar? Os pedidos da " +
          "biblioteca não são tocados.",
      )
    )
      return;
    setGuardado(orcamentoInicial());
    setMensagem({ tipo: "sucesso", texto: "Orçamento reposto." });
  }

  return (
    <>
      <div className="modulo-cabecalho modulo-cabecalho-unidade">
        <div className="modulo-titulo-linha">
          <h2>Orçamento da unidade</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p>
          Os pedidos da unidade lado a lado — de bolsa de horas e de licenciamento: quantas pessoas e quanto dinheiro
          em cada um, e que fatia da equipa cada um ocupa. Acompanha os pedidos da biblioteca marcados «no orçamento».
        </p>
      </div>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <div className="seletor-vista" role="group" aria-label="Leitura da vista">
        <button
          type="button"
          className={leitura === "orcamento" ? "aba-ativa" : undefined}
          aria-pressed={leitura === "orcamento"}
          onClick={() => setLeitura("orcamento")}
        >
          Orçamento
        </button>
        <button
          type="button"
          className={leitura === "cenarios" ? "aba-ativa" : undefined}
          aria-pressed={leitura === "cenarios"}
          onClick={() => setLeitura("cenarios")}
        >
          Cenários de corte{orcamento.cenarios.length > 0 ? ` (${orcamento.cenarios.length})` : ""}
        </button>
      </div>

      {leitura === "cenarios" && (
        <CenariosDeCorte
          orcamento={orcamento}
          barraColapso={barraColapso}
          colapsados={colapsados}
          onAlternarColapso={alternarColapso}
          onAlterar={setOrcamento}
          onMoverProjeto={moverProjeto}
          onDeslocarProjeto={deslocarProjeto}
        />
      )}

      {leitura === "orcamento" && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Pedidos no orçamento</h3>
              <p className="painel-nota">
                Marque os pedidos da biblioteca que entram no orçamento. Um pedido desmarcado sai, mas os seus elementos
                internos ficam guardados para quando voltar.
              </p>
            </header>
            {candidatos.length === 0 ? (
              <p className="estado-vazio">A biblioteca ainda não tem pedidos.</p>
            ) : (
              <ul className="lista-pedidos-orcamento">
                {candidatos.map((p) => {
                  const valor = valorEstimadoDoPedido(p);
                  return (
                    <li key={p.id}>
                      <label className="campo-opcao">
                        <input
                          type="checkbox"
                          checked={p.noOrcamento}
                          onChange={(e) => onAlterarBiblioteca((b) => comNoOrcamento(b, [p.id], e.target.checked))}
                        />
                        <span>
                          <span className="linha-pedido-orcamento">
                            <strong>{nomeParaListas(p)}</strong> <EtiquetaDoTipo tipo={p.tipo} />
                            <EtiquetaDoEstado pedido={p} />
                          </span>
                          <span className="meta">
                            {valor === null ? "sem valor estimado" : `${formatarMoeda(valor)} sem IVA`}
                          </span>
                        </span>
                      </label>
                      <button type="button" className="botao-discreto" onClick={() => onAbrirPedido(p.id)}>
                        Abrir
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <label className="campo-unidade">
              <span>Unidade</span>
              <input
                type="text"
                value={orcamento.unidade}
                placeholder="Nome da unidade (sai nos ficheiros)"
                onChange={(e) => setOrcamento((atual) => ({ ...atual, unidade: e.target.value }))}
              />
            </label>

            <div className="acoes">
              <button type="button" className="botao-secundario" onClick={() => inputAgrupamentosRef.current?.click()}>
                Importar pedidos ou lotes (JSON)
              </button>
              <input
                ref={inputAgrupamentosRef}
                type="file"
                multiple
                accept="application/json,.json"
                className="input-ficheiro-oculto"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) void carregarAgrupamentos(e.target.files);
                  e.target.value = "";
                }}
              />

              <button type="button" className="botao-secundario" onClick={() => inputOrcamentoRef.current?.click()}>
                Carregar Vista Geral (JSON)
              </button>
              <input
                ref={inputOrcamentoRef}
                type="file"
                accept="application/json,.json"
                className="input-ficheiro-oculto"
                onChange={(e) => {
                  const ficheiro = e.target.files?.[0];
                  if (ficheiro) void carregarOrcamento(ficheiro);
                  e.target.value = "";
                }}
              />
            </div>

            {/* A vista traz nomes de pessoas da equipa: quem a preenche tem de saber
            onde ficam, e que ficam só aqui. */}
            <p className="ajuda">
              Os ficheiros importados (lotes de colegas, pedidos, perfis) entram na biblioteca e ficam marcados aqui. Um
              orçamento descarregado antes da biblioteca carrega-se com «Carregar Vista Geral»: os seus projetos ficam
              como importados, até haver na biblioteca um pedido com o mesmo nome. O orçamento fica guardado
              neste navegador, incluindo os nomes dos elementos internos, e não sai deste posto de trabalho.
            </p>
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Resumo geral</h3>
              <p className="painel-nota">As pessoas de todos os projetos na unidade.</p>
            </header>

            <ResumoGeral orcamento={orcamento} onMoverProjeto={moverProjeto} onDeslocarProjeto={deslocarProjeto} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Projetos, pessoas e valores</h3>
              <p className="painel-nota">Detalhe de cada projeto, perfil a perfil e licença a licença.</p>
            </header>
            {barraColapso}

            <TabelaVistaGeral
              orcamento={orcamento}
              colapsados={colapsados}
              onAlternarColapso={alternarColapso}
              onRemoverProjeto={removerProjeto}
              onRemoverInterno={(projetoId, internoId) =>
                setOrcamento((atual) => semInterno(atual, projetoId, internoId))
              }
              onAcrescentarInterno={(projetoId, nome) => setOrcamento((atual) => comInterno(atual, projetoId, nome))}
              onMoverProjeto={moverProjeto}
              onDeslocarProjeto={deslocarProjeto}
            />
          </section>
        </>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Ficheiros</h3>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-principal"
            disabled={semDados}
            onClick={() => void descarregarVistaGeral()}
          >
            Descarregar Vista Geral (ZIP)
          </button>
        </div>
        <p className="ajuda">
          Um ZIP com o Excel e o JSON. O Excel contempla duas tabelas, uma por folha: o resumo geral e o detalhe por
          projeto — e, havendo cenários de corte, uma folha «Comparação» com o orçamento e os cenários lado a lado e o
          detalhe de cada cenário. O JSON leva os cenários, para os retomar noutro posto. O nome do ficheiro leva os anos de início dos projetos carregados.
        </p>
      </section>
    </>
  );
}
