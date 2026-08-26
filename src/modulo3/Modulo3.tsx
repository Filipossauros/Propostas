import { useMemo, useRef, useState } from "react";
import type { Alerta, Declaracao, LotesJSON } from "../core/types";
import { ErroImportacao } from "../core/perfil";
import { AVISO_CERTIFICACAO, importarLotesJSON, perfisComCertificacao } from "../core/lotes";
import { LOTES_EXEMPLO, declaracoesExemplo } from "../core/exemplo";
import { lerDeclaracoesDoWorkbook, lerWorkbookDeFicheiro } from "../excel/ler";
import { agruparAtribuicoes, proporAtribuicoes, type AtribuicaoConcorrente } from "../core/reconciliacao";
import {
  avaliarProcedimento,
  type DeclaracaoAtribuida,
  type ResultadoProcedimento,
} from "../core/avaliacaoProcedimento";
import { resultadosParaJSON } from "../core/resultadosJSON";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { extrairTextoPdfNormalizado } from "../pdf/extrairTextoPdf";
import { extrairValoresDeclarados } from "../pdf/extrairValores";
import { compararComPdf } from "../pdf/comparar";
import { descarregarBlob, nomeComProjeto } from "../ui/descarregar";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { ReconciliacaoConcorrentes } from "./ReconciliacaoConcorrentes";
import { ResultadosTabelas } from "./ResultadosTabelas";

/** Requisitos de todos os perfis do agrupamento, para o comparador PDF. */
function requisitosPorId(config: LotesJSON): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) {
      for (const r of entrada.perfil.requisitos) mapa.set(r.id, r.designacao);
    }
  }
  return mapa;
}

interface Props {
  /** Entrega os resultados apurados ao Módulo 4, sem passar por ficheiro. */
  onIrParaOrdenacao: (resultado: ResultadoProcedimento, config: LotesJSON) => void;
}

export function Modulo3({ onIrParaOrdenacao }: Props) {
  const [config, setConfig] = useState<LotesJSON | null>(null);
  const [atribuidas, setAtribuidas] = useState<DeclaracaoAtribuida[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoConcorrente[] | null>(null);
  const [concorrentesConfirmados, setConcorrentesConfirmados] = useState(false);
  const [alertasPdf, setAlertasPdf] = useState<Map<string, Alerta[]>>(new Map());
  const [aCompararPdf, setACompararPdf] = useState<string | null>(null);
  const [aProcessar, setAProcessar] = useState(false);
  const [aExportar, setAExportar] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const inputConfigRef = useRef<HTMLInputElement>(null);
  const inputDeclaracoesRef = useRef<HTMLInputElement>(null);

  const nomesEntidade = useMemo(
    () =>
      atribuidas
        .map((a) => a.declaracao.identificacao.entidadeConcorrente)
        .filter((n) => n.trim() !== ""),
    [atribuidas],
  );

  /** Quantas declarações vieram com cada nome de entidade — o peso de cada cartão do passo 3. */
  const contagemPorNome = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const nome of nomesEntidade) contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    return contagem;
  }, [nomesEntidade]);

  /** Perfis que exigem certificação — verificada fora da aplicação, e por isso assinalada aqui. */
  const comCertificacao = useMemo(() => (config === null ? [] : perfisComCertificacao(config)), [config]);

  const resultado = useMemo(() => {
    if (config === null || atribuicoes === null || !concorrentesConfirmados || atribuidas.length === 0) return null;
    return avaliarProcedimento(config, atribuidas, agruparAtribuicoes(atribuicoes), alertasPdf);
  }, [config, atribuidas, atribuicoes, concorrentesConfirmados, alertasPdf]);

  const nPerfis = config?.lotes.reduce((soma, l) => soma + l.perfis.length, 0) ?? 0;

  function limparAvaliacao() {
    setAtribuidas([]);
    setAtribuicoes(null);
    setConcorrentesConfirmados(false);
    setAlertasPdf(new Map());
  }

  async function carregarConfig(ficheiro: File) {
    setMensagem(null);
    try {
      const importado = importarLotesJSON(await ficheiro.text());
      if (importado.lotes.length === 0) {
        setMensagem({ tipo: "erro", texto: "Este agrupamento não tem lotes." });
        return;
      }
      setConfig(importado);
      limparAvaliacao();
      setMensagem({
        tipo: "sucesso",
        texto: `Agrupamento carregado: ${importado.lotes.length} lote(s).`,
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível carregar o agrupamento.",
      });
    }
  }

  const podeCarregarExemplo = usePodeCarregarExemplo();

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    const exemplo = structuredClone(LOTES_EXEMPLO);
    setConfig(exemplo);
    const declaracoes = declaracoesExemplo(exemplo);
    setAtribuidas(declaracoes);
    setAtribuicoes(proporAtribuicoes(declaracoes.map((d) => d.declaracao.identificacao.entidadeConcorrente)));
    setConcorrentesConfirmados(true);
    setAlertasPdf(new Map());
    setMensagem({
      tipo: "sucesso",
      texto: `Exemplo carregado: ${declaracoes.length} declarações de 2 concorrentes, nos ${exemplo.lotes.length} lotes.`,
    });
  }

  function recomecar() {
    if (!confirm("Apagar a avaliação em curso e recomeçar do zero?")) return;
    setConfig(null);
    limparAvaliacao();
    setMensagem({ tipo: "sucesso", texto: "Avaliação reposta." });
  }

  async function carregarDeclaracoes(ficheiros: FileList) {
    if (config === null) return;
    setAProcessar(true);
    setAtribuicoes(null);
    setConcorrentesConfirmados(false);
    setAlertasPdf(new Map());
    try {
      const lidas: DeclaracaoAtribuida[] = [];
      const semCorrespondencia: string[] = [];

      for (const ficheiro of Array.from(ficheiros)) {
        const workbook = await lerWorkbookDeFicheiro(ficheiro);
        const doFicheiro = lerDeclaracoesDoWorkbook(ficheiro.name, workbook, config);
        if (doFicheiro.length === 0) semCorrespondencia.push(ficheiro.name);
        lidas.push(...doFicheiro);
      }

      setAtribuidas(lidas);
      setMensagem(
        semCorrespondencia.length > 0
          ? {
              tipo: "erro",
              texto:
                `${lidas.length} declaração(ões) lida(s). Sem folhas preenchidas que correspondam a um perfil ` +
                `deste agrupamento: ${semCorrespondencia.join(" · ")}`,
            }
          : { tipo: "sucesso", texto: `${lidas.length} declaração(ões) lida(s) e associada(s) aos respetivos lotes.` },
      );
    } finally {
      setAProcessar(false);
    }
  }

  /**
   * Retira uma declaração da avaliação.
   *
   * Chega ficheiro trocado, versão repetida, folha que afinal não era daquele
   * concorrente — e sem isto a única saída era recarregar tudo. Sai também o
   * alerta do PDF que lhe estivesse associado: sem declaração, não tem a que
   * respeitar.
   */
  function removerDeclaracao(id: string) {
    const restantes = atribuidas.filter((a) => a.declaracao.id !== id);
    setAtribuidas(restantes);
    setAlertasPdf((atual) => {
      const copia = new Map(atual);
      copia.delete(id);
      return copia;
    });

    // O passo 3 é refeito para os nomes que restam, mas as correções já feitas
    // aos nomes de relatório mantêm-se: quem removeu uma declaração não tem de
    // voltar a dizer quem é quem.
    setAtribuicoes((atual) => {
      if (atual === null) return null;
      const escolhido = new Map(atual.map((a) => [a.nomeOriginal, a.nomeCanonico]));
      return proporAtribuicoes(
        restantes.map((a) => a.declaracao.identificacao.entidadeConcorrente).filter((n) => n.trim() !== ""),
      ).map((a) => ({ ...a, nomeCanonico: escolhido.get(a.nomeOriginal) ?? a.nomeCanonico }));
    });

    setMensagem({ tipo: "sucesso", texto: "Declaração removida da avaliação." });
  }

  /** Retira só a comparação com o PDF, deixando a declaração onde está. */
  function removerPdf(id: string) {
    setAlertasPdf((atual) => {
      const copia = new Map(atual);
      copia.delete(id);
      return copia;
    });
  }

  async function compararComPdfAssinado(declaracao: Declaracao, ficheiroPdf: File) {
    if (config === null) return;
    setACompararPdf(declaracao.id);
    try {
      const textoPdf = await extrairTextoPdfNormalizado(ficheiroPdf);
      const alertas = compararComPdf(extrairValoresDeclarados(declaracao), textoPdf, requisitosPorId(config));
      setAlertasPdf((atual) => new Map(atual).set(declaracao.id, alertas));
    } catch {
      setMensagem({ tipo: "erro", texto: `Não foi possível ler o PDF de "${declaracao.ficheiro}".` });
    } finally {
      setACompararPdf(null);
    }
  }

  function descarregarResultadosJSON() {
    if (config === null || resultado === null) return;
    descarregarBlob(
      new Blob([resultadosParaJSON(resultado, config)], { type: "application/json" }),
      nomeComProjeto(config.nomeProjeto, "Resultados_Avaliacao.json"),
    );
  }

  async function exportar() {
    if (config === null || resultado === null) return;
    setAExportar(true);
    try {
      descarregarBlob(
        await gerarResultadosBlob(resultado, config),
        nomeComProjeto(config.nomeProjeto, "Resultados_Avaliacao.xlsx"),
      );
    } finally {
      setAExportar(false);
    }
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 3 · Avaliação de declarações</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">Apura o cumprimento dos requisitos mínimos das propostas.</p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Passo 1 · Agrupamento do procedimento</h3>
          <p className="painel-nota">Carregue o JSON do agrupamento (Módulo 2).</p>
        </header>

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputConfigRef.current?.click()}>
            {config === null ? "Carregar agrupamento (JSON)" : "Trocar agrupamento"}
          </button>
          <input
            ref={inputConfigRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void carregarConfig(ficheiro);
              e.target.value = "";
            }}
          />
        </div>

        {config !== null && (
          <ul className="lista-erros lista-sem-erro">
            <li>
              {config.nomeProjeto || "(projeto sem nome)"} · {config.lotes.length} lote(s), {nPerfis} perfil(is)
            </li>
            <li>
              Limitação de um lote por concorrente: <strong>{config.umLotePorConcorrente ? "sim" : "não"}</strong>
            </li>
          </ul>
        )}

        {/* A certificação não é apurada aqui — verifica-se nas peças da proposta.
            É precisamente por não entrar em nenhum quadro do apuramento que tem
            de ser dita em voz alta, logo ao carregar o agrupamento. Uma só vez:
            o aviso é o mesmo para todos os perfis. */}
        {comCertificacao.length > 0 && (
          <div className="aviso-certificacao">
            <p>{AVISO_CERTIFICACAO}</p>
            <ul>
              {comCertificacao.map((p) => (
                <li key={`${p.loteNumero}-${p.perfil}`}>
                  <strong>
                    Lote {p.loteNumero} · {p.perfil}
                  </strong>
                  <span className="meta">{p.certificacoes.join("; ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {config !== null && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Passo 2 · Declarações recebidas</h3>
            <p className="painel-nota">
              Carregue de uma vez todos os formulários entregues. Cada folha preenchida é associada ao lote e ao
              perfil que identifica, e todos os lotes são avaliados em conjunto.
            </p>
          </header>

          <div className="acoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => inputDeclaracoesRef.current?.click()}
              disabled={aProcessar}
            >
              {aProcessar ? "A carregar…" : "Carregar declarações (Excel)"}
            </button>
            <input
              ref={inputDeclaracoesRef}
              type="file"
              multiple
              accept=".xlsx"
              className="input-ficheiro-oculto"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void carregarDeclaracoes(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {atribuidas.length > 0 && (
            <>
              <ul className="lista-declaracoes">
                {atribuidas.map(({ declaracao: d }) => {
                  const alertasDoFicheiro = alertasPdf.get(d.id);
                  return (
                    <li key={d.id}>
                      <div className="declaracao-identificacao">
                        <strong>{d.identificacao.nome || "(nome por preencher)"}</strong>
                        <span className="meta">
                          Lote {d.identificacao.lote || "?"} · {d.identificacao.perfil} ·{" "}
                          {d.identificacao.entidadeConcorrente || "(entidade por preencher)"}
                          {d.alertas.length > 0 && ` · ${d.alertas.length} alerta(s)`}
                        </span>
                      </div>
                      <div className="acoes-linha">
                        <label className="anexar-pdf">
                          {aCompararPdf === d.id
                            ? "A comparar…"
                            : alertasDoFicheiro
                              ? alertasDoFicheiro.length === 0
                                ? "✓ PDF confirma o Excel"
                                : `${alertasDoFicheiro.length} divergência(s) com o PDF`
                              : "Anexar PDF assinado"}
                          <input
                            type="file"
                            accept=".pdf"
                            className="input-ficheiro-oculto"
                            onChange={(e) => {
                              const ficheiroPdf = e.target.files?.[0];
                              if (ficheiroPdf) void compararComPdfAssinado(d, ficheiroPdf);
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {alertasDoFicheiro !== undefined && (
                          <button
                            type="button"
                            className="botao-icone"
                            onClick={() => removerPdf(d.id)}
                            title="Retirar o PDF anexado"
                            aria-label={`Retirar o PDF anexado a "${d.identificacao.nome || d.ficheiro}"`}
                          >
                            ⌫
                          </button>
                        )}

                        <button
                          type="button"
                          className="botao-icone botao-perigo"
                          onClick={() => removerDeclaracao(d.id)}
                          title="Remover esta declaração"
                          aria-label={`Remover a declaração de "${d.identificacao.nome || d.ficheiro}"`}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="ajuda">
                O comparador PDF ↔ Excel deteta divergências de texto entre os dois documentos; não reconstrói a
                grelha célula a célula nem valida a assinatura digital. Em caso de divergência, o PDF assinado
                prevalece juridicamente — a aplicação apenas sinaliza.
              </p>

              {atribuicoes === null && (
                <button
                  type="button"
                  className="botao-principal"
                  onClick={() => setAtribuicoes(proporAtribuicoes(nomesEntidade))}
                >
                  Prosseguir para a reconciliação de concorrentes
                </button>
              )}
            </>
          )}
        </section>
      )}

      {config !== null && atribuicoes !== null && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Passo 3 · Quem é cada concorrente</h3>
            <p className="painel-nota">
              O concorrente de cada declaração é o nome que o próprio elemento escreveu no formulário. Quando a mesma
              empresa vem escrita de maneiras diferentes — «ABC» e «ABC, S.A.» —, contaria como duas propostas
              distintas, e nenhuma delas teria elementos suficientes. Linhas com o mesmo nome à direita são o mesmo
              concorrente: é assim que se juntam, e é dando-lhes nomes diferentes que se separam.
            </p>
          </header>

          <ReconciliacaoConcorrentes
            atribuicoes={atribuicoes}
            contagemPorNome={contagemPorNome}
            onChange={setAtribuicoes}
          />

          {concorrentesConfirmados ? (
            <p className="ajuda">
              Concorrentes confirmados. Qualquer correção feita aqui em cima refaz de imediato o apuramento em baixo.
            </p>
          ) : (
            <button type="button" className="botao-principal" onClick={() => setConcorrentesConfirmados(true)}>
              Confirmar concorrentes e apurar
            </button>
          )}
        </section>
      )}

      {resultado !== null && config !== null && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Resultados</h3>
            </header>
            <ResultadosTabelas resultado={resultado} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Exportação</h3>
              <p className="painel-nota">
                Uma folha com o resumo por lote e o desagregado por requisito, e uma folha de perfis por cada
                concorrente.
              </p>
            </header>
            <div className="acoes">
              <button type="button" className="botao-principal" onClick={() => void exportar()} disabled={aExportar}>
                {aExportar ? "A gerar…" : "Descarregar relatório Excel"}
              </button>
              <button type="button" className="botao-secundario" onClick={descarregarResultadosJSON}>
                Descarregar resultados (JSON)
              </button>
            </div>
            <p className="ajuda">
              O JSON leva o apuramento inteiro e é o que o Módulo 4 lê para ordenar as propostas. Como o relatório
              Excel, contém dados pessoais dos elementos propostos: guarde-o com o mesmo cuidado.
            </p>
          </section>

          <section className="painel painel-avancar">
            <div>
              <h3>Continuar para a ordenação das propostas</h3>
              <p className="painel-nota">Envia este apuramento diretamente para o Módulo 4, sem passar por ficheiro.</p>
            </div>
            <button type="button" className="botao-principal" onClick={() => onIrParaOrdenacao(resultado, config)}>
              Ir para o Módulo 4 →
            </button>
          </section>
        </>
      )}
    </div>
  );
}
