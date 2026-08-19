import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { ConfiguracaoJSON, Declaracao } from "../core/types";
import { ErroImportacaoConfig, importarConfiguracaoJSON } from "../core/configuracao";
import { lerDeclaracaoExcel } from "../excel/ler";
import { proporAgrupamentos, type GrupoConcorrentes } from "../core/reconciliacao";
import { apurarEAgregar, type ResultadoConcorrente } from "../core/agregacao";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { ReconciliacaoConcorrentes } from "./ReconciliacaoConcorrentes";
import { ResultadosTabelas } from "./ResultadosTabelas";

function descarregarBlob(blob: Blob, nomeFicheiro: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Modulo2() {
  const [config, setConfig] = useState<ConfiguracaoJSON | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  const [grupos, setGrupos] = useState<GrupoConcorrentes[] | null>(null);
  const [aProcessar, setAProcessar] = useState(false);

  const inputConfigRef = useRef<HTMLInputElement>(null);
  const inputDeclaracoesRef = useRef<HTMLInputElement>(null);

  const nomesEntidade = useMemo(
    () => declaracoes.map((d) => d.identificacao.entidadeConcorrente).filter((n) => n.trim() !== ""),
    [declaracoes],
  );

  const resultados: ResultadoConcorrente[] | null = useMemo(() => {
    if (!config || grupos === null || declaracoes.length === 0) return null;
    return apurarEAgregar(declaracoes, config, grupos);
  }, [config, grupos, declaracoes]);

  async function carregarConfig(ficheiro: File) {
    setErroConfig(null);
    try {
      const texto = await ficheiro.text();
      setConfig(importarConfiguracaoJSON(texto));
      setDeclaracoes([]);
      setGrupos(null);
    } catch (erro) {
      setErroConfig(erro instanceof ErroImportacaoConfig ? erro.message : "Não foi possível carregar a configuração.");
    }
  }

  async function carregarDeclaracoes(ficheiros: FileList) {
    if (!config) return;
    setAProcessar(true);
    setGrupos(null);
    try {
      const lidas: Declaracao[] = [];
      for (const ficheiro of Array.from(ficheiros)) {
        const buffer = await ficheiro.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
        const { declaracao } = lerDeclaracaoExcel(ficheiro.name, workbook, config);
        lidas.push(declaracao);
      }
      setDeclaracoes(lidas);
    } finally {
      setAProcessar(false);
    }
  }

  function avancarParaReconciliacao() {
    setGrupos(proporAgrupamentos(nomesEntidade));
  }

  function exportar() {
    if (!config || !resultados) return;
    const blob = gerarResultadosBlob(resultados, config);
    descarregarBlob(blob, `Resultados_Avaliacao_${config.procedimento || "procedimento"}.xlsx`);
  }

  return (
    <div className="modulo">
      <h2>Módulo 2 — Avaliação</h2>

      <fieldset className="painel">
        <legend>Passo 1 — Configuração</legend>
        {config === null ? (
          <>
            <p>Carregue o ficheiro JSON de configuração exportado pelo Módulo 1. É obrigatório para prosseguir.</p>
            <button type="button" onClick={() => inputConfigRef.current?.click()}>
              Carregar configuração (JSON)
            </button>
          </>
        ) : (
          <p>
            Configuração carregada: procedimento <strong>{config.procedimento}</strong>, lote{" "}
            <strong>{config.lote}</strong>, {config.requisitos.length} requisito(s).{" "}
            <button type="button" onClick={() => inputConfigRef.current?.click()}>
              Trocar
            </button>
          </p>
        )}
        {erroConfig && <p className="mensagem-erro">{erroConfig}</p>}
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
      </fieldset>

      {config && (
        <fieldset className="painel">
          <legend>Passo 2 — Declarações a avaliar</legend>
          <button type="button" onClick={() => inputDeclaracoesRef.current?.click()} disabled={aProcessar}>
            {aProcessar ? "A carregar…" : "Carregar declarações (Excel, um ficheiro por elemento)"}
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
          {declaracoes.length > 0 && (
            <>
              <p>{declaracoes.length} ficheiro(s) carregado(s).</p>
              <ul>
                {declaracoes.map((d) => (
                  <li key={d.ficheiro}>
                    {d.ficheiro} — {d.identificacao.nome || "(nome por preencher)"} —{" "}
                    {d.identificacao.entidadeConcorrente || "(entidade por preencher)"}
                    {d.alertas.length > 0 && ` — ${d.alertas.length} alerta(s) estrutural(is)`}
                  </li>
                ))}
              </ul>
              {grupos === null && (
                <button type="button" onClick={avancarParaReconciliacao}>
                  Prosseguir para a reconciliação de concorrentes
                </button>
              )}
            </>
          )}
        </fieldset>
      )}

      {config && grupos !== null && (
        <fieldset className="painel">
          <legend>Passo 3 — Reconciliação de concorrentes</legend>
          <ReconciliacaoConcorrentes grupos={grupos} onChange={setGrupos} />
        </fieldset>
      )}

      {resultados && config && (
        <>
          <fieldset className="painel">
            <legend>Resultados</legend>
            <ResultadosTabelas resultados={resultados} config={config} />
          </fieldset>

          <fieldset className="painel">
            <legend>Exportação</legend>
            <button type="button" onClick={exportar}>
              Descarregar relatório Excel (5 folhas)
            </button>
          </fieldset>
        </>
      )}
    </div>
  );
}
