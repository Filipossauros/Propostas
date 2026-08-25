import { useRef, useState } from "react";
import type { EspecificacaoFormulario, PerfilJSON } from "../core/types";
import {
  ErroImportacao,
  duplicarPerfil,
  importarPerfisJSON,
  perfilInicial,
  perfisParaJSON,
  validarNomeProjeto,
  validarPerfis,
} from "../core/perfil";
import { NOME_PROJETO_EXEMPLO, PERFIS_EXEMPLO } from "../core/exemplo";
import { PERFIS_NORMALIZADOS } from "../core/perfisNormalizados";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { descarregarBlob, nomeComProjeto, nomeSeguro } from "../ui/descarregar";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { RequisitosEditor } from "./RequisitosEditor";
import { ListaItensEditor } from "./ListaItensEditor";

interface Props {
  perfis: PerfilJSON[];
  onAlterarPerfis: (perfis: PerfilJSON[]) => void;
  nomeProjeto: string;
  onAlterarNomeProjeto: (nome: string) => void;
  /** Aceita o nome vindo de um ficheiro importado, se ainda não houver um definido. */
  onAdotarNomeProjeto: (nome: string) => void;
  /** Número do lote a que cada perfil já está atribuído, indexado pelo id do perfil. */
  lotePorPerfilId: Record<string, string>;
  onIrParaLotes: () => void;
}

export function Modulo1({
  perfis,
  onAlterarPerfis,
  nomeProjeto,
  onAlterarNomeProjeto,
  onAdotarNomeProjeto,
  lotePorPerfilId,
  onIrParaLotes,
}: Props) {
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);

  const erros = [...validarNomeProjeto(nomeProjeto), ...validarPerfis(perfis)];
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

  function especificacoes(): EspecificacaoFormulario[] {
    return perfis.map((p) => ({
      perfil: p.perfil,
      nBlocos: p.nBlocos,
      requisitos: p.requisitos,
      lote: lotePorPerfilId[p.id],
    }));
  }

  async function gerarExcel() {
    setMensagem(null);
    setAGerar(true);
    try {
      const resto =
        perfis.length === 1
          ? `Declaracao_Experiencia_${nomeSeguro(perfis[0].perfil, "Perfil")}.xlsx`
          : "Declaracoes_Experiencia.xlsx";
      descarregarBlob(await gerarDeclaracaoExcelBlob(especificacoes()), nomeComProjeto(nomeProjeto, resto));
    } finally {
      setAGerar(false);
    }
  }

  function descarregarJSON() {
    setMensagem(null);
    descarregarBlob(
      new Blob([perfisParaJSON(perfis, nomeProjeto)], { type: "application/json" }),
      nomeComProjeto(nomeProjeto, "Perfis.json"),
    );
  }

  async function importarJSON(ficheiros: FileList) {
    const carregados: PerfilJSON[] = [];
    const falhados: string[] = [];
    let nomeDeFicheiro = "";

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const importado = importarPerfisJSON(await ficheiro.text());
        carregados.push(...importado.perfis);
        if (nomeDeFicheiro === "") nomeDeFicheiro = importado.nomeProjeto;
      } catch (erro) {
        falhados.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    onAdotarNomeProjeto(nomeDeFicheiro);

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
    onAlterarNomeProjeto(NOME_PROJETO_EXEMPLO);
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
    if (!confirm("Apagar todos os perfis em edição e o nome do projeto, e recomeçar do zero?")) return;
    onAlterarPerfis([]);
    // O nome do projeto vai com eles: sem dados, a aplicação apresenta-se como
    // se fosse a primeira vez — e o nome de um projeto anterior num campo
    // preenchido é o género de resto que acaba dentro de uma peça.
    onAlterarNomeProjeto("");
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Perfis e nome do projeto repostos." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 1 · Definição dos perfis</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">Define os requisitos mínimos de experiência de um perfil.</p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <label className="campo-largo">
          <span className="rotulo">Nome do projeto</span>
          <input
            type="text"
            value={nomeProjeto}
            placeholder="ex.: Modernização dos sistemas de informação"
            onChange={(e) => onAlterarNomeProjeto(e.target.value)}
            aria-invalid={nomeProjeto.trim() === ""}
          />
        </label>
        <p className="ajuda">Identifica o projeto e dá nome a todos os ficheiros descarregados, nos dois módulos.</p>
      </section>

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
                      {p.requisitos.length} requisito(s) · {p.nBlocos} blocos
                      {numeroLote !== undefined && ` · lote ${numeroLote}`}
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
          normalizados são os perfis-base da entidade — conteúdo funcional e requisitos transversais —, aos quais
          se acrescentam depois os requisitos tecnológicos de cada procedimento.
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
              </label>

              <label className="campo-estreito">
                <span className="rotulo" title="Quantos projetos distintos cada candidato poderá declarar">
                  N.º de blocos
                </span>
                <CampoNumero
                  valor={emEdicao.nBlocos}
                  min={1}
                  step={1}
                  sufixo="blocos"
                  invalido={!Number.isInteger(emEdicao.nBlocos) || emEdicao.nBlocos < 1}
                  onChange={(nBlocos) => alterarEmEdicao({ nBlocos })}
                />
              </label>
            </div>
          </section>

          <RequisitosEditor
            requisitos={emEdicao.requisitos}
            onChange={(requisitos) => alterarEmEdicao({ requisitos })}
          />

          <ListaItensEditor
            titulo="Certificações"
            nota={
              "Opcional. Uma certificação por linha. Saem no documento Word, em tabela própria; não aparecem em " +
              "nenhum formulário Excel, porque a certificação é verificada fora desta ferramenta, contra as peças " +
              "da proposta."
            }
            nomeItem="certificação"
            rotuloColuna="Designação da certificação"
            placeholder="ex.: Oracle Certified Professional, Java SE Programmer"
            textoVazio="Este perfil não exige certificações."
            rotuloAdicionar="+ Adicionar certificação"
            itens={emEdicao.certificacoes}
            onChange={(certificacoes) => alterarEmEdicao({ certificacoes })}
          />

          <ListaItensEditor
            titulo="Conteúdo Funcional do Perfil"
            nota={
              "Atividades que se espera que o perfil desempenhe, uma por linha. Saem no documento Word, em tabela " +
              "própria por baixo dos requisitos; não aparecem em nenhum formulário Excel."
            }
            nomeItem="atividade"
            rotuloColuna="Designação da atividade"
            placeholder="ex.: Análise e levantamento de requisitos funcionais, não funcionais e de negócio"
            textoVazio="Ainda não há atividades. Acrescente a primeira."
            rotuloAdicionar="+ Adicionar atividade"
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
          <button type="button" className="botao-principal" onClick={gerarExcel} disabled={aGerar || !podeExportar}>
            {aGerar ? "A gerar…" : "Descarregar formulário Excel"}
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarJSON} disabled={!podeExportar}>
            Descarregar perfis (JSON)
          </button>
        </div>
        <p className="ajuda">
          Um ficheiro Excel único, com uma folha por perfil, e um ficheiro JSON único com todos os perfis.
        </p>
      </section>

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para o agrupamento em lotes</h3>
          <p className="painel-nota">Envia este perfil diretamente para o Módulo 2, sem passar por ficheiro.</p>
        </div>
        <button type="button" className="botao-principal" disabled={!podeExportar} onClick={onIrParaLotes}>
          Ir para o Módulo 2 →
        </button>
      </section>
    </div>
  );
}
