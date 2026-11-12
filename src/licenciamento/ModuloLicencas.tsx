import { useRef, useState } from "react";
import type {
  DireitoUso,
  FundamentoLicenca,
  Licenca,
  Manutencao,
  Metrica,
  Modalidade,
  NaturezaAquisicao,
  ObjetoLicenca,
  OrigemPreco,
  PedidoLicenciamento,
  PeriodicidadePreco,
} from "../core/licenciamento";
import {
  AMBITOS_EAVALIA,
  DIREITOS_USO,
  EXPLICACAO_TIPOS_SOLUCAO,
  FUNDAMENTOS_LICENCA,
  MANUTENCOES,
  MESES_MAXIMOS,
  METRICAS,
  METRICAS_UNICAS,
  MODALIDADES,
  OBJETOS_LICENCA,
  ORIGENS_PRECO,
  PERIODICIDADES,
  ROTULO_TIPO_LICENCIAMENTO,
  TIPOS_SOLUCAO_DETERMINADA,
  comAlteracao,
  consultaMercadoEavalia,
  criarLicenca,
  importarPedidoLicenciamentoJSON,
  nomeDaLicenca,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoInicial,
  resumoDoTipo,
  tipoEavalia,
  tipoLicenciamentoEavalia,
  validarLicenca,
  validarLicencas,
  valorDaLicenca,
} from "../core/licenciamento";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import { ErroImportacao } from "../core/perfil";
import { gerarId } from "../core/id";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";
import { CampoNumero } from "../ui/CampoNumero";
import { Explicacao } from "../ui/Explicacao";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  onIrParaCondicoes: () => void;
}

const NATUREZAS: Array<{ valor: NaturezaAquisicao; titulo: string; texto: string }> = [
  {
    valor: "aberta",
    titulo: "Aberta à concorrência",
    texto:
      "Concurso público ou consulta prévia. Descreve-se a licença e os requisitos mínimos; qualquer fabricante pode " +
      "concorrer. No eAvalia: «Submissão à concorrência» e consulta ao mercado «Sim».",
  },
  {
    valor: "determinado",
    titulo: "Licença determinada",
    texto:
      "Renovação ou alargamento de uma plataforma já instalada, direitos exclusivos do fabricante ou titular, ou " +
      "compatibilidade técnica. Identifica-se a licença e fundamenta-se a escolha (art.º 24.º do CCP). No eAvalia: " +
      "consulta ao mercado «Não».",
  },
];

/** Um `<select>` com a opção «por escolher» e as opções de uma lista. */
function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
  className = "campo-crescente",
}: {
  rotulo: string;
  valor: T | "";
  opcoes: ReadonlyArray<readonly [T, string]>;
  onChange: (valor: T | "") => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="rotulo">{rotulo}</span>
      <select value={valor} aria-invalid={valor === ""} onChange={(e) => onChange(e.target.value as T | "")}>
        {valor === "" && <option value="">— por escolher —</option>}
        {opcoes.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );
}

const iguais = <T extends string>(lista: readonly T[]) => lista.map((v) => [v, v] as const);
const deRegisto = <T extends string>(registo: Record<T, string>) =>
  (Object.entries(registo) as Array<[T, string]>).map(([v, t]) => [v, t] as const);

/** Um valor do eAvalia que decorre de outra escolha: mostra-se, não se escolhe. */
function Derivado({ rotulo, valor, origem }: { rotulo: string; valor: string; origem: string }) {
  return (
    <div className="valor-derivado">
      <span className="rotulo">{rotulo}</span>
      <strong>{valor}</strong>
      <span className="meta">{origem}</span>
    </div>
  );
}

/**
 * L1 · Licenças: as licenças a adquirir — o que é cada uma, como se conta,
 * quantas, por quanto tempo e a que preço de referência. Cada licença é uma
 * linha do mapa de quantidades e preços.
 */
export function ModuloLicencas({ pedido, onAlterar, onIrParaCondicoes }: Props) {
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(pedido.licencas[0]?.id ?? null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const podeCarregarExemplo = usePodeCarregarExemplo();

  const emEdicao = pedido.licencas.find((l) => l.id === idEmEdicao) ?? pedido.licencas[0] ?? null;
  const aberta = pedido.natureza === "aberta";
  const erros = validarLicencas(pedido);
  const produto = pedido.nomeProduto.trim();

  function alterarLicenca(alteracao: Partial<Licenca>) {
    if (emEdicao === null) return;
    onAlterar((atual) => ({
      ...atual,
      licencas: atual.licencas.map((l) => (l.id === emEdicao.id ? comAlteracao(l, alteracao) : l)),
    }));
  }

  function novaLicenca() {
    const nova = criarLicenca();
    onAlterar((atual) => ({ ...atual, licencas: [...atual.licencas, nova] }));
    setIdEmEdicao(nova.id);
  }

  function duplicar(l: Licenca) {
    const copia = { ...structuredClone(l), id: gerarId() };
    onAlterar((atual) => ({ ...atual, licencas: [...atual.licencas, copia] }));
    setIdEmEdicao(copia.id);
  }

  function remover(l: Licenca) {
    if (!confirm(`Remover «${nomeDaLicenca(l, pedido.natureza) || "licença sem nome"}»?`)) return;
    onAlterar((atual) => ({ ...atual, licencas: atual.licencas.filter((x) => x.id !== l.id) }));
    if (idEmEdicao === l.id) setIdEmEdicao(null);
  }

  async function importar(ficheiro: File) {
    try {
      const importado = importarPedidoLicenciamentoJSON(await ficheiro.text());
      if (pedido.licencas.length > 0 && !confirm("Substituir o pedido em edição (com o produto) pelo do ficheiro?")) return;
      onAlterar(() => importado);
      setIdEmEdicao(importado.licencas[0]?.id ?? null);
      setMensagem({ tipo: "sucesso", texto: `Pedido importado: ${importado.licencas.length} licença(s).` });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    const exemplo = pedidoLicenciamentoExemplo();
    onAlterar(() => exemplo);
    setIdEmEdicao(exemplo.licencas[0].id);
    setMensagem({ tipo: "sucesso", texto: "Exemplo carregado: a licença nacional da SNOMED CT, com o produto do Módulo 1." });
  }

  function recomecar() {
    if (!confirm("Apagar o pedido de licenciamento em edição (produto, licenças, condições e lotes) e recomeçar do zero?"))
      return;
    onAlterar(() => pedidoLicenciamentoInicial());
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Pedido de licenciamento reposto." });
  }

  const valor = emEdicao === null ? null : valorDaLicenca(emEdicao, Math.ceil(emEdicao.periodoMeses / 12) || 1);
  const unica = emEdicao !== null && emEdicao.metrica !== "" && METRICAS_UNICAS.includes(emEdicao.metrica);
  const anual = emEdicao?.direitoUso === "temporario" && emEdicao.periodicidadePreco === "anual";

  return (
    <div className="modulo modulo-licenciamento">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo L1 · Licenças{produto ? ` — ${produto}` : ""}</h2>
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
          As licenças a adquirir: o que é cada uma, como se conta, quantas, por quanto tempo e a que preço de
          referência.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o responsável do produto, com a área técnica.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Natureza da aquisição</h3>
          <p className="painel-nota">
            Decide o que se descreve: numa aquisição aberta à concorrência descreve-se a necessidade; quando a licença
            está determinada, identifica-se e fundamenta-se a escolha.
          </p>
        </header>
        <div className="opcoes-natureza" role="radiogroup" aria-label="Natureza da aquisição">
          {NATUREZAS.map((n) => (
            <label
              key={n.valor}
              className={pedido.natureza === n.valor ? "opcao-natureza opcao-natureza-ativa" : "opcao-natureza"}
            >
              <input
                type="radio"
                name="natureza-aquisicao"
                value={n.valor}
                checked={pedido.natureza === n.valor}
                onChange={() => onAlterar((atual) => ({ ...atual, natureza: n.valor }))}
              />
              <span>
                <strong>{n.titulo}</strong>
                <span className="meta">{n.texto}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="ajuda">
          Em qualquer dos casos, o preço é o único aspeto submetido à concorrência: tudo o que aqui se escreve são
          termos e condições do contrato.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Licenças</h3>
          <p className="painel-nota">Cada licença é uma linha do mapa de quantidades e preços. Escolha uma para a editar em baixo.</p>
        </header>

        {pedido.licencas.length === 0 ? (
          <p className="estado-vazio">Ainda não há licenças. Crie a primeira.</p>
        ) : (
          <ul className="lista-perfis-catalogo">
            {pedido.licencas.map((l) => {
              const porResolver = validarLicenca(l, pedido.natureza);
              const ativo = l.id === emEdicao?.id;
              return (
                <li key={l.id} className={ativo ? "perfil-catalogo perfil-catalogo-ativo" : "perfil-catalogo"}>
                  <button
                    type="button"
                    className="perfil-catalogo-alvo"
                    aria-current={ativo ? "true" : undefined}
                    onClick={() => setIdEmEdicao(l.id)}
                  >
                    <strong>{nomeDaLicenca(l, pedido.natureza) || "(licença sem nome)"}</strong>
                    <span className="meta">
                      {resumoDoTipo(l)}
                      {l.quantidade > 0 &&
                        l.metrica !== "" &&
                        ` · ${formatarNumero(l.quantidade)} ${(l.quantidade === 1 ? METRICAS[l.metrica].singular : METRICAS[l.metrica].plural).toLowerCase()}`}
                      {" · "}
                      {porResolver.length === 0 ? (
                        <span className="estado-perfil">completa</span>
                      ) : (
                        <span
                          className="estado-perfil estado-perfil-falta"
                          title={porResolver.map((e) => e.mensagem).join("\n")}
                        >
                          {porResolver.length === 1
                            ? porResolver[0].mensagem.replace(/^[^:]*: /, "")
                            : `${porResolver.length} questões por resolver`}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="acoes-linha">
                    <button type="button" className="botao-discreto" onClick={() => duplicar(l)}>
                      Duplicar
                    </button>
                    <button type="button" className="botao-discreto botao-perigo" onClick={() => remover(l)}>
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={novaLicenca}>
            + Nova licença
          </button>
          <button type="button" className="botao-secundario" onClick={() => inputRef.current?.click()}>
            Importar pedido (JSON)
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importar(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
        <p className="ajuda">
          Por omissão, cada licença forma um lote; os lotes acertam-se no L3. O JSON do pedido sai no Anexo Técnico (L3)
          e traz o produto, as licenças, as condições e os lotes.
        </p>
      </section>

      {emEdicao !== null && (
        <>
          {aberta ? (
            <>
              <section className="painel">
                <header className="painel-cabecalho">
                  <h3>Descrição da licença</h3>
                  <p className="painel-nota">
                    Sem marca nem fabricante: o que a licença tem de permitir. Sai nas Especificações Técnicas (Anexo
                    III) como especificação mínima.
                  </p>
                </header>
                <label className="campo-largo">
                  <span className="rotulo">Designação da licença no procedimento</span>
                  <input
                    type="text"
                    className="campo-designacao-licenca"
                    value={emEdicao.designacao}
                    placeholder="ex.: Plataforma de gestão documental"
                    aria-invalid={emEdicao.designacao.trim() === ""}
                    onChange={(e) => alterarLicenca({ designacao: e.target.value })}
                  />
                  {emEdicao.designacao.trim() === "" && (
                    <span className="aviso-inline aviso-inline-falta">Dê uma designação à licença.</span>
                  )}
                </label>
              </section>

              <ListaItensEditor
                titulo="Requisitos funcionais mínimos"
                nota={
                  "Obrigatório. Um requisito por linha: o que a licença tem de permitir, sem marca nem produto. Saem " +
                  "no Anexo III, em tabela, e são condições do contrato — não se pontuam."
                }
                nomeItem="requisito funcional"
                rotuloColuna="Requisito funcional mínimo"
                placeholder="ex.: Fluxos de aprovação configuráveis sem programação"
                textoVazio="Ainda não há requisitos funcionais. Acrescente o primeiro."
                rotuloAdicionar="+ Adicionar requisito funcional"
                itens={emEdicao.requisitosFuncionais}
                onChange={(requisitosFuncionais) => alterarLicenca({ requisitosFuncionais })}
              />

              <ListaItensEditor
                titulo="Requisitos técnicos mínimos"
                nota={
                  "Opcional. Um requisito por linha: autenticação, alojamento, integração, formatos, segurança. Saem " +
                  "no Anexo III, por baixo dos funcionais."
                }
                nomeItem="requisito técnico"
                rotuloColuna="Requisito técnico mínimo"
                placeholder="ex.: Autenticação por SSO (SAML 2.0 / OIDC)"
                textoVazio="Esta licença não tem requisitos técnicos próprios."
                rotuloAdicionar="+ Adicionar requisito técnico"
                itens={emEdicao.requisitosTecnicos}
                onChange={(requisitosTecnicos) => alterarLicenca({ requisitosTecnicos })}
              />
            </>
          ) : (
            <section className="painel">
              <header className="painel-cabecalho">
                <h3>Identificação da licença</h3>
              </header>
              <div className="linha-campos">
                {(
                  [
                    ["nomeComercial", "Licença", "ex.: Afiliação nacional SNOMED International", true],
                    ["fabricante", "Fabricante / titular dos direitos", "ex.: SNOMED International", true],
                    ["versao", "Versão / edição mínima", "facultativo", false],
                  ] as const
                ).map(([campo, rotulo, exemplo, obrigatorio]) => (
                  <label key={campo} className="campo-crescente">
                    <span className="rotulo">{rotulo}</span>
                    <input
                      type="text"
                      value={emEdicao[campo]}
                      placeholder={exemplo}
                      aria-invalid={obrigatorio && emEdicao[campo].trim() === ""}
                      onChange={(e) => alterarLicenca({ [campo]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="linha-campos linha-campos-separada">
                <Escolha<Exclude<FundamentoLicenca, "">>
                  rotulo="Fundamento da escolha"
                  valor={emEdicao.fundamento}
                  opcoes={deRegisto(FUNDAMENTOS_LICENCA)}
                  onChange={(fundamento) => alterarLicenca({ fundamento })}
                />
              </div>
              <label className="campo">
                <span className="rotulo">Explicação (sai na manifestação de necessidades)</span>
                <textarea
                  rows={3}
                  value={emEdicao.explicacaoFundamento}
                  placeholder="ex.: A SNOMED International é a única entidade que licencia a SNOMED CT…"
                  aria-invalid={emEdicao.explicacaoFundamento.trim() === ""}
                  onChange={(e) => alterarLicenca({ explicacaoFundamento: e.target.value })}
                />
              </label>
              <p className="ajuda">
                Obrigatórios, exceto a versão. A escolha de uma licença determinada afasta a concorrência entre
                fabricantes e tem de ficar fundamentada na manifestação de necessidades.
              </p>
            </section>
          )}

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Tipo de licenciamento</h3>
            </header>
            <div className="linha-campos">
              <Escolha<ObjetoLicenca>
                rotulo="Objeto da licença"
                valor={emEdicao.objeto}
                opcoes={deRegisto(OBJETOS_LICENCA)}
                onChange={(objeto) => objeto !== "" && alterarLicenca({ objeto })}
              />
              <Escolha<DireitoUso>
                rotulo="Direito de uso"
                valor={emEdicao.direitoUso}
                opcoes={deRegisto(DIREITOS_USO)}
                onChange={(direitoUso) => direitoUso !== "" && alterarLicenca({ direitoUso })}
              />
              <Escolha<Modalidade>
                rotulo="Modalidade"
                valor={emEdicao.modalidade}
                opcoes={deRegisto(MODALIDADES)}
                onChange={(modalidade) => modalidade !== "" && alterarLicenca({ modalidade })}
              />
              <Escolha<Manutencao>
                rotulo="Manutenção e suporte"
                valor={emEdicao.direitoUso === "temporario" ? "incluida" : emEdicao.manutencao}
                opcoes={deRegisto(MANUTENCOES).filter(([v]) => emEdicao.direitoUso === "perpetuo" || v === "incluida")}
                onChange={(manutencao) => manutencao !== "" && alterarLicenca({ manutencao })}
              />
            </div>
            {emEdicao.objeto === "outro" && (
              <div className="linha-campos linha-campos-separada">
                <label className="campo-crescente">
                  <span className="rotulo">Objeto da licença (indicar)</span>
                  <input
                    type="text"
                    value={emEdicao.objetoOutro}
                    placeholder="ex.: Base de dados de informação sobre medicamentos"
                    aria-invalid={emEdicao.objetoOutro.trim() === ""}
                    onChange={(e) => alterarLicenca({ objetoOutro: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="linha-campos linha-campos-numeros">
              <label className="campo-numero-rotulado">
                <span className="rotulo">
                  {emEdicao.direitoUso === "temporario" ? "Período da subscrição" : "Período da manutenção"}
                </span>
                <CampoNumero
                  valor={emEdicao.periodoMeses}
                  min={1}
                  step={1}
                  sufixo="meses"
                  aria-label="Período em meses"
                  invalido={
                    !Number.isInteger(emEdicao.periodoMeses) ||
                    emEdicao.periodoMeses < 1 ||
                    emEdicao.periodoMeses > MESES_MAXIMOS ||
                    (anual && emEdicao.periodoMeses % 12 !== 0)
                  }
                  onChange={(periodoMeses) => alterarLicenca({ periodoMeses })}
                />
              </label>
              {emEdicao.direitoUso === "perpetuo" && emEdicao.manutencao === "aParte" && (
                <label className="campo-numero-rotulado">
                  <span className="rotulo">Manutenção de referência</span>
                  <CampoNumero
                    valor={emEdicao.percentagemManutencao}
                    min={0}
                    step={1}
                    sufixo="% / ano"
                    aria-label="Percentagem anual de referência da manutenção"
                    invalido={!(emEdicao.percentagemManutencao > 0)}
                    onChange={(percentagemManutencao) => alterarLicenca({ percentagemManutencao })}
                  />
                </label>
              )}
            </div>
            <p className="ajuda">
              {emEdicao.direitoUso === "temporario"
                ? "Na subscrição, a manutenção está sempre incluída no preço."
                : "Na licença perpétua, a manutenção pode estar incluída no preço, não ser contratada, ou ter linha própria no mapa de preços — no mesmo procedimento e no mesmo lote —, com preço anual. A percentagem é a referência para o valor estimado: o concorrente indica o preço anual."}{" "}
              O período não pode exceder {MESES_MAXIMOS} meses (art.º 48.º do CCP); acima de 12, o L3 pede encargos
              plurianuais.
            </p>
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Classificação eAvalia</h3>
              <p className="painel-nota">
                Preenche a folha «Custos - Licenciamento». Só se escolhe o que não decorre das escolhas acima.
              </p>
            </header>
            <div className="linha-campos">
              {aberta ? (
                <label className="campo-crescente">
                  <span className="rotulo">Tipo de solução</span>
                  <select value="Submissão à concorrência" disabled aria-readonly="true" className="campo-bloqueado">
                    <option>Submissão à concorrência</option>
                  </select>
                </label>
              ) : (
                <Escolha
                  rotulo="Tipo de solução"
                  valor={emEdicao.eavalia.tipoSolucao}
                  opcoes={iguais(TIPOS_SOLUCAO_DETERMINADA)}
                  onChange={(tipoSolucao) => alterarLicenca({ eavalia: { ...emEdicao.eavalia, tipoSolucao } })}
                />
              )}
              <Escolha
                rotulo="Âmbito"
                valor={emEdicao.eavalia.ambito}
                opcoes={iguais(AMBITOS_EAVALIA)}
                onChange={(ambito) => alterarLicenca({ eavalia: { ...emEdicao.eavalia, ambito } })}
              />
            </div>
            {aberta ? (
              <p className="ajuda">
                Bloqueado: numa aquisição aberta à concorrência, o tipo de solução é sempre «Submissão à concorrência».
              </p>
            ) : (
              <Explicacao pergunta="O que quer dizer cada tipo de solução?">
                <ul>
                  {TIPOS_SOLUCAO_DETERMINADA.map((t) => (
                    <li key={t}>
                      <strong>{t}.</strong> {EXPLICACAO_TIPOS_SOLUCAO[t]}
                    </li>
                  ))}
                </ul>
              </Explicacao>
            )}
            <div className="valores-derivados">
              <Derivado
                rotulo="Tipo"
                valor={tipoEavalia(emEdicao)}
                origem={`do direito de uso «${DIREITOS_USO[emEdicao.direitoUso].toLowerCase()}»`}
              />
              <Derivado
                rotulo="Tipo de licenciamento"
                valor={ROTULO_TIPO_LICENCIAMENTO[tipoLicenciamentoEavalia(emEdicao)]}
                origem={`da modalidade «${MODALIDADES[emEdicao.modalidade].toLowerCase()}»`}
              />
              <Derivado
                rotulo="Consulta ao mercado"
                valor={consultaMercadoEavalia(pedido.natureza)}
                origem={`da natureza «${aberta ? "aberta à concorrência" : "licença determinada"}»`}
              />
            </div>
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Métrica, quantidade e preço de referência</h3>
            </header>
            <div className="linha-campos">
              <Escolha<Exclude<Metrica, "">>
                rotulo="Métrica de licenciamento"
                valor={emEdicao.metrica}
                opcoes={(Object.entries(METRICAS) as Array<[Exclude<Metrica, "">, { singular: string }]>).map(
                  ([v, m]) => [v, m.singular] as const,
                )}
                onChange={(metrica) => alterarLicenca({ metrica })}
              />
              {emEdicao.direitoUso === "temporario" && (
                <Escolha<PeriodicidadePreco>
                  rotulo="Periodicidade do preço"
                  valor={emEdicao.periodicidadePreco}
                  opcoes={deRegisto(PERIODICIDADES)}
                  onChange={(periodicidadePreco) => periodicidadePreco !== "" && alterarLicenca({ periodicidadePreco })}
                />
              )}
              <Escolha<Exclude<OrigemPreco, "">>
                rotulo="Origem do preço de referência"
                valor={emEdicao.origemPreco}
                opcoes={deRegisto(ORIGENS_PRECO)}
                onChange={(origemPreco) => alterarLicenca({ origemPreco })}
              />
            </div>
            <div className="linha-campos linha-campos-numeros">
              <label className="campo-numero-rotulado">
                <span className="rotulo">Quantidade</span>
                {unica ? (
                  <span className="campo-numero">
                    <input type="number" value={1} readOnly aria-readonly="true" className="campo-bloqueado" />
                    <span className="sufixo-campo">licença única</span>
                  </span>
                ) : (
                  <CampoNumero
                    valor={emEdicao.quantidade}
                    min={1}
                    step={1}
                    aria-label="Quantidade"
                    invalido={!Number.isInteger(emEdicao.quantidade) || emEdicao.quantidade < 1}
                    onChange={(quantidade) => alterarLicenca({ quantidade })}
                  />
                )}
              </label>
              <label className="campo-numero-rotulado">
                <span className="rotulo">Preço unitário de referência (s/ IVA)</span>
                <CampoNumero
                  valor={emEdicao.precoUnitario}
                  min={0}
                  step={0.01}
                  sufixo={emEdicao.direitoUso === "temporario" ? (anual ? "€ / ano" : "€ / mês") : "€"}
                  aria-label="Preço unitário de referência"
                  invalido={!(emEdicao.precoUnitario > 0)}
                  onChange={(precoUnitario) => alterarLicenca({ precoUnitario })}
                />
              </label>
            </div>
            {unica && (
              <p className="ajuda">
                Licença única: cobre todo o território ou toda a entidade, e a quantidade fica em 1. O preço é o da
                licença inteira.
              </p>
            )}
            {valor !== null && valor.total > 0 && (
              <p className="ajuda">
                <strong>Valor estimado desta licença: {formatarMoeda(valor.total)} sem IVA</strong> (
                {emEdicao.direitoUso === "temporario"
                  ? `${formatarNumero(emEdicao.quantidade)} × ${formatarMoeda(emEdicao.precoUnitario)} × ${
                      anual ? `${formatarNumero(emEdicao.periodoMeses / 12)} anos` : `${emEdicao.periodoMeses} meses`
                    }`
                  : `${formatarNumero(emEdicao.quantidade)} × ${formatarMoeda(emEdicao.precoUnitario)}${
                      valor.manutencao > 0 ? ` + manutenção ${formatarMoeda(valor.manutencao)}` : ""
                    }`}
                ), antes da margem prudencial, que se fixa no L3.
              </p>
            )}
          </section>
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

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para as condições do contrato</h3>
          <p className="painel-nota">
            {erros.length === 0
              ? "As licenças estão completas."
              : `${erros.length === 1 ? "1 questão" : `${erros.length} questões`} por resolver — pode avançar e voltar depois.`}
          </p>
        </div>
        <button type="button" className="botao-principal" onClick={onIrParaCondicoes}>
          Continuar para L2 →
        </button>
      </section>
    </div>
  );
}
