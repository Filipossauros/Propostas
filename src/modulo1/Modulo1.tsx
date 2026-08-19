import { useRef, useState } from "react";
import type { ConfiguracaoJSON } from "../core/types";
import { SCHEMA_VERSION_ATUAL } from "../core/types";
import {
  ErroImportacaoConfig,
  configuracaoParaJSON,
  gerarTextoCadernoEncargos,
  importarConfiguracaoJSON,
  validarConfiguracao,
} from "../core/configuracao";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { ConfigForm } from "./ConfigForm";
import { RequisitosEditor } from "./RequisitosEditor";

function configuracaoInicial(): ConfiguracaoJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    templateVersion: "5.0",
    procedimento: "",
    lote: "",
    perfil: "",
    nMinimoElementos: 1,
    dataLimitePropostas: "",
    nBlocos: 15,
    requisitos: [],
  };
}

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

function nomeBase(config: ConfiguracaoJSON): string {
  const partes = [config.procedimento, config.lote].filter((p) => p.trim() !== "");
  return partes.length > 0 ? `Declaracao_Experiencia_${partes.join("_")}` : "Declaracao_Experiencia";
}

export function Modulo1() {
  const [config, setConfig] = useState<ConfiguracaoJSON>(configuracaoInicial());
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);

  const erros = validarConfiguracao(config);
  const textoCaderno = config.requisitos.length > 0 ? gerarTextoCadernoEncargos(config.requisitos) : "";

  function patchConfig(patch: Partial<ConfiguracaoJSON>) {
    setConfig((atual) => ({ ...atual, ...patch }));
  }

  async function gerarExcel() {
    setMensagem(null);
    if (erros.length > 0) {
      setMensagem({ tipo: "erro", texto: "Corrija os erros de validação antes de gerar o ficheiro." });
      return;
    }
    setAGerar(true);
    try {
      const blob = await gerarDeclaracaoExcelBlob(config);
      descarregarBlob(blob, `${nomeBase(config)}.xlsx`);
    } finally {
      setAGerar(false);
    }
  }

  function descarregarJSON() {
    setMensagem(null);
    if (erros.length > 0) {
      setMensagem({ tipo: "erro", texto: "Corrija os erros de validação antes de exportar o JSON." });
      return;
    }
    const blob = new Blob([configuracaoParaJSON(config)], { type: "application/json" });
    descarregarBlob(blob, `${nomeBase(config)}.json`);
  }

  async function copiarTextoCaderno() {
    try {
      await navigator.clipboard.writeText(textoCaderno);
      setMensagem({ tipo: "sucesso", texto: "Texto copiado para a área de transferência." });
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível copiar automaticamente. Selecione e copie o texto manualmente." });
    }
  }

  async function importarJSON(ficheiro: File) {
    try {
      const texto = await ficheiro.text();
      const importado = importarConfiguracaoJSON(texto);
      setConfig(importado);
      setMensagem({ tipo: "sucesso", texto: "Configuração importada com sucesso." });
    } catch (erro) {
      const texto = erro instanceof ErroImportacaoConfig ? erro.message : "Não foi possível importar o ficheiro.";
      setMensagem({ tipo: "erro", texto });
    }
  }

  return (
    <div className="modulo">
      <h2>Módulo 1 — Definição de requisitos</h2>

      {mensagem && <p className={mensagem.tipo === "erro" ? "mensagem-erro" : "mensagem-sucesso"}>{mensagem.texto}</p>}

      <ConfigForm config={config} onChange={patchConfig} />
      <RequisitosEditor requisitos={config.requisitos} onChange={(requisitos) => patchConfig({ requisitos })} />

      {erros.length > 0 && (
        <div className="painel painel-erros">
          <p>
            <strong>{erros.length}</strong> erro(s) de validação:
          </p>
          <ul>
            {erros.map((e) => (
              <li key={e.campo}>{e.mensagem}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="painel">
        <legend>Saídas</legend>
        <div className="acoes">
          <button type="button" onClick={gerarExcel} disabled={aGerar}>
            {aGerar ? "A gerar…" : "Descarregar formulário Excel"}
          </button>
          <button type="button" onClick={descarregarJSON}>
            Descarregar configuração (JSON)
          </button>
          <button type="button" onClick={() => inputImportarRef.current?.click()}>
            Importar configuração (JSON)
          </button>
          <input
            ref={inputImportarRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importarJSON(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
      </fieldset>

      {textoCaderno !== "" && (
        <fieldset className="painel">
          <legend>Texto para o caderno de encargos</legend>
          <pre className="texto-caderno">{textoCaderno}</pre>
          <button type="button" onClick={copiarTextoCaderno}>
            Copiar para a área de transferência
          </button>
        </fieldset>
      )}
    </div>
  );
}
