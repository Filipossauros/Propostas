import { useRef, useState } from "react";
import type { Lote, LotesJSON, PerfilJSON } from "../core/types";
import { SCHEMA_VERSION_ATUAL } from "../core/types";
import { ErroImportacao, importarPerfilJSON } from "../core/perfil";
import {
  criarLote,
  criarPerfilEmLote,
  gerarTextoCadernoEncargosLotes,
  importarLotesJSON,
  lotesIniciais,
  lotesParaJSON,
  validarLotes,
} from "../core/lotes";
import { CHAVE_LOTES, PERSISTENCIA_DISPONIVEL } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { gerarLotesBlob } from "../excel/exportarLotes";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { BlocoCopiavel } from "../ui/BlocoCopiavel";
import { EditorLote } from "./EditorLote";
import { TabelaValores } from "./TabelaValores";

function ehLotesGuardado(valor: unknown): valor is LotesJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Partial<LotesJSON>;
  return l.tipo === "lotes" && l.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(l.lotes);
}

export function Modulo2() {
  const [config, setConfig] = useEstadoPersistente<LotesJSON>(CHAVE_LOTES, lotesIniciais, ehLotesGuardado);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputPerfisRef = useRef<HTMLInputElement>(null);
  const inputLotesRef = useRef<HTMLInputElement>(null);

  /** Perfis carregados que ainda não foram atribuídos a nenhum lote. */
  const [porAtribuir, setPorAtribuir] = useState<PerfilJSON[]>([]);

  const erros = validarLotes(config);
  const podeExportar = erros.length === 0;
  const textoCaderno = gerarTextoCadernoEncargosLotes(config);

  function atualizarLote(loteId: string, alteracao: Partial<Lote>) {
    setConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) => (l.id === loteId ? { ...l, ...alteracao } : l)),
    }));
  }

  function adicionarLote() {
    setConfig((atual) => ({
      ...atual,
      lotes: [...atual.lotes, criarLote(String(atual.lotes.length + 1))],
    }));
  }

  function removerLote(loteId: string) {
    setConfig((atual) => {
      const lote = atual.lotes.find((l) => l.id === loteId);
      if (lote) setPorAtribuir((p) => [...p, ...lote.perfis.map((e) => e.perfil)]);
      return { ...atual, lotes: atual.lotes.filter((l) => l.id !== loteId) };
    });
  }

  function atribuirPerfil(loteId: string, indicePorAtribuir: number) {
    const perfil = porAtribuir[indicePorAtribuir];
    if (!perfil) return;
    setPorAtribuir((p) => p.filter((_, i) => i !== indicePorAtribuir));
    setConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) =>
        l.id === loteId ? { ...l, perfis: [...l.perfis, criarPerfilEmLote(perfil)] } : l,
      ),
    }));
  }

  function retirarPerfil(loteId: string, perfilEmLoteId: string) {
    setConfig((atual) => {
      const lote = atual.lotes.find((l) => l.id === loteId);
      const entrada = lote?.perfis.find((e) => e.id === perfilEmLoteId);
      if (entrada) setPorAtribuir((p) => [...p, entrada.perfil]);
      return {
        ...atual,
        lotes: atual.lotes.map((l) =>
          l.id === loteId ? { ...l, perfis: l.perfis.filter((e) => e.id !== perfilEmLoteId) } : l,
        ),
      };
    });
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

    if (carregados.length > 0) setPorAtribuir((p) => [...p, ...carregados]);

    if (falhados.length > 0) {
      setMensagem({ tipo: "erro", texto: `Não foi possível carregar: ${falhados.join(" · ")}` });
    } else {
      setMensagem({
        tipo: "sucesso",
        texto: `${carregados.length} perfil(is) carregado(s). Atribua-os aos lotes abaixo.`,
      });
    }
  }

  async function carregarLotes(ficheiro: File) {
    try {
      setConfig(importarLotesJSON(await ficheiro.text()));
      setPorAtribuir([]);
      setMensagem({ tipo: "sucesso", texto: "Agrupamento de lotes importado." });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  function descarregarJSON() {
    const nome = `Lotes_${nomeSeguro(config.procedimento, "procedimento")}.json`;
    descarregarBlob(new Blob([lotesParaJSON(config)], { type: "application/json" }), nome);
  }

  function descarregarExcel() {
    descarregarBlob(gerarLotesBlob(config), `Lotes_${nomeSeguro(config.procedimento, "procedimento")}.xlsx`);
  }

  async function descarregarFormulario(perfil: PerfilJSON, numeroLote: string) {
    const especificacao = { ...perfil, procedimento: config.procedimento };
    const nome = `Declaracao_Lote${nomeSeguro(numeroLote, "X")}_${nomeSeguro(perfil.perfil, "Perfil")}.xlsx`;
    descarregarBlob(await gerarDeclaracaoExcelBlob(especificacao), nome);
  }

  function recomecar() {
    if (!confirm("Apagar o agrupamento em edição e recomeçar do zero?")) return;
    setConfig(lotesIniciais());
    setPorAtribuir([]);
    setMensagem({ tipo: "sucesso", texto: "Agrupamento reposto." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div>
          <h2>Módulo 2 · Agrupamento em lotes</h2>
          <p className="modulo-subtitulo">
            Carregue os perfis definidos no Módulo 1, agrupe-os em lotes e atribua a cada um as horas, o preço
            unitário e o n.º mínimo de elementos. No fim obtém o texto e a tabela para o caderno de encargos.
          </p>
        </div>
        <button type="button" className="botao-discreto" onClick={recomecar}>
          Recomeçar
        </button>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Procedimento</h3>
        </header>
        <div className="grelha-campos">
          <label>
            <span className="rotulo">
              Procedimento n.º <span className="etiqueta-opcional">opcional</span>
            </span>
            <input
              type="text"
              value={config.procedimento}
              placeholder="ainda sem número"
              onChange={(e) => setConfig((atual) => ({ ...atual, procedimento: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Perfis por atribuir</h3>
          <p className="painel-nota">Carregue os ficheiros JSON de perfil produzidos no Módulo 1.</p>
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
            <h3>Tabela para o caderno de encargos</h3>
            <p className="painel-nota">
              O preço base de cada perfil é <strong>horas × preço unitário/hora</strong>. O n.º mínimo de elementos
              não multiplica o valor — é uma condição de admissibilidade da proposta.
            </p>
          </header>
          <TabelaValores config={config} />
        </section>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Saídas</h3>
        </header>
        <div className="acoes">
          <button type="button" className="botao-principal" onClick={descarregarExcel} disabled={!podeExportar}>
            Descarregar Excel (tabela + requisitos + texto)
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarJSON} disabled={!podeExportar}>
            Descarregar agrupamento (JSON)
          </button>
        </div>
        <p className="ajuda">
          Os formulários de declaração descarregam-se por perfil, dentro de cada lote. O JSON do agrupamento é o
          ficheiro que carrega no Módulo 3 para avaliar as propostas.
        </p>
        {PERSISTENCIA_DISPONIVEL && (
          <p className="ajuda">O agrupamento em edição é guardado neste navegador e reaparece na próxima sessão.</p>
        )}
      </section>

      {textoCaderno !== "" && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Texto para o caderno de encargos</h3>
          </header>
          <BlocoCopiavel texto={textoCaderno} onMensagem={setMensagem} />
        </section>
      )}
    </div>
  );
}
