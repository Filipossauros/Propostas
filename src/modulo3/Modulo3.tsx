import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Alerta, ConfiguracaoAvaliacao, Declaracao, LotesJSON, PerfilJSON } from "../core/types";
import { ErroImportacao, importarPerfisJSON, lerTipoConfiguracao } from "../core/perfil";
import { importarLotesJSON } from "../core/lotes";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { lerDeclaracaoExcel } from "../excel/ler";
import { proporAgrupamentos, type GrupoConcorrentes } from "../core/reconciliacao";
import { apurarEAgregar, type ResultadoConcorrente } from "../core/agregacao";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { extrairTextoPdfNormalizado } from "../pdf/extrairTextoPdf";
import { extrairValoresDeclarados } from "../pdf/extrairValores";
import { compararComPdf } from "../pdf/comparar";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { CampoNumero } from "../ui/CampoNumero";
import { ReconciliacaoConcorrentes } from "./ReconciliacaoConcorrentes";
import { ResultadosTabelas } from "./ResultadosTabelas";

/** Um perfil escolhido para avaliação, com o contexto de lote quando existe. */
interface PerfilEscolhivel {
  chave: string;
  etiqueta: string;
  perfil: PerfilJSON;
  nMinimoElementos: number;
}

function perfisDeLotes(lotes: LotesJSON): PerfilEscolhivel[] {
  return lotes.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => ({
      chave: entrada.id,
      etiqueta: `Lote ${lote.numero} · ${entrada.perfil.perfil}`,
      perfil: entrada.perfil,
      nMinimoElementos: entrada.nMinimoElementos,
    })),
  );
}

export function Modulo3() {
  const [disponiveis, setDisponiveis] = useState<PerfilEscolhivel[]>([]);
  const [chaveEscolhida, setChaveEscolhida] = useState<string>("");
  const [dataLimite, setDataLimite] = useState<string>("");
  const [nMinimoElementos, setNMinimoElementos] = useState<number>(1);

  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  const [grupos, setGrupos] = useState<GrupoConcorrentes[] | null>(null);
  const [alertasPdf, setAlertasPdf] = useState<Map<string, Alerta[]>>(new Map());
  const [aCompararPdf, setACompararPdf] = useState<string | null>(null);
  const [aProcessar, setAProcessar] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const inputConfigRef = useRef<HTMLInputElement>(null);
  const inputDeclaracoesRef = useRef<HTMLInputElement>(null);

  const escolhido = disponiveis.find((p) => p.chave === chaveEscolhida) ?? null;

  const config: ConfiguracaoAvaliacao | null = useMemo(() => {
    if (escolhido === null || dataLimite === "") return null;
    return {
      perfil: escolhido.perfil.perfil,
      nBlocos: escolhido.perfil.nBlocos,
      requisitos: escolhido.perfil.requisitos,
      nMinimoElementos,
      dataLimitePropostas: dataLimite,
    };
  }, [escolhido, dataLimite, nMinimoElementos]);

  const nomesEntidade = useMemo(
    () => declaracoes.map((d) => d.identificacao.entidadeConcorrente).filter((n) => n.trim() !== ""),
    [declaracoes],
  );

  const resultados: ResultadoConcorrente[] | null = useMemo(() => {
    if (config === null || grupos === null || declaracoes.length === 0) return null;
    try {
      return apurarEAgregar(declaracoes, config, grupos, alertasPdf);
    } catch {
      // A data limite é validada antes de chegar aqui; se ainda assim falhar,
      // preferimos não apresentar resultados a apresentar resultados errados.
      return null;
    }
  }, [config, grupos, declaracoes, alertasPdf]);

  function aplicarOpcoes(opcoes: PerfilEscolhivel[], textoSucesso: string) {
    setDisponiveis(opcoes);
    setChaveEscolhida(opcoes[0].chave);
    setNMinimoElementos(opcoes[0].nMinimoElementos);
    setDeclaracoes([]);
    setGrupos(null);
    setAlertasPdf(new Map());
    setMensagem({ tipo: "sucesso", texto: textoSucesso });
  }

  async function carregarConfig(ficheiro: File) {
    setMensagem(null);
    try {
      const texto = await ficheiro.text();
      const tipo = lerTipoConfiguracao(texto);

      let opcoes: PerfilEscolhivel[];
      if (tipo === "lotes") {
        opcoes = perfisDeLotes(importarLotesJSON(texto));
        if (opcoes.length === 0) {
          setMensagem({ tipo: "erro", texto: "Este agrupamento não tem perfis atribuídos a lotes." });
          return;
        }
      } else if (tipo === "perfil" || tipo === "perfis") {
        opcoes = importarPerfisJSON(texto).perfis.map((perfil) => ({
          chave: perfil.id,
          etiqueta: perfil.perfil,
          perfil,
          nMinimoElementos: 1,
        }));
        if (opcoes.length === 0) {
          setMensagem({ tipo: "erro", texto: "Este ficheiro não contém perfis." });
          return;
        }
      } else {
        setMensagem({ tipo: "erro", texto: `Tipo de ficheiro não reconhecido: "${tipo}".` });
        return;
      }

      aplicarOpcoes(opcoes, `Configuração carregada (${opcoes.length} perfil(is)).`);
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível carregar a configuração.",
      });
    }
  }

  function carregarExemplo() {
    aplicarOpcoes(perfisDeLotes(LOTES_EXEMPLO), "Configuração de exemplo carregada.");
    setDataLimite("2027-03-31");
  }

  function escolherPerfil(chave: string) {
    setChaveEscolhida(chave);
    const opcao = disponiveis.find((p) => p.chave === chave);
    if (opcao) setNMinimoElementos(opcao.nMinimoElementos);
    setDeclaracoes([]);
    setGrupos(null);
    setAlertasPdf(new Map());
  }

  async function carregarDeclaracoes(ficheiros: FileList) {
    if (config === null) return;
    setAProcessar(true);
    setGrupos(null);
    setAlertasPdf(new Map());
    try {
      const lidas: Declaracao[] = [];
      for (const ficheiro of Array.from(ficheiros)) {
        const buffer = await ficheiro.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
        lidas.push(lerDeclaracaoExcel(ficheiro.name, workbook, config).declaracao);
      }
      setDeclaracoes(lidas);
    } finally {
      setAProcessar(false);
    }
  }

  async function compararComPdfAssinado(declaracao: Declaracao, ficheiroPdf: File) {
    if (config === null) return;
    setACompararPdf(declaracao.id);
    try {
      const textoPdf = await extrairTextoPdfNormalizado(ficheiroPdf);
      const requisitosPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
      const alertas = compararComPdf(extrairValoresDeclarados(declaracao), textoPdf, requisitosPorId);
      setAlertasPdf((atual) => new Map(atual).set(declaracao.id, alertas));
    } catch {
      setMensagem({ tipo: "erro", texto: `Não foi possível ler o PDF de "${declaracao.ficheiro}".` });
    } finally {
      setACompararPdf(null);
    }
  }

  function exportar() {
    if (config === null || resultados === null) return;
    descarregarBlob(
      gerarResultadosBlob(resultados, config),
      `Resultados_${nomeSeguro(config.perfil, "avaliacao")}.xlsx`,
    );
  }

  const prontoParaDeclaracoes = config !== null;

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 3 · Avaliação de declarações</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          Apura o cumprimento dos requisitos mínimos, de forma binária. Não ordena propostas nem pontua desempenho —
          sinaliza, e a decisão é do júri. Carregue o ficheiro de lotes do Módulo 2 e as declarações recebidas.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Passo 1 · Configuração</h3>
          <p className="painel-nota">
            Carregue o JSON do agrupamento de lotes (Módulo 2) ou dos perfis (Módulo 1).
          </p>
        </header>

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputConfigRef.current?.click()}>
            {disponiveis.length === 0 ? "Carregar configuração (JSON)" : "Trocar configuração"}
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

        {disponiveis.length > 0 && (
          <div className="grelha-campos">
            <label className="campo-largo">
              <span className="rotulo">Perfil a avaliar</span>
              <select value={chaveEscolhida} onChange={(e) => escolherPerfil(e.target.value)}>
                {disponiveis.map((p) => (
                  <option key={p.chave} value={p.chave}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="rotulo">Data limite para apresentação de propostas</span>
              <input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} aria-invalid={dataLimite === ""} />
              <span className="ajuda">Nenhuma experiência é admitida com data posterior a esta.</span>
            </label>

            <label>
              <span className="rotulo">N.º mínimo de elementos exigido</span>
              <CampoNumero
                valor={nMinimoElementos}
                min={1}
                step={1}
                invalido={!Number.isInteger(nMinimoElementos) || nMinimoElementos < 1}
                onChange={setNMinimoElementos}
              />
            </label>
          </div>
        )}

        {disponiveis.length > 0 && dataLimite === "" && (
          <p className="aviso aviso-atencao">
            Indique a data limite para apresentação de propostas antes de carregar declarações.
          </p>
        )}
      </section>

      {prontoParaDeclaracoes && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Passo 2 · Declarações a avaliar</h3>
          </header>

          <div className="acoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => inputDeclaracoesRef.current?.click()}
              disabled={aProcessar}
            >
              {aProcessar ? "A carregar…" : "Carregar declarações (Excel, uma por elemento)"}
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

          {declaracoes.length > 0 && (
            <>
              <ul className="lista-declaracoes">
                {declaracoes.map((d) => {
                  const alertasDoFicheiro = alertasPdf.get(d.id);
                  return (
                    <li key={d.id}>
                      <div className="declaracao-identificacao">
                        <strong>{d.identificacao.nome || "(nome por preencher)"}</strong>
                        <span className="meta">
                          {d.ficheiro} · {d.identificacao.entidadeConcorrente || "(entidade por preencher)"}
                          {d.alertas.length > 0 && ` · ${d.alertas.length} alerta(s)`}
                        </span>
                      </div>
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
                    </li>
                  );
                })}
              </ul>

              <p className="ajuda">
                O comparador PDF ↔ Excel deteta divergências de texto entre os dois documentos; não reconstrói a
                grelha célula a célula nem valida a assinatura digital. Em caso de divergência, o PDF assinado
                prevalece juridicamente — a aplicação apenas sinaliza.
              </p>

              {grupos === null && (
                <button
                  type="button"
                  className="botao-principal"
                  onClick={() => setGrupos(proporAgrupamentos(nomesEntidade))}
                >
                  Prosseguir para a reconciliação de concorrentes
                </button>
              )}
            </>
          )}
        </section>
      )}

      {config && grupos !== null && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Passo 3 · Reconciliação de concorrentes</h3>
          </header>
          <ReconciliacaoConcorrentes grupos={grupos} onChange={setGrupos} />
        </section>
      )}

      {resultados && config && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Resultados</h3>
            </header>
            <ResultadosTabelas resultados={resultados} config={config} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Exportação</h3>
              <p className="painel-nota">
                O relatório inclui o traço de apuramento, para que qualquer terceiro possa reconstituir o cálculo à
                mão.
              </p>
            </header>
            <button type="button" className="botao-principal" onClick={exportar}>
              Descarregar relatório Excel (5 folhas)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
