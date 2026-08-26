import { useRef, useState } from "react";
import type { Lote, LotesJSON, PerfilJSON } from "../core/types";
import {
  ErroImportacao,
  certificacoesDoPerfil,
  importarPerfisJSON,
  validarDescricaoProjeto,
  validarNomeProjeto,
} from "../core/perfil";
import { anosDeInicioAdmitidos } from "../core/types";
import {
  criarLote,
  criarPerfilEmLote,
  importarLotesJSON,
  lotesIniciais,
  anosPlurianuais,
  nomeProcedimentoDe,
  perfisEmLotes,
  PREFIXO_NOME_PROCEDIMENTO,
  taxaIva,
  validarLotes,
} from "../core/lotes";
import { DESCRICAO_PROJETO_EXEMPLO, LOTES_EXEMPLO, NOME_PROJETO_EXEMPLO, PERFIS_EXEMPLO } from "../core/exemplo";
import { ErroModeloEavalia } from "../excel/eavalia";
import { descarregarPacote } from "../ui/pacote";
import { ficheirosDasPecas, nomeDoPacoteDePecas } from "../saidas/pacotes";
import { CampoNumero } from "../ui/CampoNumero";
import { DicaRequisitos } from "../ui/DicaRequisitos";
import { InformacaoEavaliaEditor } from "./InformacaoEavaliaEditor";
import { PostoTrabalhoEditor } from "./PostoTrabalhoEditor";
import { DicaRepartirHoras } from "./DicaRepartirHoras";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
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
  /** Descrição do projeto, escrita no Módulo 1 — aqui só é carimbada nos ficheiros. */
  descricaoProjeto: string;
  onDefinirDescricaoProjeto: (descricao: string) => void;
  /** Aceita a descrição vinda de um ficheiro importado, se ainda não houver uma. */
  onAdotarDescricaoProjeto: (descricao: string) => void;
  /** Junta perfis ao catálogo do Módulo 1, substituindo os que já existam. */
  onAcrescentarPerfis: (perfis: PerfilJSON[]) => void;
  /** Substitui o catálogo inteiro (usado ao carregar o exemplo). */
  onSubstituirPerfis: (perfis: PerfilJSON[]) => void;
}

export function Modulo2({
  perfis,
  config: configGuardada,
  onAlterarConfig: alterarConfigGuardada,
  nomeProjeto,
  onDefinirNomeProjeto,
  onAdotarNomeProjeto,
  descricaoProjeto,
  onDefinirDescricaoProjeto,
  onAdotarDescricaoProjeto,
  onAcrescentarPerfis,
  onSubstituirPerfis,
}: Props) {
  // O nome do procedimento não se escreve: forma-se a partir do nome do projeto
  // pela regra da entidade. Deriva-se aqui, e não se guarda a partir do que
  // esteja gravado, para que um agrupamento antigo — ou um ficheiro de outra
  // pessoa — não traga consigo um nome que já não corresponde ao projeto.
  const config: LotesJSON = { ...configGuardada, nomeProcedimento: nomeProcedimentoDe(nomeProjeto) };

  const anosDeInicio = anosDeInicioAdmitidos();
  const anosDoContrato = anosPlurianuais(config.encargosPlurianuais.anoInicio);

  /** Grava a alteração, e com ela o nome do procedimento que o projeto impõe. */
  function onAlterarConfig(atualizar: (atual: LotesJSON) => LotesJSON) {
    alterarConfigGuardada((atual) => ({
      ...atualizar({ ...atual, nomeProcedimento: config.nomeProcedimento }),
      nomeProcedimento: config.nomeProcedimento,
    }));
  }

  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputPerfisRef = useRef<HTMLInputElement>(null);
  const inputLotesRef = useRef<HTMLInputElement>(null);

  // O nome do projeto é definido no Módulo 1 e vive numa só variável na
  // aplicação; aqui só é carimbado nos ficheiros no momento de os gerar, para
  // não haver duas cópias a divergir.
  const configExportavel: LotesJSON = { ...config, nomeProjeto, descricaoProjeto };

  const erros = [
    ...validarNomeProjeto(nomeProjeto),
    ...validarDescricaoProjeto(descricaoProjeto),
    ...validarLotes(config),
  ];
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
    let descricaoDeFicheiro = "";

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const importado = importarPerfisJSON(await ficheiro.text());
        carregados.push(...importado.perfis);
        if (nomeDeFicheiro === "") nomeDeFicheiro = importado.nomeProjeto;
        if (descricaoDeFicheiro === "") descricaoDeFicheiro = importado.descricaoProjeto;
      } catch (erro) {
        falhados.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    onAdotarNomeProjeto(nomeDeFicheiro);
    onAdotarDescricaoProjeto(descricaoDeFicheiro);
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
      onAdotarDescricaoProjeto(importado.descricaoProjeto);
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

  const podeCarregarExemplo = usePodeCarregarExemplo();

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    const exemplo = structuredClone(LOTES_EXEMPLO);
    onAlterarConfig(() => exemplo);
    onSubstituirPerfis(structuredClone(PERFIS_EXEMPLO));
    onDefinirNomeProjeto(NOME_PROJETO_EXEMPLO);
    onDefinirDescricaoProjeto(DESCRICAO_PROJETO_EXEMPLO);
    setMensagem({ tipo: "sucesso", texto: "Agrupamento de exemplo carregado." });
  }

  /**
   * Todas as peças do procedimento num pacote só.
   *
   * Os dois documentos Word, o pedido eAvalia, o JSON dos lotes, um formulário
   * de declaração por lote e — numa pasta à parte — os ficheiros dos perfis do
   * Módulo 1. Andam sempre juntos: seguem para a mesma pasta partilhada e
   * instruem o mesmo processo.
   */
  async function descarregarPecas() {
    setMensagem(null);
    setAGerar(true);
    try {
      await descarregarPacote(
        nomeDoPacoteDePecas(nomeProjeto),
        await ficheirosDasPecas(configExportavel, perfis, nomeProjeto),
      );
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroModeloEavalia ? erro.message : "Não foi possível gerar as peças do procedimento.",
      });
    } finally {
      setAGerar(false);
    }
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
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar}>
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
        {/* O nome do procedimento é longo e formado por regra: ocupa a linha
            toda. Os dois números ficam lado a lado por baixo, cada um com a
            largura do seu rótulo, para nenhum deles se partir em duas linhas. */}
        <label>
          <span className="rotulo">Nome do procedimento</span>
          <input
            type="text"
            className="campo-derivado"
            value={config.nomeProcedimento}
            readOnly
            aria-readonly="true"
            placeholder={`${PREFIXO_NOME_PROCEDIMENTO}…`}
            title="Formado a partir do nome do projeto. Altere o nome do projeto no Módulo 1."
          />
        </label>

        <div className="linha-campos linha-campos-numeros">
          <label className="campo-numero-rotulado">
            <span className="rotulo" title="Quantos projetos distintos cada candidato poderá declarar por ficheiro">
              N.º de projetos por Excel
            </span>
            <CampoNumero
              valor={config.nBlocos}
              min={1}
              step={1}
              invalido={!Number.isInteger(config.nBlocos) || config.nBlocos < 1}
              aria-label="N.º de projetos por Excel"
              onChange={(nBlocos) => onAlterarConfig((atual) => ({ ...atual, nBlocos }))}
            />
          </label>

          <label className="campo-numero-rotulado">
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
        <p className="ajuda">
          O nome do procedimento é «{PREFIXO_NOME_PROCEDIMENTO.trim()}» seguido do nome do projeto, e altera-se
          alterando esse nome no Módulo 1. O n.º de projetos é o mesmo em todos os formulários de declaração. Todos
          os preços unitários são introduzidos sem IVA.
        </p>

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

        <label className="campo-opcao">
          <input
            type="checkbox"
            checked={config.encargosPlurianuais.ativo}
            onChange={(e) =>
              onAlterarConfig((atual) => ({
                ...atual,
                encargosPlurianuais: { ...atual.encargosPlurianuais, ativo: e.target.checked },
              }))
            }
          />
          <span>
            <strong>Procedimento com pedido de encargos plurianuais</strong>
            <span className="meta">
              A execução estende-se por mais do que um ano económico, e a despesa dos anos seguintes carece de
              autorização prévia.
            </span>
          </span>
        </label>

        {config.encargosPlurianuais.ativo && (
          <div className="campo-dependente">
            <div className="titulo-com-dica">
              <span className="rotulo">Anos do contrato</span>
              <DicaRepartirHoras />
            </div>
            <label className="campo-estreito">
              <span className="rotulo-oculto">Ano de início do contrato</span>
              {/* Só o ano corrente e o seguinte: sendo uma escolha entre dois,
                  a lista poupa a explicação que um campo livre exigiria. */}
              <select
                value={config.encargosPlurianuais.anoInicio}
                aria-label="Ano de início do contrato"
                aria-invalid={!anosDeInicio.includes(config.encargosPlurianuais.anoInicio)}
                onChange={(e) =>
                  onAlterarConfig((atual) => ({
                    ...atual,
                    encargosPlurianuais: { ...atual.encargosPlurianuais, anoInicio: Number(e.target.value) },
                  }))
                }
              >
                {anosDeInicio.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
                {!anosDeInicio.includes(config.encargosPlurianuais.anoInicio) && (
                  <option value={config.encargosPlurianuais.anoInicio}>
                    {config.encargosPlurianuais.anoInicio} (fora do prazo)
                  </option>
                )}
              </select>
            </label>
            <p className="ajuda">
              Os encargos pedidos respeitam ao ano económico do início dos contratos mais os 2 anos económicos
              seguintes — {anosDoContrato.join(", ")}. As horas de cada ano escrevem-se nos lotes, perfil a perfil.
            </p>
          </div>
        )}
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
            Importar lotes (JSON)
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
              anosPlurianuais={config.encargosPlurianuais.ativo ? anosDoContrato : undefined}
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
          <h3>Posto de trabalho</h3>
          <p className="painel-nota">
            Em que regime se presta o serviço, onde e com que equipamento. Sai no documento Word, em tabela, com o
            que aqui ficar fixado.
          </p>
        </header>
        <PostoTrabalhoEditor
          posto={config.postoTrabalho}
          onChange={(postoTrabalho) => onAlterarConfig((atual) => ({ ...atual, postoTrabalho }))}
        />
      </section>

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
          <h3>Peças do procedimento</h3>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-principal"
            onClick={() => void descarregarPecas()}
            disabled={aGerar || !podeExportar}
          >
            {aGerar ? "A gerar…" : "Descarregar peças do procedimento (ZIP)"}
          </button>
        </div>
        <p className="ajuda">
          Um ZIP com tudo o que o procedimento precisa: o documento Word dos requisitos e regras, o pedido de
          assunção de encargos plurianuais no modelo formal da organização, o pedido de parecer prévio eAvalia, o
          JSON dos lotes, um formulário de declaração de experiência por lote — e, na pasta «Perfis», o Excel e o
          JSON do Módulo 1.
        </p>
        {lotesComPerfis.length === 0 && <p className="estado-vazio">Ainda não há perfis atribuídos a lotes.</p>}
      </section>

    </div>
  );
}
