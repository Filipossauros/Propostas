import { useRef, useState } from "react";
import type { DesignacaoPerfil, JustificacaoProjeto, PerfilJSON, TipoServico } from "../core/types";
import {
  ATIVIDADE_FIXA,
  DESIGNACOES_PERFIL,
  ROTULO_CERTIFICACAO,
  ROTULO_CERTIFICACOES,
  TIPOS_SERVICO,
} from "../core/types";
import {
  ErroImportacao,
  duplicarPerfil,
  importarPerfisJSON,
  perfilInicial,
  validarPerfil,
  validarPerfis,
} from "../core/perfil";
import { PERFIS_EXEMPLO } from "../core/exemplo";
import { justificacaoInicial, temJustificacao } from "../core/justificacao";
import { PERFIS_NORMALIZADOS } from "../core/perfisNormalizados";
import { descarregarPacote } from "../ui/pacote";
import { ficheirosDosPerfis, nomeDoPacoteDePerfis } from "../saidas/pacotes";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { RequisitosEditor } from "./RequisitosEditor";
import { ListaItensEditor } from "./ListaItensEditor";

interface Props {
  perfis: PerfilJSON[];
  onAlterarPerfis: (perfis: PerfilJSON[]) => void;
  /**
   * O projeto escreve-se no Módulo 1; aqui só segue nos ficheiros dos perfis,
   * e é adotado dos ficheiros importados se ainda não estiver escrito.
   */
  nomeProjeto: string;
  /** Aceita o nome vindo de um ficheiro importado, se ainda não houver um definido. */
  onAdotarNomeProjeto: (nome: string) => void;
  descricaoProjeto: string;
  /** Aceita a descrição vinda de um ficheiro importado, se ainda não houver uma. */
  onAdotarDescricaoProjeto: (descricao: string) => void;
  /** Objetivos, benefícios do projeto e riscos da não contratação. */
  justificacao: JustificacaoProjeto;
  /** Aceita os objetivos, benefícios e riscos vindos de um ficheiro, se ainda não houver nenhum escrito. */
  onAdotarJustificacao: (justificacao: JustificacaoProjeto) => void;
  /** Número do lote a que cada perfil já está atribuído, indexado pelo id do perfil. */
  lotePorPerfilId: Record<string, string>;
  onIrParaLotes: () => void;
}

export function ModuloPerfis({
  perfis,
  onAlterarPerfis,
  nomeProjeto,
  onAdotarNomeProjeto,
  descricaoProjeto,
  onAdotarDescricaoProjeto,
  justificacao,
  onAdotarJustificacao,
  lotePorPerfilId,
  onIrParaLotes,
}: Props) {
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);

  const erros = validarPerfis(perfis);
  const podeExportar = erros.length === 0;

  // O perfil em edição é sempre um dos do catálogo: se o id guardado deixar de
  // existir (removido, ou substituído por uma importação), cai no primeiro.
  const emEdicao = perfis.find((p) => p.id === idEmEdicao) ?? perfis[0] ?? null;

  function alterarEmEdicao(alteracao: Partial<PerfilJSON>) {
    if (emEdicao === null) return;
    onAlterarPerfis(perfis.map((p) => (p.id === emEdicao.id ? { ...p, ...alteracao } : p)));
  }

  function novoPerfil() {
    const novo = perfilInicial();
    onAlterarPerfis([...perfis, novo]);
    setIdEmEdicao(novo.id);
    setMensagem(null);
  }

  function duplicar(perfil: PerfilJSON) {
    const copia = duplicarPerfil(perfil);
    const idx = perfis.findIndex((p) => p.id === perfil.id);
    onAlterarPerfis([...perfis.slice(0, idx + 1), copia, ...perfis.slice(idx + 1)]);
    setIdEmEdicao(copia.id);
    setMensagem({ tipo: "sucesso", texto: `Perfil duplicado como "${copia.perfil}".` });
  }

  function remover(perfil: PerfilJSON) {
    const numeroLote = lotePorPerfilId[perfil.id];
    const aviso =
      numeroLote === undefined
        ? `Remover o perfil "${perfil.perfil || "(sem designação)"}"?`
        : `O perfil "${perfil.perfil}" está atribuído ao lote ${numeroLote}. Removê-lo daqui retira-o também desse lote. Continuar?`;
    if (!confirm(aviso)) return;

    onAlterarPerfis(perfis.filter((p) => p.id !== perfil.id));
    setMensagem({ tipo: "sucesso", texto: "Perfil removido." });
  }

  /**
   * O Excel do Módulo 2 é o registo de quem prepara o procedimento, e não o
   * formulário que os concorrentes preenchem — esse sai do Módulo 3, já com os
   * lotes e os 15 projetos de cada formulário.
   */
  async function descarregarPerfis() {
    setMensagem(null);
    setAGerar(true);
    try {
      await descarregarPacote(
        nomeDoPacoteDePerfis(nomeProjeto),
        await ficheirosDosPerfis(perfis, nomeProjeto, descricaoProjeto, justificacao),
      );
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o pacote dos perfis." });
    } finally {
      setAGerar(false);
    }
  }

  async function importarJSON(ficheiros: FileList) {
    const carregados: PerfilJSON[] = [];
    const falhados: string[] = [];
    let nomeDeFicheiro = "";
    let descricaoDeFicheiro = "";
    let justificacaoDeFicheiro = justificacaoInicial();

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const importado = importarPerfisJSON(await ficheiro.text());
        carregados.push(...importado.perfis);
        if (nomeDeFicheiro === "") nomeDeFicheiro = importado.nomeProjeto;
        if (descricaoDeFicheiro === "") descricaoDeFicheiro = importado.descricaoProjeto;
        if (!temJustificacao(justificacaoDeFicheiro)) justificacaoDeFicheiro = importado.justificacao;
      } catch (erro) {
        falhados.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    onAdotarNomeProjeto(nomeDeFicheiro);
    onAdotarDescricaoProjeto(descricaoDeFicheiro);
    onAdotarJustificacao(justificacaoDeFicheiro);

    if (carregados.length > 0) {
      // Um perfil reimportado substitui a versão em memória; os restantes juntam-se.
      const porId = new Map(perfis.map((p) => [p.id, p]));
      for (const p of carregados) porId.set(p.id, p);
      onAlterarPerfis([...porId.values()]);
    }

    setMensagem(
      falhados.length > 0
        ? { tipo: "erro", texto: `Não foi possível carregar: ${falhados.join(" · ")}` }
        : { tipo: "sucesso", texto: `${carregados.length} perfil(is) carregado(s).` },
    );
  }

  const podeCarregarExemplo = usePodeCarregarExemplo();

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    onAlterarPerfis(structuredClone(PERFIS_EXEMPLO));
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: `${PERFIS_EXEMPLO.length} perfis de exemplo carregados.` });
  }

  /**
   * Ponto de partida para um procedimento novo: o catálogo de perfis-base da
   * entidade.
   *
   * Junta-se ao que já esteja no catálogo em vez de o substituir — quem já tem
   * perfis escritos à mão não os perde por querer os normalizados também. Um
   * perfil normalizado já carregado é reposto na versão do catálogo, pela mesma
   * regra da importação de ficheiros: o id é que manda.
   */
  function carregarNormalizados() {
    const porId = new Map(perfis.map((p) => [p.id, p]));
    for (const p of structuredClone(PERFIS_NORMALIZADOS)) porId.set(p.id, p);
    onAlterarPerfis([...porId.values()]);
    setIdEmEdicao(null);
    setMensagem({
      tipo: "sucesso",
      texto:
        `${PERFIS_NORMALIZADOS.length} perfis normalizados carregados. ` +
        "Falta acrescentar a cada um os requisitos tecnológicos específicos do procedimento.",
    });
  }

  function recomecar() {
    // Só os perfis: o projeto tem o seu próprio «Recomeçar», no Módulo 1.
    if (!confirm("Apagar todos os perfis em edição e recomeçar do zero?")) return;
    onAlterarPerfis([]);
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Perfis repostos." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 2 · Perfis</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          Define cada perfil: a identificação, os requisitos mínimos de experiência, as formações ou certificações e
          o conteúdo funcional.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o elemento técnico.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Perfis</h3>
          <p className="painel-nota">Escolha um perfil para o editar em baixo.</p>
        </header>

        {perfis.length === 0 ? (
          <p className="estado-vazio">Ainda não há perfis. Crie o primeiro.</p>
        ) : (
          <ul className="lista-perfis-catalogo">
            {perfis.map((p) => {
              const numeroLote = lotePorPerfilId[p.id];
              const porResolver = validarPerfil(p);
              return (
                <li key={p.id} className={p.id === emEdicao?.id ? "perfil-catalogo perfil-catalogo-ativo" : "perfil-catalogo"}>
                  <button
                    type="button"
                    className="perfil-catalogo-alvo"
                    aria-current={p.id === emEdicao?.id ? "true" : undefined}
                    onClick={() => setIdEmEdicao(p.id)}
                  >
                    <strong>{p.perfil || "(perfil sem designação)"}</strong>
                    <span className="meta">
                      {p.requisitos.length} requisito(s) · {p.conteudoFuncional.length} atividade(s)
                      {numeroLote !== undefined && ` · lote ${numeroLote}`}
                      {" · "}
                      {porResolver.length === 0 ? (
                        <span className="estado-perfil">completo</span>
                      ) : (
                        <span className="estado-perfil estado-perfil-falta" title={porResolver.map((e) => e.mensagem).join("\n")}>
                          {porResolver.length === 1 ? porResolver[0].mensagem : `${porResolver.length} questões por resolver`}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="acoes-linha">
                    <button type="button" className="botao-discreto" onClick={() => duplicar(p)}>
                      Duplicar
                    </button>
                    <button type="button" className="botao-discreto botao-perigo" onClick={() => remover(p)}>
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={novoPerfil}>
            + Novo perfil
          </button>
          <button type="button" className="botao-secundario" onClick={() => inputImportarRef.current?.click()}>
            Importar perfis (JSON)
          </button>
          <button type="button" className="botao-secundario" onClick={carregarNormalizados}>
            Começar de perfis normalizados
          </button>
          <input
            ref={inputImportarRef}
            type="file"
            multiple
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) void importarJSON(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <p className="ajuda">
          Pode carregar vários ficheiros de uma vez, e cada ficheiro pode conter um ou mais perfis. Os perfis
          normalizados são perfis-base com conteúdo funcional e requisitos transversais de referência, aos quais se
          devem acrescentar requisitos tecnológicos específicos de cada projeto.
        </p>
      </section>

      {emEdicao !== null && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Identificação do perfil</h3>
            </header>

            <div className="linha-campos">
              <label className="campo-crescente">
                <span className="rotulo">Perfil</span>
                <input
                  type="text"
                  value={emEdicao.perfil}
                  placeholder="ex.: Arquiteto / Programador Sénior — Integração"
                  onChange={(e) => alterarEmEdicao({ perfil: e.target.value })}
                  aria-invalid={emEdicao.perfil.trim() === ""}
                />
                {emEdicao.perfil.trim() === "" && <span className="aviso-inline aviso-inline-falta">Dê um nome ao perfil.</span>}
              </label>
            </div>

            <div className="linha-campos linha-campos-eavalia">
              <label className="campo-crescente">
                <span className="rotulo">Designação do perfil</span>
                <select
                  className="campo-designacao-perfil"
                  value={emEdicao.designacao}
                  aria-invalid={emEdicao.designacao === ""}
                  onChange={(e) => alterarEmEdicao({ designacao: e.target.value as DesignacaoPerfil | "" })}
                >
                  <option value="">— por escolher —</option>
                  {DESIGNACOES_PERFIL.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {emEdicao.designacao === "" && <span className="aviso-inline aviso-inline-falta">Escolha a designação.</span>}
              </label>

              <label className="campo-crescente">
                <span className="rotulo">Tipo de Serviço</span>
                <select
                  className="campo-tipo-servico"
                  value={emEdicao.tipoServico}
                  aria-invalid={emEdicao.tipoServico === ""}
                  onChange={(e) => alterarEmEdicao({ tipoServico: e.target.value as TipoServico | "" })}
                >
                  <option value="">— por escolher —</option>
                  {TIPOS_SERVICO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {emEdicao.tipoServico === "" && (
                  <span className="aviso-inline aviso-inline-falta">Escolha o tipo de serviço.</span>
                )}
              </label>
            </div>
            <p className="ajuda">
              Obrigatórios. As opções destas duas listas são as disponibilizadas pela ARTE no formulário eAvalia e não
              admitem outras: escolha, em cada uma, a que melhor corresponda às funções efetivamente desempenhadas
              pelo perfil, ainda que a designação não coincida com o nome que lhe deu. Com as horas e o preço/hora
              do Módulo 3, preenchem a folha «Custos - Serviços» do eAvalia.
            </p>
          </section>

          <RequisitosEditor
            requisitos={emEdicao.requisitos}
            onChange={(requisitos) => alterarEmEdicao({ requisitos })}
          />

          <ListaItensEditor
            titulo={ROTULO_CERTIFICACOES}
            nota={
              "Opcional. Uma por linha. Saem no documento Word, em tabela própria; não aparecem em nenhum " +
              "formulário Excel, porque se verificam fora desta ferramenta, contra as peças da proposta."
            }
            nomeItem="formação ou certificação"
            rotuloColuna={`Designação da ${ROTULO_CERTIFICACAO.toLowerCase()}`}
            placeholder="ex.: Oracle Certified Professional, Java SE Programmer"
            textoVazio="Este perfil não exige formação nem certificação."
            rotuloAdicionar="+ Adicionar formação ou certificação"
            itens={emEdicao.certificacoes}
            onChange={(certificacoes) => alterarEmEdicao({ certificacoes })}
          />

          <ListaItensEditor
            titulo="Conteúdo Funcional do Perfil"
            nota={
              "Atividades que se espera que o perfil desempenhe, uma por linha. Saem no documento Word, em tabela " +
              "própria por baixo dos requisitos. A última é fixa e fecha a lista em todos os perfis: acrescente " +
              "pelo menos uma antes dela."
            }
            nomeItem="atividade"
            rotuloColuna="Designação da atividade"
            placeholder="ex.: Análise e levantamento de requisitos funcionais, não funcionais e de negócio"
            textoVazio="Ainda não há atividades. Acrescente a primeira."
            rotuloAdicionar="+ Adicionar atividade"
            itemFixo={ATIVIDADE_FIXA}
            itens={emEdicao.conteudoFuncional}
            onChange={(conteudoFuncional) => alterarEmEdicao({ conteudoFuncional })}
          />
        </>
      )}

      {erros.length > 0 && (
        <section className="painel painel-erros">
          <h3>
            {erros.length} {erros.length === 1 ? "questão por resolver" : "questões por resolver"}
          </h3>
          <ul className="lista-erros">
            {erros.map((e, idx) => (
              <li key={`${e.campo}-${idx}`}>{e.mensagem}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Saídas</h3>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-principal"
            onClick={() => void descarregarPerfis()}
            disabled={aGerar || !podeExportar}
          >
            {aGerar ? "A gerar…" : "Descarregar perfis (ZIP)"}
          </button>
        </div>
        <p className="ajuda">
          Um ZIP com o Excel e o JSON dos perfis. O Excel é o registo de quem prepara o procedimento: uma folha por
          perfil, com os requisitos, as formações ou certificações e o conteúdo funcional que aqui ficaram escritos.
          Não é o formulário que os concorrentes preenchem — esse sai do Módulo 3, já com os lotes. O JSON leva todos
          os perfis, para os retomar depois.
        </p>
        {nomeProjeto.trim() === "" && (
          <p className="aviso aviso-atencao" role="status">
            Ainda não há nome do projeto (Módulo 1 · Projeto): os ficheiros saem com um nome genérico.
          </p>
        )}
      </section>

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para o agrupamento em lotes</h3>
          <p className="painel-nota">Envia os perfis diretamente para o Módulo 3, sem passar por ficheiro.</p>
        </div>
        <button type="button" className="botao-principal" disabled={!podeExportar} onClick={onIrParaLotes}>
          Continuar para o agrupamento em lotes →
        </button>
      </section>
    </div>
  );
}
