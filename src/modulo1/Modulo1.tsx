import { useRef, useState } from "react";
import type { EspecificacaoFormulario, PerfilJSON } from "../core/types";
import {
  ErroImportacao,
  duplicarPerfil,
  importarPerfisJSON,
  perfilInicial,
  perfisParaJSON,
  validarPerfis,
} from "../core/perfil";
import { PERFIS_EXEMPLO } from "../core/exemplo";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { RequisitosEditor } from "./RequisitosEditor";

interface Props {
  perfis: PerfilJSON[];
  onAlterarPerfis: (perfis: PerfilJSON[]) => void;
  /** Número do lote a que cada perfil já está atribuído, indexado pelo id do perfil. */
  lotePorPerfilId: Record<string, string>;
  onIrParaLotes: () => void;
}

export function Modulo1({ perfis, onAlterarPerfis, lotePorPerfilId, onIrParaLotes }: Props) {
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
      const nome =
        perfis.length === 1
          ? `Declaracao_Experiencia_${nomeSeguro(perfis[0].perfil, "Perfil")}.xlsx`
          : "Declaracoes_Experiencia.xlsx";
      descarregarBlob(await gerarDeclaracaoExcelBlob(especificacoes()), nome);
    } finally {
      setAGerar(false);
    }
  }

  function descarregarJSON() {
    setMensagem(null);
    descarregarBlob(new Blob([perfisParaJSON(perfis)], { type: "application/json" }), "Perfis.json");
  }

  async function importarJSON(ficheiros: FileList) {
    const carregados: PerfilJSON[] = [];
    const falhados: string[] = [];

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        carregados.push(...importarPerfisJSON(await ficheiro.text()));
      } catch (erro) {
        falhados.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

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

  function carregarExemplo() {
    onAlterarPerfis(structuredClone(PERFIS_EXEMPLO));
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: `${PERFIS_EXEMPLO.length} perfis de exemplo carregados.` });
  }

  function recomecar() {
    if (!confirm("Apagar todos os perfis em edição e recomeçar do zero?")) return;
    onAlterarPerfis([]);
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Perfis repostos." });
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
          Pode carregar vários ficheiros de uma vez, e cada ficheiro pode conter um ou mais perfis.
        </p>
      </section>

      {emEdicao !== null && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Identificação do perfil</h3>
            </header>

            <div className="grelha-campos">
              <label className="campo-largo">
                <span className="rotulo">Perfil</span>
                <input
                  type="text"
                  value={emEdicao.perfil}
                  placeholder="ex.: Arquiteto / Programador Sénior — Integração"
                  onChange={(e) => alterarEmEdicao({ perfil: e.target.value })}
                  aria-invalid={emEdicao.perfil.trim() === ""}
                />
              </label>

              <label>
                <span className="rotulo">N.º de blocos de projeto do formulário</span>
                <CampoNumero
                  valor={emEdicao.nBlocos}
                  min={1}
                  step={1}
                  sufixo="blocos"
                  invalido={!Number.isInteger(emEdicao.nBlocos) || emEdicao.nBlocos < 1}
                  onChange={(nBlocos) => alterarEmEdicao({ nBlocos })}
                />
                <span className="ajuda">Quantos projetos distintos cada candidato poderá declarar.</span>
              </label>
            </div>
          </section>

          <RequisitosEditor
            requisitos={emEdicao.requisitos}
            onChange={(requisitos) => alterarEmEdicao({ requisitos })}
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
