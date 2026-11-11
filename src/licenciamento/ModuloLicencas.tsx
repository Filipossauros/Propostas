import { useRef, useState } from "react";
import type { JustificacaoProjeto } from "../core/types";
import type {
  DireitoUso,
  FundamentoProduto,
  Manutencao,
  Metrica,
  Modalidade,
  NaturezaAquisicao,
  OrigemPreco,
  PedidoLicenciamento,
  ProdutoLicenca,
} from "../core/licenciamento";
import {
  AMBITOS_EAVALIA,
  DIREITOS_USO,
  FUNDAMENTOS_PRODUTO,
  MANUTENCOES,
  MESES_MAXIMOS,
  METRICAS,
  MODALIDADES,
  ORIGENS_PRECO,
  PROJETO_LICENCIAMENTO_EXEMPLO,
  RESPOSTAS_CONSULTA_MERCADO,
  TIPOS_EAVALIA,
  TIPOS_LICENCIAMENTO_EAVALIA,
  TIPOS_SOLUCAO_EAVALIA,
  comAlteracao,
  comNatureza,
  criarProduto,
  importarPedidoLicenciamentoJSON,
  nomeDoProduto,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoInicial,
  resumoDoTipo,
  validarLicencas,
  validarProduto,
  valorDoProduto,
} from "../core/licenciamento";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import { ErroImportacao } from "../core/perfil";
import { gerarId } from "../core/id";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";

export interface ProjetoDoFicheiro {
  nomeProjeto: string;
  descricaoProjeto: string;
  justificacao: JustificacaoProjeto;
}

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  /** Substitui o projeto do Módulo 1 (usado ao carregar o exemplo). */
  onDefinirProjeto: (projeto: ProjetoDoFicheiro) => void;
  /** Aceita o projeto vindo de um ficheiro, campo a campo, onde ainda não houver nada escrito. */
  onAdotarProjeto: (projeto: ProjetoDoFicheiro) => void;
  onIrParaCondicoes: () => void;
}

const NATUREZAS: Array<{ valor: NaturezaAquisicao; titulo: string; texto: string }> = [
  {
    valor: "aberta",
    titulo: "Aberta à concorrência",
    texto:
      "Concurso público ou consulta prévia. Descreve-se a categoria de software e os requisitos mínimos; qualquer " +
      "fabricante pode concorrer. O produto só se conhece na proposta.",
  },
  {
    valor: "determinado",
    titulo: "Produto determinado",
    texto:
      "Renovação ou alargamento de uma plataforma já instalada, direitos exclusivos do fabricante ou compatibilidade " +
      "técnica. Identifica-se o produto e fundamenta-se a escolha (art.º 24.º do CCP).",
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

/**
 * L1 · Licenças: o software a licenciar — o que é, como se conta, quantas
 * licenças, por quanto tempo e a que preço de referência.
 */
export function ModuloLicencas({ pedido, onAlterar, onDefinirProjeto, onAdotarProjeto, onIrParaCondicoes }: Props) {
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(pedido.produtos[0]?.id ?? null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const podeCarregarExemplo = usePodeCarregarExemplo();

  const emEdicao = pedido.produtos.find((p) => p.id === idEmEdicao) ?? pedido.produtos[0] ?? null;
  const aberta = pedido.natureza === "aberta";
  const erros = validarLicencas(pedido);

  function alterarProduto(alteracao: Partial<ProdutoLicenca>) {
    if (emEdicao === null) return;
    onAlterar((atual) => ({
      ...atual,
      produtos: atual.produtos.map((p) => (p.id === emEdicao.id ? comAlteracao(p, alteracao) : p)),
    }));
  }

  function novoProduto() {
    const novo = criarProduto(pedido.natureza);
    onAlterar((atual) => ({ ...atual, produtos: [...atual.produtos, novo] }));
    setIdEmEdicao(novo.id);
  }

  function duplicar(p: ProdutoLicenca) {
    const copia = { ...structuredClone(p), id: gerarId() };
    onAlterar((atual) => ({ ...atual, produtos: [...atual.produtos, copia] }));
    setIdEmEdicao(copia.id);
  }

  function remover(p: ProdutoLicenca) {
    if (!confirm(`Remover «${nomeDoProduto(p, pedido.natureza) || "produto sem nome"}»?`)) return;
    onAlterar((atual) => ({ ...atual, produtos: atual.produtos.filter((x) => x.id !== p.id) }));
    if (idEmEdicao === p.id) setIdEmEdicao(null);
  }

  async function importar(ficheiro: File) {
    try {
      const importado = importarPedidoLicenciamentoJSON(await ficheiro.text());
      if (pedido.produtos.length > 0 && !confirm("Substituir o pedido em edição pelo do ficheiro?")) return;
      onAlterar(() => importado);
      onAdotarProjeto(importado);
      setIdEmEdicao(importado.produtos[0]?.id ?? null);
      setMensagem({ tipo: "sucesso", texto: `Pedido importado: ${importado.produtos.length} produto(s).` });
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
    onDefinirProjeto(structuredClone(PROJETO_LICENCIAMENTO_EXEMPLO));
    setIdEmEdicao(exemplo.produtos[0].id);
    setMensagem({ tipo: "sucesso", texto: "Pedido de licenciamento de exemplo carregado (com o projeto do Módulo 1)." });
  }

  function recomecar() {
    if (!confirm("Apagar o pedido de licenciamento em edição (licenças, condições e lotes) e recomeçar do zero?")) return;
    onAlterar(() => pedidoLicenciamentoInicial());
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Pedido de licenciamento reposto." });
  }

  const valor = emEdicao === null ? null : valorDoProduto(emEdicao, Math.ceil(emEdicao.periodoMeses / 12) || 1);

  return (
    <div className="modulo modulo-licenciamento">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo L1 · Licenças</h2>
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
          O software a licenciar: o que é, como se conta, quantas licenças, por quanto tempo e a que preço de
          referência.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o gestor do projeto, com a área técnica.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Natureza da aquisição</h3>
          <p className="painel-nota">
            Decide o que se descreve: numa aquisição aberta à concorrência descreve-se a necessidade; quando o produto
            está determinado, identifica-se o produto e fundamenta-se a escolha.
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
                onChange={() => onAlterar((atual) => comNatureza(atual, n.valor))}
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
          <h3>Produtos</h3>
          <p className="painel-nota">Escolha um produto para o editar em baixo.</p>
        </header>

        {pedido.produtos.length === 0 ? (
          <p className="estado-vazio">Ainda não há produtos. Crie o primeiro.</p>
        ) : (
          <ul className="lista-perfis-catalogo">
            {pedido.produtos.map((p) => {
              const porResolver = validarProduto(p, pedido.natureza);
              const ativo = p.id === emEdicao?.id;
              return (
                <li key={p.id} className={ativo ? "perfil-catalogo perfil-catalogo-ativo" : "perfil-catalogo"}>
                  <button
                    type="button"
                    className="perfil-catalogo-alvo"
                    aria-current={ativo ? "true" : undefined}
                    onClick={() => setIdEmEdicao(p.id)}
                  >
                    <strong>{nomeDoProduto(p, pedido.natureza) || "(produto sem nome)"}</strong>
                    <span className="meta">
                      {resumoDoTipo(p)}
                      {p.quantidade > 0 && p.metrica !== "" && ` · ${formatarNumero(p.quantidade)} ${METRICAS[p.metrica].plural.toLowerCase()}`}
                      {" · "}
                      {porResolver.length === 0 ? (
                        <span className="estado-perfil">completo</span>
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
          <button type="button" className="botao-secundario" onClick={novoProduto}>
            + Novo produto
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
          Cada produto é uma linha do mapa de quantidades e preços. Por omissão, cada produto forma um lote; os lotes
          acertam-se no L3. O JSON do pedido sai no Anexo Técnico (L3) e traz as licenças, as condições e os lotes.
        </p>
      </section>

      {emEdicao !== null && (
        <>
          {aberta ? (
            <>
              <section className="painel">
                <header className="painel-cabecalho">
                  <h3>Descrição do software</h3>
                  <p className="painel-nota">
                    Sem marca nem fabricante: o que o software tem de fazer. Sai nas Especificações Técnicas (Anexo
                    III) como especificação mínima.
                  </p>
                </header>
                <div className="linha-campos">
                  <label className="campo-crescente">
                    <span className="rotulo">Designação do produto no procedimento</span>
                    <input
                      type="text"
                      className="campo-designacao-produto"
                      value={emEdicao.designacao}
                      placeholder="ex.: Plataforma de gestão documental"
                      aria-invalid={emEdicao.designacao.trim() === ""}
                      onChange={(e) => alterarProduto({ designacao: e.target.value })}
                    />
                    {emEdicao.designacao.trim() === "" && (
                      <span className="aviso-inline aviso-inline-falta">Dê uma designação ao produto.</span>
                    )}
                  </label>
                  <label className="campo-crescente">
                    <span className="rotulo">Categoria de software</span>
                    <input
                      type="text"
                      value={emEdicao.categoria}
                      placeholder="ex.: Gestão documental e workflow"
                      aria-invalid={emEdicao.categoria.trim() === ""}
                      onChange={(e) => alterarProduto({ categoria: e.target.value })}
                    />
                    {emEdicao.categoria.trim() === "" && (
                      <span className="aviso-inline aviso-inline-falta">Indique a categoria.</span>
                    )}
                  </label>
                </div>
              </section>

              <ListaItensEditor
                titulo="Requisitos funcionais mínimos"
                nota={
                  "Obrigatório. Um requisito por linha: o que o software tem de fazer, sem marca nem produto. Saem " +
                  "no Anexo III, em tabela, e são condições do contrato — não se pontuam."
                }
                nomeItem="requisito funcional"
                rotuloColuna="Requisito funcional mínimo"
                placeholder="ex.: Fluxos de aprovação configuráveis sem programação"
                textoVazio="Ainda não há requisitos funcionais. Acrescente o primeiro."
                rotuloAdicionar="+ Adicionar requisito funcional"
                itens={emEdicao.requisitosFuncionais}
                onChange={(requisitosFuncionais) => alterarProduto({ requisitosFuncionais })}
              />

              <ListaItensEditor
                titulo="Requisitos técnicos mínimos"
                nota={
                  "Opcional. Um requisito por linha: autenticação, alojamento, integração, segurança. Saem no Anexo " +
                  "III, por baixo dos funcionais."
                }
                nomeItem="requisito técnico"
                rotuloColuna="Requisito técnico mínimo"
                placeholder="ex.: Autenticação por SSO (SAML 2.0 / OIDC)"
                textoVazio="Este produto não tem requisitos técnicos próprios."
                rotuloAdicionar="+ Adicionar requisito técnico"
                itens={emEdicao.requisitosTecnicos}
                onChange={(requisitosTecnicos) => alterarProduto({ requisitosTecnicos })}
              />
            </>
          ) : (
            <section className="painel">
              <header className="painel-cabecalho">
                <h3>Identificação do produto</h3>
              </header>
              <div className="linha-campos">
                {(
                  [
                    ["produto", "Produto", "ex.: DocFlow Enterprise", true],
                    ["fabricante", "Fabricante", "ex.: Fabricante X", true],
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
                      onChange={(e) => alterarProduto({ [campo]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="linha-campos linha-campos-separada">
                <Escolha<Exclude<FundamentoProduto, "">>
                  rotulo="Fundamento da escolha do produto"
                  valor={emEdicao.fundamento}
                  opcoes={deRegisto(FUNDAMENTOS_PRODUTO)}
                  onChange={(fundamento) => alterarProduto({ fundamento })}
                />
              </div>
              <label className="campo">
                <span className="rotulo">Explicação (sai na manifestação de necessidades)</span>
                <textarea
                  rows={3}
                  value={emEdicao.explicacaoFundamento}
                  placeholder="ex.: A plataforma está instalada e integrada com os sistemas da SPMS desde 2022…"
                  aria-invalid={emEdicao.explicacaoFundamento.trim() === ""}
                  onChange={(e) => alterarProduto({ explicacaoFundamento: e.target.value })}
                />
              </label>
              <p className="ajuda">
                Obrigatórios, exceto a versão. A escolha de um produto determinado afasta a concorrência entre
                fabricantes e tem de ficar fundamentada na manifestação de necessidades.
              </p>
            </section>
          )}

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Tipo de licenciamento</h3>
            </header>
            <div className="linha-campos">
              <Escolha<DireitoUso>
                rotulo="Direito de uso"
                valor={emEdicao.direitoUso}
                opcoes={deRegisto(DIREITOS_USO)}
                onChange={(direitoUso) => direitoUso !== "" && alterarProduto({ direitoUso })}
              />
              <Escolha<Modalidade>
                rotulo="Modalidade"
                valor={emEdicao.modalidade}
                opcoes={deRegisto(MODALIDADES)}
                onChange={(modalidade) => modalidade !== "" && alterarProduto({ modalidade })}
              />
              <Escolha<Manutencao>
                rotulo="Manutenção e suporte"
                valor={emEdicao.manutencao}
                opcoes={deRegisto(MANUTENCOES).filter(([v]) => v !== "aParte" || emEdicao.direitoUso === "perpetuo")}
                onChange={(manutencao) => manutencao !== "" && alterarProduto({ manutencao })}
              />
            </div>
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
                  invalido={!Number.isInteger(emEdicao.periodoMeses) || emEdicao.periodoMeses < 1 || emEdicao.periodoMeses > MESES_MAXIMOS}
                  onChange={(periodoMeses) => alterarProduto({ periodoMeses })}
                />
              </label>
              {emEdicao.direitoUso === "perpetuo" && emEdicao.manutencao === "aParte" && (
                <label className="campo-numero-rotulado">
                  <span className="rotulo">Manutenção anual</span>
                  <CampoNumero
                    valor={emEdicao.percentagemManutencao}
                    min={0}
                    step={1}
                    sufixo="% / ano"
                    aria-label="Percentagem anual da manutenção"
                    invalido={!(emEdicao.percentagemManutencao > 0)}
                    onChange={(percentagemManutencao) => alterarProduto({ percentagemManutencao })}
                  />
                </label>
              )}
            </div>
            <p className="ajuda">
              {emEdicao.direitoUso === "temporario"
                ? "Na subscrição, paga-se por licença e por mês, durante o período indicado."
                : "Na licença perpétua, paga-se a licença de uma vez; a manutenção à parte é uma percentagem anual do valor das licenças, durante o período indicado."}{" "}
              O período não pode exceder {MESES_MAXIMOS} meses (art.º 48.º do CCP); acima de 12, o L3 pede encargos
              plurianuais.
            </p>
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Classificação eAvalia</h3>
              <p className="painel-nota">
                Listas do formulário eAvalia da ARTE. Preenchem a folha «Custos - Licenciamento»; a folha «Custos -
                Serviços» fica por preencher.
              </p>
            </header>
            <div className="linha-campos linha-campos-eavalia">
              <Escolha
                rotulo="Tipo de solução"
                valor={emEdicao.eavalia.tipoSolucao}
                opcoes={iguais(TIPOS_SOLUCAO_EAVALIA)}
                onChange={(tipoSolucao) => alterarProduto({ eavalia: { ...emEdicao.eavalia, tipoSolucao } })}
              />
              <Escolha
                rotulo="Tipo"
                valor={emEdicao.eavalia.tipo}
                opcoes={iguais(TIPOS_EAVALIA)}
                onChange={(tipo) => alterarProduto({ eavalia: { ...emEdicao.eavalia, tipo } })}
              />
              <Escolha
                rotulo="Âmbito"
                valor={emEdicao.eavalia.ambito}
                opcoes={iguais(AMBITOS_EAVALIA)}
                onChange={(ambito) => alterarProduto({ eavalia: { ...emEdicao.eavalia, ambito } })}
              />
            </div>
            <div className="linha-campos linha-campos-separada">
              <Escolha
                rotulo="Tipo de licenciamento"
                valor={emEdicao.eavalia.tipoLicenciamento}
                opcoes={iguais(TIPOS_LICENCIAMENTO_EAVALIA)}
                onChange={(tipoLicenciamento) => alterarProduto({ eavalia: { ...emEdicao.eavalia, tipoLicenciamento } })}
              />
              <Escolha
                rotulo="Consulta ao mercado"
                valor={emEdicao.eavalia.consultaMercado}
                opcoes={iguais(RESPOSTAS_CONSULTA_MERCADO)}
                onChange={(consultaMercado) => alterarProduto({ eavalia: { ...emEdicao.eavalia, consultaMercado } })}
              />
            </div>
            <p className="ajuda">
              Obrigatórios. As opções são as do formulário e não admitem outras. O tipo de solução é sugerido pela
              natureza da aquisição — «Submissão à concorrência» na aberta; «Software Proprietário sem alternativas»
              ou «com apresentação TCO» no produto determinado; «Solução Software Livre» vai para a secção do código
              aberto. O tipo e o tipo de licenciamento acompanham o direito de uso e a modalidade, e podem ser
              corrigidos.
            </p>
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
                onChange={(metrica) => alterarProduto({ metrica })}
              />
              <Escolha<Exclude<OrigemPreco, "">>
                rotulo="Origem do preço de referência"
                valor={emEdicao.origemPreco}
                opcoes={deRegisto(ORIGENS_PRECO)}
                onChange={(origemPreco) => alterarProduto({ origemPreco })}
              />
            </div>
            <div className="linha-campos linha-campos-numeros">
              <label className="campo-numero-rotulado">
                <span className="rotulo">Quantidade</span>
                <CampoNumero
                  valor={emEdicao.quantidade}
                  min={1}
                  step={1}
                  aria-label="Quantidade"
                  invalido={!Number.isInteger(emEdicao.quantidade) || emEdicao.quantidade < 1}
                  onChange={(quantidade) => alterarProduto({ quantidade })}
                />
              </label>
              <label className="campo-numero-rotulado">
                <span className="rotulo">Preço unitário de referência (s/ IVA)</span>
                <CampoNumero
                  valor={emEdicao.precoUnitario}
                  min={0}
                  step={0.01}
                  sufixo={emEdicao.direitoUso === "temporario" ? "€ / mês" : "€"}
                  aria-label="Preço unitário de referência"
                  invalido={!(emEdicao.precoUnitario > 0)}
                  onChange={(precoUnitario) => alterarProduto({ precoUnitario })}
                />
              </label>
            </div>
            {valor !== null && valor.total > 0 && (
              <p className="ajuda">
                <strong>Valor estimado deste produto: {formatarMoeda(valor.total)} sem IVA</strong> (
                {emEdicao.direitoUso === "temporario"
                  ? `${formatarNumero(emEdicao.quantidade)} × ${formatarMoeda(emEdicao.precoUnitario)} × ${emEdicao.periodoMeses} meses`
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
