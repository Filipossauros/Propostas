import { useRef, useState } from "react";
import JSZip from "jszip";
import type { EspecificacaoFormulario, Lote, LotesJSON, PerfilEmLote, PerfilJSON } from "../core/types";
import { SCHEMA_VERSION_ATUAL } from "../core/types";
import { ErroImportacao, importarPerfilJSON } from "../core/perfil";
import {
  criarLote,
  criarPerfilEmLote,
  importarLotesJSON,
  lotesIniciais,
  lotesParaJSON,
  taxaIva,
  validarLotes,
} from "../core/lotes";
import { documentoCadernoEncargos, documentoProgramaConcurso } from "../core/cadernoEncargos";
import { gerarDocxBlob } from "../word/gerarDocx";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { CHAVE_LOTES, PERSISTENCIA_DISPONIVEL } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { gerarLotesBlob } from "../excel/exportarLotes";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { EditorLote } from "./EditorLote";
import { TabelaValores } from "./TabelaValores";

interface Props {
  /** Perfis carregados ou enviados pelo Módulo 1, à espera de serem atribuídos. */
  porAtribuir: PerfilJSON[];
  onAlterarPorAtribuir: (atualizar: (atual: PerfilJSON[]) => PerfilJSON[]) => void;
  /** Devolve um perfil ao Módulo 1 para edição, e muda de separador. */
  onImportarParaEdicao: (perfil: PerfilJSON) => void;
}

function todasAsEntradas(config: LotesJSON): Array<{ lote: Lote; entrada: PerfilEmLote }> {
  return config.lotes.flatMap((lote) => lote.perfis.map((entrada) => ({ lote, entrada })));
}

function nomeFormulario(numeroLote: string, perfil: PerfilJSON, extensao: string): string {
  return `Declaracao_Lote${nomeSeguro(numeroLote, "X")}_${nomeSeguro(perfil.perfil, "Perfil")}.${extensao}`;
}

function ehLotesGuardado(valor: unknown): valor is LotesJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Partial<LotesJSON>;
  return l.tipo === "lotes" && l.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(l.lotes);
}

export function Modulo2({ porAtribuir, onAlterarPorAtribuir, onImportarParaEdicao }: Props) {
  const [config, setConfig] = useEstadoPersistente<LotesJSON>(CHAVE_LOTES, lotesIniciais, ehLotesGuardado);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aZipar, setAZipar] = useState(false);
  const inputPerfisRef = useRef<HTMLInputElement>(null);
  const inputLotesRef = useRef<HTMLInputElement>(null);
  const inputEditarPerfilRef = useRef<HTMLInputElement>(null);

  const erros = validarLotes(config);
  const podeExportar = erros.length === 0;
  const temFormularios = todasAsEntradas(config).length > 0;

  function atualizarLote(loteId: string, alteracao: Partial<Lote>) {
    setConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) => (l.id === loteId ? { ...l, ...alteracao } : l)),
    }));
  }

  function adicionarLote() {
    setConfig((atual) => ({ ...atual, lotes: [...atual.lotes, criarLote(String(atual.lotes.length + 1))] }));
  }

  function removerLote(loteId: string) {
    const lote = config.lotes.find((l) => l.id === loteId);
    if (lote) onAlterarPorAtribuir((p) => [...p, ...lote.perfis.map((e) => e.perfil)]);
    setConfig((atual) => ({ ...atual, lotes: atual.lotes.filter((l) => l.id !== loteId) }));
  }

  function atribuirPerfil(loteId: string, indicePorAtribuir: number) {
    const perfil = porAtribuir[indicePorAtribuir];
    if (!perfil) return;
    onAlterarPorAtribuir((p) => p.filter((_, i) => i !== indicePorAtribuir));
    setConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) =>
        l.id === loteId ? { ...l, perfis: [...l.perfis, criarPerfilEmLote(perfil)] } : l,
      ),
    }));
  }

  function retirarPerfil(loteId: string, perfilEmLoteId: string) {
    const entrada = config.lotes.find((l) => l.id === loteId)?.perfis.find((e) => e.id === perfilEmLoteId);
    if (entrada) onAlterarPorAtribuir((p) => [...p, entrada.perfil]);
    setConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) =>
        l.id === loteId ? { ...l, perfis: l.perfis.filter((e) => e.id !== perfilEmLoteId) } : l,
      ),
    }));
  }

  async function carregarPerfis(ficheiros: FileList) {
    const carregados: PerfilJSON[] = [];
    const falhados: string[] = [];

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        carregados.push(importarPerfilJSON(await ficheiro.text()));
      } catch (erro) {
        falhados.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    if (carregados.length > 0) onAlterarPorAtribuir((p) => [...p, ...carregados]);

    setMensagem(
      falhados.length > 0
        ? { tipo: "erro", texto: `Não foi possível carregar: ${falhados.join(" · ")}` }
        : { tipo: "sucesso", texto: `${carregados.length} perfil(is) carregado(s). Atribua-os aos lotes abaixo.` },
    );
  }

  async function carregarLotes(ficheiro: File) {
    try {
      setConfig(importarLotesJSON(await ficheiro.text()));
      onAlterarPorAtribuir(() => []);
      setMensagem({ tipo: "sucesso", texto: "Agrupamento de lotes importado." });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  function carregarExemplo() {
    setConfig(structuredClone(LOTES_EXEMPLO));
    onAlterarPorAtribuir(() => []);
    setMensagem({ tipo: "sucesso", texto: "Agrupamento de exemplo carregado." });
  }

  async function importarParaEdicao(ficheiro: File) {
    try {
      onImportarParaEdicao(importarPerfilJSON(await ficheiro.text()));
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  function descarregarJSON() {
    descarregarBlob(new Blob([lotesParaJSON(config)], { type: "application/json" }), "Lotes.json");
  }

  async function descarregarExcel() {
    descarregarBlob(await gerarLotesBlob(config), "Lotes.xlsx");
  }

  async function descarregarWord() {
    const blob = await gerarDocxBlob([documentoCadernoEncargos(config), documentoProgramaConcurso(config)]);
    descarregarBlob(blob, "Requisitos_e_regras.docx");
  }

  async function descarregarFormulario(perfil: PerfilJSON, numeroLote: string) {
    const especificacao: EspecificacaoFormulario = { ...perfil, lote: numeroLote };
    descarregarBlob(await gerarDeclaracaoExcelBlob(especificacao), nomeFormulario(numeroLote, perfil, "xlsx"));
  }

  async function descarregarTodosFormulariosExcel() {
    setAZipar(true);
    try {
      const zip = new JSZip();
      for (const { lote, entrada } of todasAsEntradas(config)) {
        const especificacao: EspecificacaoFormulario = { ...entrada.perfil, lote: lote.numero };
        zip.file(nomeFormulario(lote.numero, entrada.perfil, "xlsx"), await gerarDeclaracaoExcelBlob(especificacao));
      }
      descarregarBlob(await zip.generateAsync({ type: "blob" }), "Formularios_Declaracao_Excel.zip");
    } finally {
      setAZipar(false);
    }
  }

  async function descarregarTodosFormulariosJSON() {
    setAZipar(true);
    try {
      const zip = new JSZip();
      for (const { lote, entrada } of todasAsEntradas(config)) {
        const especificacao: EspecificacaoFormulario = {
          perfil: entrada.perfil.perfil,
          nBlocos: entrada.perfil.nBlocos,
          requisitos: entrada.perfil.requisitos,
          lote: lote.numero,
        };
        zip.file(nomeFormulario(lote.numero, entrada.perfil, "json"), JSON.stringify(especificacao, null, 2));
      }
      descarregarBlob(await zip.generateAsync({ type: "blob" }), "Formularios_Declaracao_JSON.zip");
    } finally {
      setAZipar(false);
    }
  }

  function recomecar() {
    if (!confirm("Apagar o agrupamento em edição e recomeçar do zero?")) return;
    setConfig(lotesIniciais());
    onAlterarPorAtribuir(() => []);
    setMensagem({ tipo: "sucesso", texto: "Agrupamento reposto." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 2 · Agrupamento em lotes</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          Recebe os perfis definidos no Módulo 1 — enviados diretamente ou carregados de ficheiro —, agrupa-os em
          lotes e atribui a cada um as horas, o preço unitário e o n.º mínimo de elementos.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Importar perfil para edição</h3>
          <p className="painel-nota">
            Carregue um ficheiro JSON de perfil para o corrigir no Módulo 1. A aplicação muda automaticamente de
            separador.
          </p>
        </header>
        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputEditarPerfilRef.current?.click()}>
            Importar perfil (JSON) para edição
          </button>
          <input
            ref={inputEditarPerfilRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importarParaEdicao(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Parâmetros do procedimento</h3>
        </header>
        <div className="grelha-campos">
          <label>
            <span className="rotulo">Nome do procedimento</span>
            <input
              type="text"
              value={config.nomeProcedimento}
              onChange={(e) => setConfig((atual) => ({ ...atual, nomeProcedimento: e.target.value }))}
            />
          </label>

          <label className="campo-estreito">
            <span className="rotulo">Taxa de IVA</span>
            <CampoNumero
              valor={taxaIva(config)}
              min={0}
              step={1}
              sufixo="%"
              invalido={!(taxaIva(config) >= 0)}
              onChange={(valor) => setConfig((atual) => ({ ...atual, taxaIva: valor }))}
            />
          </label>
        </div>
        <p className="ajuda">Todos os preços unitários são introduzidos sem IVA.</p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Perfis por atribuir</h3>
          <p className="painel-nota">
            Aparecem aqui os perfis enviados pelo Módulo 1. Também pode carregar ficheiros JSON de perfil, se o
            agrupamento for feito por outra pessoa ou noutro momento.
          </p>
        </header>

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputPerfisRef.current?.click()}>
            Carregar perfis (JSON)
          </button>
          <input
            ref={inputPerfisRef}
            type="file"
            multiple
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) void carregarPerfis(e.target.files);
              e.target.value = "";
            }}
          />
          <button type="button" className="botao-secundario" onClick={() => inputLotesRef.current?.click()}>
            Importar agrupamento (JSON)
          </button>
          <input
            ref={inputLotesRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void carregarLotes(ficheiro);
              e.target.value = "";
            }}
          />
        </div>

        {porAtribuir.length === 0 ? (
          <p className="estado-vazio">Nenhum perfil à espera de atribuição.</p>
        ) : (
          <ul className="lista-perfis-livres">
            {porAtribuir.map((perfil, idx) => (
              <li key={`${perfil.perfil}-${idx}`}>
                <div>
                  <strong>{perfil.perfil || "(perfil sem designação)"}</strong>
                  <span className="meta">{perfil.requisitos.length} requisito(s)</span>
                </div>
                {config.lotes.length === 0 ? (
                  <span className="meta">crie um lote para poder atribuir</span>
                ) : (
                  <select
                    value=""
                    aria-label={`Atribuir "${perfil.perfil}" a um lote`}
                    onChange={(e) => {
                      if (e.target.value !== "") atribuirPerfil(e.target.value, idx);
                    }}
                  >
                    <option value="">Atribuir ao lote…</option>
                    {config.lotes.map((lote) => (
                      <option key={lote.id} value={lote.id}>
                        Lote {lote.numero}
                        {lote.designacao ? ` — ${lote.designacao}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Lotes</h3>
        </header>

        {config.lotes.length === 0 && <p className="estado-vazio">Ainda não há lotes. Crie o primeiro.</p>}

        <div className="lista-lotes">
          {config.lotes.map((lote) => (
            <EditorLote
              key={lote.id}
              lote={lote}
              onAlterar={(alteracao) => atualizarLote(lote.id, alteracao)}
              onRemover={() => removerLote(lote.id)}
              onRetirarPerfil={(perfilEmLoteId) => retirarPerfil(lote.id, perfilEmLoteId)}
              onDescarregarFormulario={(perfil) => void descarregarFormulario(perfil, lote.numero)}
            />
          ))}
        </div>

        <button type="button" className="botao-secundario" onClick={adicionarLote}>
          + Adicionar lote
        </button>
      </section>

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

      {config.lotes.length > 0 && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Resumo do procedimento</h3>
          </header>
          <TabelaValores config={config} />
        </section>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Saídas</h3>
        </header>
        <div className="acoes">
          <button type="button" className="botao-principal" onClick={descarregarWord} disabled={!podeExportar}>
            Descarregar documento Word
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarExcel} disabled={!podeExportar}>
            Descarregar Excel
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarJSON} disabled={!podeExportar}>
            Descarregar agrupamento (JSON)
          </button>
        </div>
        <p className="ajuda">
          O documento Word reúne, com tabelas formatadas, os requisitos e o preço base para o caderno de encargos e as
          regras de comprovação e apuramento para o programa do concurso.
        </p>
        <p className="ajuda">
          Os formulários de declaração descarregam-se por perfil, dentro de cada lote, ou todos de uma vez na secção
          seguinte. O JSON do agrupamento é o ficheiro que carrega no Módulo 3 para avaliar as propostas.
        </p>
        {PERSISTENCIA_DISPONIVEL && (
          <p className="ajuda">O agrupamento em edição é guardado neste navegador e reaparece na próxima sessão.</p>
        )}
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Formulários de Declaração</h3>
          <p className="painel-nota">
            Descarregue de uma vez os formulários de todos os perfis atribuídos a lotes, num ficheiro zip.
          </p>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-secundario"
            onClick={descarregarTodosFormulariosExcel}
            disabled={aZipar || !temFormularios}
          >
            {aZipar ? "A gerar…" : "Descarregar todos (Excel, .zip)"}
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={descarregarTodosFormulariosJSON}
            disabled={aZipar || !temFormularios}
          >
            {aZipar ? "A gerar…" : "Descarregar todos (JSON, .zip)"}
          </button>
        </div>
        {!temFormularios && <p className="estado-vazio">Ainda não há perfis atribuídos a lotes.</p>}
      </section>
    </div>
  );
}
