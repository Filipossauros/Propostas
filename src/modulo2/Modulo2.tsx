import { useRef, useState } from "react";
import type { EspecificacaoFormulario, Lote, LotesJSON, PerfilJSON } from "../core/types";
import { ErroImportacao, certificacoesDoPerfil, importarPerfisJSON, validarNomeProjeto } from "../core/perfil";
import {
  criarLote,
  criarPerfilEmLote,
  formulariosParaJSON,
  importarLotesJSON,
  lotesIniciais,
  lotesParaJSON,
  perfisEmLotes,
  taxaIva,
  validarLotes,
} from "../core/lotes";
import { documentoRegrasEPrecoBase } from "../core/cadernoEncargos";
import { gerarDocxBlob } from "../word/gerarDocx";
import { LOTES_EXEMPLO, NOME_PROJETO_EXEMPLO, PERFIS_EXEMPLO } from "../core/exemplo";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { ErroModeloEavalia, gerarEavaliaBlob } from "../excel/eavalia";
import { descarregarBlob, nomeComProjeto, nomeSeguro } from "../ui/descarregar";
import { CampoNumero } from "../ui/CampoNumero";
import { DicaRequisitos } from "../ui/DicaRequisitos";
import { InformacaoEavaliaEditor } from "./InformacaoEavaliaEditor";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { EditorLote } from "./EditorLote";
import { TabelaValores } from "./TabelaValores";

interface Props {
  /** Catálogo de perfis do Módulo 1 — a fonte única de verdade dos requisitos. */
  perfis: PerfilJSON[];
  config: LotesJSON;
  onAlterarConfig: (atualizar: (atual: LotesJSON) => LotesJSON) => void;
  nomeProjeto: string;
  /** Define o nome do projeto (usado ao carregar o exemplo). */
  onDefinirNomeProjeto: (nome: string) => void;
  /** Aceita o nome vindo de um ficheiro importado, se ainda não houver um definido. */
  onAdotarNomeProjeto: (nome: string) => void;
  /** Junta perfis ao catálogo do Módulo 1, substituindo os que já existam. */
  onAcrescentarPerfis: (perfis: PerfilJSON[]) => void;
  /** Substitui o catálogo inteiro (usado ao carregar o exemplo). */
  onSubstituirPerfis: (perfis: PerfilJSON[]) => void;
}

/** Especificação do formulário de um perfil dentro de um lote. */
function especificacao(perfil: PerfilJSON, lote?: Lote): EspecificacaoFormulario {
  return {
    perfil: perfil.perfil,
    nBlocos: perfil.nBlocos,
    requisitos: perfil.requisitos,
    lote: lote?.numero,
    loteDesignacao: lote?.designacao,
  };
}

export function Modulo2({
  perfis,
  config,
  onAlterarConfig,
  nomeProjeto,
  onDefinirNomeProjeto,
  onAdotarNomeProjeto,
  onAcrescentarPerfis,
  onSubstituirPerfis,
}: Props) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputPerfisRef = useRef<HTMLInputElement>(null);
  const inputLotesRef = useRef<HTMLInputElement>(null);

  // O nome do projeto é definido no Módulo 1 e vive numa só variável na
  // aplicação; aqui só é carimbado nos ficheiros no momento de os gerar, para
  // não haver duas cópias a divergir.
  const configExportavel: LotesJSON = { ...config, nomeProjeto };

  const erros = [...validarNomeProjeto(nomeProjeto), ...validarLotes(config)];
  const podeExportar = erros.length === 0;

  // "Por atribuir" é derivado, não é estado próprio: são os perfis do catálogo
  // que ainda não estão em nenhum lote. Assim, retirar um perfil de um lote
  // devolve-o a esta lista sem ser preciso mantê-la em sincronia à mão.
  const idsEmLotes = new Set(perfisEmLotes(config).map((p) => p.id));
  const porAtribuir = perfis.filter((p) => !idsEmLotes.has(p.id));
  const lotesComPerfis = config.lotes.filter((lote) => lote.perfis.length > 0);

  function atualizarLote(loteId: string, alteracao: Partial<Lote>) {
    onAlterarConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) => (l.id === loteId ? { ...l, ...alteracao } : l)),
    }));
  }

  function adicionarLote() {
    onAlterarConfig((atual) => ({ ...atual, lotes: [...atual.lotes, criarLote(String(atual.lotes.length + 1))] }));
  }

  function removerLote(loteId: string) {
    onAlterarConfig((atual) => ({ ...atual, lotes: atual.lotes.filter((l) => l.id !== loteId) }));
  }

  function atribuirPerfil(loteId: string, perfil: PerfilJSON) {
    onAlterarConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) =>
        l.id === loteId ? { ...l, perfis: [...l.perfis, criarPerfilEmLote(perfil)] } : l,
      ),
    }));
  }

  function retirarPerfil(loteId: string, perfilEmLoteId: string) {
    onAlterarConfig((atual) => ({
      ...atual,
      lotes: atual.lotes.map((l) =>
        l.id === loteId ? { ...l, perfis: l.perfis.filter((e) => e.id !== perfilEmLoteId) } : l,
      ),
    }));
  }

  async function lerPerfisDeFicheiros(ficheiros: FileList): Promise<{ perfis: PerfilJSON[]; falhados: string[] }> {
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
    return { perfis: carregados, falhados };
  }

  async function carregarPerfis(ficheiros: FileList) {
    const { perfis: carregados, falhados } = await lerPerfisDeFicheiros(ficheiros);
    if (carregados.length > 0) onAcrescentarPerfis(carregados);

    setMensagem(
      falhados.length > 0
        ? { tipo: "erro", texto: `Não foi possível carregar: ${falhados.join(" · ")}` }
        : {
            tipo: "sucesso",
            texto: `${carregados.length} perfil(is) carregado(s). Ficam também disponíveis no Módulo 1.`,
          },
    );
  }

  async function carregarLotes(ficheiro: File) {
    try {
      const importado = importarLotesJSON(await ficheiro.text());
      onAlterarConfig(() => importado);
      onAdotarNomeProjeto(importado.nomeProjeto);
      // Os perfis vêm dentro do ficheiro de lotes: passam a fazer parte do
      // catálogo, para poderem ser corrigidos no Módulo 1 como os restantes.
      onAcrescentarPerfis(perfisEmLotes(importado));
      setMensagem({ tipo: "sucesso", texto: "Agrupamento importado. Os perfis ficam disponíveis no Módulo 1." });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  function carregarExemplo() {
    const exemplo = structuredClone(LOTES_EXEMPLO);
    onAlterarConfig(() => exemplo);
    onSubstituirPerfis(structuredClone(PERFIS_EXEMPLO));
    onDefinirNomeProjeto(NOME_PROJETO_EXEMPLO);
    setMensagem({ tipo: "sucesso", texto: "Agrupamento de exemplo carregado." });
  }

  function descarregarJSON() {
    descarregarBlob(
      new Blob([lotesParaJSON(configExportavel)], { type: "application/json" }),
      nomeComProjeto(nomeProjeto, "Lotes.json"),
    );
  }

  async function descarregarWord() {
    descarregarBlob(
      await gerarDocxBlob([documentoRegrasEPrecoBase(configExportavel)]),
      nomeComProjeto(nomeProjeto, "Requisitos_e_regras.docx"),
    );
  }

  /**
   * O pedido de parecer prévio eAvalia, preenchido sobre o modelo oficial.
   *
   * O modelo é de terceiros e sai tal e qual, com sete células escritas: o
   * nome do projeto, as três respostas de alinhamento tecnológico e as datas
   * que as acompanham.
   */
  async function descarregarEavalia() {
    setMensagem(null);
    try {
      descarregarBlob(
        await gerarEavaliaBlob(configExportavel),
        `Pedido_PPP_eavalia_${nomeSeguro(nomeProjeto, "Projeto")}.xlsx`,
      );
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroModeloEavalia ? erro.message : "Não foi possível gerar o pedido eAvalia.",
      });
    }
  }

  /**
   * Um ficheiro Excel por lote, com uma folha por perfil desse lote e o nome
   * do próprio lote. Cada lote é entregue aos seus concorrentes em separado —
   * um ficheiro só, com todos os lotes, daria a cada um os perfis dos outros.
   */
  async function descarregarFormulariosExcel() {
    setAGerar(true);
    try {
      for (const lote of lotesComPerfis) {
        const especificacoes = lote.perfis.map((entrada) => especificacao(entrada.perfil, lote));
        const resto = `${nomeSeguro(lote.designacao, `Lote ${lote.numero}`)}.xlsx`;
        descarregarBlob(await gerarDeclaracaoExcelBlob(especificacoes), nomeComProjeto(nomeProjeto, resto));
      }
    } finally {
      setAGerar(false);
    }
  }

  function descarregarFormulariosJSON() {
    descarregarBlob(
      new Blob([formulariosParaJSON(configExportavel)], { type: "application/json" }),
      nomeComProjeto(nomeProjeto, "Formularios_Declaracao.json"),
    );
  }

  function recomecar() {
    if (!confirm("Apagar o agrupamento em edição e recomeçar do zero?")) return;
    onAlterarConfig(() => lotesIniciais());
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
          Recebe os perfis definidos no Módulo 1 enviados diretamente ou carregados de ficheiro, agrupa-os em lotes e
          atribui a cada um as horas, o preço unitário e o n.º mínimo de elementos.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

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
              onChange={(e) => onAlterarConfig((atual) => ({ ...atual, nomeProcedimento: e.target.value }))}
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
              onChange={(valor) => onAlterarConfig((atual) => ({ ...atual, taxaIva: valor }))}
            />
          </label>
        </div>
        <p className="ajuda">Todos os preços unitários são introduzidos sem IVA.</p>

        <label className="campo-opcao">
          <input
            type="checkbox"
            checked={config.umLotePorConcorrente}
            onChange={(e) => onAlterarConfig((atual) => ({ ...atual, umLotePorConcorrente: e.target.checked }))}
          />
          <span>
            <strong>Cada concorrente não pode ficar com mais do que um lote</strong>
            <span className="ajuda">
              Os lotes são apreciados por ordem do número: quem ficar com o lote 1 fica impedido nos seguintes. A
              regra sai no documento Word, com título próprio, e é aplicada na avaliação do Módulo 3.
            </span>
          </span>
        </label>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Perfis por atribuir</h3>
          <p className="painel-nota">
            Aparecem aqui os perfis do Módulo 1 que ainda não estão em nenhum lote. Também pode carregar ficheiros
            JSON de perfil, se o agrupamento for feito por outra pessoa ou noutro momento.
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
            {porAtribuir.map((perfil) => (
              <li key={perfil.id}>
                <div>
                  <strong>{perfil.perfil || "(perfil sem designação)"}</strong>
                  <DicaRequisitos requisitos={perfil.requisitos} certificacoes={certificacoesDoPerfil(perfil)} />
                </div>
                {config.lotes.length === 0 ? (
                  <span className="meta">crie um lote para poder atribuir</span>
                ) : (
                  <select
                    value=""
                    aria-label={`Atribuir "${perfil.perfil}" a um lote`}
                    onChange={(e) => {
                      if (e.target.value !== "") atribuirPerfil(e.target.value, perfil);
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
          <h3>Informação eAvalia</h3>
          <p className="painel-nota">
            Respostas às medidas de alinhamento tecnológico do pedido de parecer prévio.
          </p>
        </header>
        <InformacaoEavaliaEditor
          eavalia={config.eavalia}
          onChange={(eavalia) => onAlterarConfig((atual) => ({ ...atual, eavalia }))}
        />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Anexo Técnico</h3>
        </header>
        <div className="acoes">
          <button type="button" className="botao-principal" onClick={descarregarWord} disabled={!podeExportar}>
            Descarregar documento Word
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarJSON} disabled={!podeExportar}>
            Descarregar agrupamento (JSON)
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={() => void descarregarEavalia()}
            disabled={!podeExportar}
          >
            Descarregar pedido eAvalia (Excel)
          </button>
        </div>
        <p className="ajuda">
          O documento Word reúne, com tabelas formatadas, os requisitos e o preço base para o caderno de encargos e as
          regras de comprovação e apuramento para o programa do concurso. O pedido eAvalia é o modelo oficial do
          parecer prévio, preenchido com o nome do projeto e com as respostas da secção anterior.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Formulários de Declaração</h3>
          <p className="painel-nota">
            Um ficheiro Excel por lote, com o nome do lote e uma folha por perfil. O JSON reúne todos os lotes num
            ficheiro só.
          </p>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-secundario"
            onClick={descarregarFormulariosExcel}
            disabled={aGerar || !podeExportar || lotesComPerfis.length === 0}
          >
            {aGerar
              ? "A gerar…"
              : `Descarregar formulários (Excel, ${lotesComPerfis.length} ficheiro${lotesComPerfis.length === 1 ? "" : "s"})`}
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={descarregarFormulariosJSON}
            disabled={!podeExportar || lotesComPerfis.length === 0}
          >
            Descarregar formulários (JSON)
          </button>
        </div>
        {lotesComPerfis.length > 1 && (
          <p className="ajuda">
            São {lotesComPerfis.length} descarregamentos seguidos, um por lote — o navegador pode pedir autorização
            para descarregar vários ficheiros.
          </p>
        )}
        {lotesComPerfis.length === 0 && <p className="estado-vazio">Ainda não há perfis atribuídos a lotes.</p>}
      </section>
    </div>
  );
}
