import { useRef, useState } from "react";
import type {
  DireitoUso,
  FundamentoLicenca,
  Licenca,
  Manutencao,
  ConviteEntidades,
  FormaPreco,
  Metrica,
  Modalidade,
  NaturezaAquisicao,
  ObjetoLicenca,
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
  MINIMO_ENTIDADES_CONVIDADAS,
  ehPrecoGlobal,
  metricaPorExtenso,
  METRICAS_UNICAS,
  MODALIDADES,
  OBJETOS_LICENCA,
  PERIODICIDADES,
  TIPOS_SOLUCAO_DETERMINADA,
  comAlteracao,
  ehServico,
  fonteVazia,
  semIvaDe,
  criarLicenca,
  importarPedidoLicenciamentoJSON,
  nomeDaLicenca,
  pedidoLicenciamentoExemplo,
  pedidoLicenciamentoInicial,
  resumoDoTipo,
  validarLicenca,
  validarLicencas,
  valorDaLicenca,
} from "../core/licenciamento";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import { ErroImportacao } from "../core/perfil";
import { gerarId } from "../core/id";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";
import { EditorOrigemPreco } from "./EditorOrigemPreco";
import { CampoNumero } from "../ui/CampoNumero";
import { Explicacao } from "../ui/Explicacao";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  onIrParaCondicoes: () => void;
}

const NATUREZAS: Array<{
  valor: NaturezaAquisicao;
  titulo: string;
  texto: string;
}> = [
  {
    valor: "aberta",
    titulo: "Aberta à concorrência",
    texto:
      "Concurso público ou, com convite a entidades escolhidas, consulta prévia. Descreve-se a licença e os " +
      "requisitos mínimos; qualquer fabricante pode concorrer. No eAvalia: «Submissão à concorrência» e consulta " +
      "ao mercado «Sim».",
  },
  {
    valor: "determinado",
    titulo: "Confiada a determinada entidade",
    texto:
      "Por motivos técnicos ou de proteção de direitos exclusivos, a prestação só pode ser confiada a determinada " +
      "entidade (art.º 24.º, n.º 1, alínea e), do CCP): renovação ou alargamento de uma plataforma já instalada, " +
      "direitos exclusivos do fabricante ou titular, ou compatibilidade técnica. Identifica-se a licença e " +
      "fundamenta-se a escolha. No eAvalia: consulta ao mercado «Não», salvo se o preço vier de uma consulta " +
      "preliminar.",
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

const FORMAS_PRECO: Array<{
  valor: FormaPreco;
  titulo: string;
  texto: string;
}> = [
  {
    valor: "unitario",
    titulo: "Preço unitário",
    texto: "Quantidade × preço unitário. O concorrente cota o preço de cada licença; o mapa de preços multiplica.",
  },
  {
    valor: "global",
    titulo: "Preço global",
    texto:
      "Indica-se só o preço final. A quantidade descreve a dimensão da licença, mas não multiplica o preço; o " +
      "concorrente cota um valor único.",
  },
];

/** O convite a entidades escolhidas (consulta prévia), só na aquisição aberta. */
function PainelConvite({ pedido, onAlterar }: Pick<Props, "pedido" | "onAlterar">) {
  const c = pedido.convite;
  const alterar = (alteracao: Partial<ConviteEntidades>) =>
    onAlterar((atual) => ({
      ...atual,
      convite: { ...atual.convite, ...alteracao },
    }));
  const opcoes = [
    {
      ativo: false,
      titulo: "Não",
      texto: "Procedimento aberto a qualquer interessado (concurso público).",
    },
    {
      ativo: true,
      titulo: "Sim",
      texto: `Consulta prévia: convite direto a pelo menos ${MINIMO_ENTIDADES_CONVIDADAS} entidades (art.os 112.º a 114.º do CCP).`,
    },
  ];
  return (
    <>
      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Convite a entidades específicas</h3>
          <p className="painel-nota">
            Pretende-se dirigir o convite a entidades escolhidas, em vez de um procedimento aberto a qualquer
            interessado?
          </p>
        </header>
        <div className="opcoes-natureza" role="radiogroup" aria-label="Convite a entidades específicas">
          {opcoes.map((o) => (
            <label
              key={o.titulo}
              className={c.ativo === o.ativo ? "opcao-natureza opcao-natureza-ativa" : "opcao-natureza"}
            >
              <input
                type="radio"
                name="convite-entidades"
                checked={c.ativo === o.ativo}
                onChange={() => alterar({ ativo: o.ativo })}
              />
              <span>
                <strong>{o.titulo}</strong>
                <span className="meta">{o.texto}</span>
              </span>
            </label>
          ))}
        </div>
        {c.ativo && (
          <label className="campo campo-convite-motivo">
            <span className="rotulo">Motivo do convite a estas entidades (sai na manifestação de necessidades)</span>
            <textarea
              rows={3}
              value={c.motivo}
              placeholder="ex.: São as entidades que, no mercado nacional, comercializam e dão suporte a plataformas com a escala exigida."
              aria-invalid={c.motivo.trim() === ""}
              onChange={(e) => alterar({ motivo: e.target.value })}
            />
          </label>
        )}
      </section>
      {c.ativo && (
        <ListaItensEditor
          titulo="Entidades a convidar"
          nota={`Uma entidade por linha, pelo menos ${MINIMO_ENTIDADES_CONVIDADAS}. Saem numa tabela na manifestação de necessidades.`}
          nomeItem="entidade"
          rotuloColuna="Entidade"
          placeholder="ex.: Documenta Sistemas, S.A."
          textoVazio="Ainda não há entidades. Acrescente a primeira."
          rotuloAdicionar="+ Adicionar entidade"
          itens={c.entidades}
          onChange={(entidades) => alterar({ entidades })}
        />
      )}
    </>
  );
}

const iguais = <T extends string>(lista: readonly T[]) => lista.map((v) => [v, v] as const);
const deRegisto = <T extends string>(registo: Record<T, string>) =>
  (Object.entries(registo) as Array<[T, string]>).map(([v, t]) => [v, t] as const);

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
    onAlterar((atual) => ({
      ...atual,
      licencas: atual.licencas.filter((x) => x.id !== l.id),
    }));
    if (idEmEdicao === l.id) setIdEmEdicao(null);
  }

  async function importar(ficheiro: File) {
    try {
      const importado = importarPedidoLicenciamentoJSON(await ficheiro.text());
      if (pedido.licencas.length > 0 && !confirm("Substituir o pedido em edição (com o produto) pelo do ficheiro?"))
        return;
      onAlterar(() => importado);
      setIdEmEdicao(importado.licencas[0]?.id ?? null);
      setMensagem({
        tipo: "sucesso",
        texto: `Pedido importado: ${importado.licencas.length} licença(s).`,
      });
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
    setMensagem({
      tipo: "sucesso",
      texto: "Exemplo carregado: a licença nacional da SNOMED CT, com o produto do Módulo 1.",
    });
  }

  function recomecar() {
    if (
      !confirm("Apagar o pedido de licenciamento em edição (produto, licenças, condições e lotes) e recomeçar do zero?")
    )
      return;
    onAlterar(() => pedidoLicenciamentoInicial());
    setIdEmEdicao(null);
    setMensagem({ tipo: "sucesso", texto: "Pedido de licenciamento reposto." });
  }

  const servico = emEdicao !== null && ehServico(emEdicao);
  const origensDoPreco =
    emEdicao === null ? null : (
      <div className="origens-preco">
        <EditorOrigemPreco
          rotulo="Origem do preço de referência"
          fonte={emEdicao.origemPreco}
          onChange={(origemPreco) => alterarLicenca({ origemPreco })}
        />
        <label className="campo-opcao">
          <input
            type="checkbox"
            checked={emEdicao.origemComplementar.tipo !== ""}
            onChange={(e) =>
              alterarLicenca({
                origemComplementar: e.target.checked
                  ? fonteVazia(emEdicao.origemPreco.tipo === "orcamento" ? "contratoAnterior" : "orcamento")
                  : fonteVazia(),
              })
            }
          />
          <span>
            <strong>Acrescentar uma origem complementar</strong>
            <span className="meta">
              Uma segunda fonte, que confirma a primeira — torna o valor estimado mais defensável.
            </span>
          </span>
        </label>
        {emEdicao.origemComplementar.tipo !== "" && (
          <EditorOrigemPreco
            rotulo="Origem complementar"
            fonte={emEdicao.origemComplementar}
            excluir={emEdicao.origemPreco.tipo}
            onChange={(origemComplementar) => alterarLicenca({ origemComplementar })}
          />
        )}
        <p className="ajuda">Os preços de referência são sempre em euros, com IVA.</p>
      </div>
    );

  /** O preço escreve-se com IVA; o sem IVA, com que se fazem as contas, deriva da taxa do pedido (L3). */
  const alterarPreco = (precoComIva: number) =>
    alterarLicenca({
      precoComIva,
      precoUnitario: semIvaDe(precoComIva, pedido.taxaIva),
    });
  const semIvaENota =
    emEdicao === null ? null : (
      <>
        {emEdicao.precoComIva > 0 && (
          <p className="ajuda">
            Sem IVA: {formatarMoeda(emEdicao.precoUnitario)} (IVA a {formatarNumero(pedido.taxaIva)} %, a taxa do L3). O
            valor estimado e as peças usam o preço sem IVA.
          </p>
        )}
        <label className="campo">
          <span className="rotulo">Nota ao preço de referência (facultativa)</span>
          <textarea
            rows={2}
            value={emEdicao.notaPreco}
            placeholder="ex.: Preço da renovação de 2025, a que o fabricante aplicou um aumento de 5 %."
            onChange={(e) => alterarLicenca({ notaPreco: e.target.value })}
          />
        </label>
      </>
    );

  const valor = emEdicao === null ? null : valorDaLicenca(emEdicao, Math.ceil(emEdicao.periodoMeses / 12) || 1);
  const unica = emEdicao !== null && emEdicao.metrica !== "" && METRICAS_UNICAS.includes(emEdicao.metrica);
  const anual = emEdicao?.direitoUso === "temporario" && emEdicao.periodicidadePreco === "anual";
  const global = emEdicao !== null && !unica && ehPrecoGlobal(emEdicao);

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
            Decide o que se descreve: numa aquisição aberta à concorrência descreve-se a necessidade; quando a prestação
            é confiada a determinada entidade, identifica-se a licença e fundamenta-se a escolha.
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

      {pedido.natureza === "aberta" && <PainelConvite pedido={pedido} onAlterar={onAlterar} />}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Licenças</h3>
          <p className="painel-nota">
            Cada licença é uma linha do mapa de quantidades e preços. Escolha uma para a editar em baixo.
          </p>
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
                        ` · ${ehPrecoGlobal(l) ? "até " : ""}${formatarNumero(l.quantidade)} ${metricaPorExtenso(l)}${
                          ehPrecoGlobal(l) ? " (preço global)" : ""
                        }`}
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

      {emEdicao !== null && servico && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Serviço associado</h3>
              <p className="painel-nota">
                Um serviço com preço próprio — suporte para adaptar a plataforma, configuração, formação —, que entra no
                mapa de quantidades e preços do lote como uma linha de preço global.
              </p>
            </header>
            <div className="linha-campos">
              <Escolha<ObjetoLicenca>
                rotulo="Objeto"
                valor={emEdicao.objeto}
                opcoes={deRegisto(OBJETOS_LICENCA)}
                onChange={(objeto) => objeto !== "" && alterarLicenca({ objeto })}
              />
              <label className="campo-crescente">
                <span className="rotulo">Designação do serviço</span>
                <input
                  type="text"
                  value={emEdicao.designacao}
                  placeholder="ex.: Suporte para adaptar as métricas da plataforma às necessidades da SPMS"
                  aria-invalid={emEdicao.designacao.trim() === ""}
                  onChange={(e) => alterarLicenca({ designacao: e.target.value })}
                />
              </label>
            </div>
            <p className="ajuda">
              Não é uma licença: não tem direito de uso, métrica nem classificação eAvalia própria. No eAvalia, o valor
              soma-se à linha «Instalação, configuração, atualização» da licença do mesmo lote.
            </p>
          </section>

          <ListaItensEditor
            titulo="Atividades do serviço"
            nota="Obrigatório. Uma atividade por linha: o que o serviço compreende. Saem no Anexo III, em tabela."
            nomeItem="atividade"
            rotuloColuna="Atividade"
            placeholder="ex.: Configuração dos indicadores e alertas da plataforma"
            textoVazio="Ainda não há atividades. Acrescente a primeira."
            rotuloAdicionar="+ Adicionar atividade"
            itens={emEdicao.requisitos}
            onChange={(requisitos) => alterarLicenca({ requisitos })}
          />

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Preço de referência</h3>
            </header>
            {origensDoPreco}
            <div className="linha-campos linha-campos-numeros">
              <label className="campo-numero-rotulado">
                <span className="rotulo">Preço global de referência (c/ IVA)</span>
                <CampoNumero
                  valor={emEdicao.precoComIva}
                  min={0}
                  step={0.01}
                  sufixo="€"
                  aria-label="Preço global de referência"
                  invalido={!(emEdicao.precoComIva > 0)}
                  onChange={alterarPreco}
                />
              </label>
            </div>
            {semIvaENota}
          </section>
        </>
      )}

      {emEdicao !== null && !servico && (
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
                titulo="Requisitos mínimos"
                nota={
                  "Obrigatório. Um requisito por linha — o que a licença tem de permitir e as exigências técnicas " +
                  "(autenticação, alojamento, integração, segurança), sem marca nem produto. Saem no Anexo III, numa " +
                  "única tabela, e são condições do contrato — não se pontuam."
                }
                nomeItem="requisito"
                rotuloColuna="Requisito mínimo"
                placeholder="ex.: Fluxos de aprovação configuráveis sem programação"
                textoVazio="Ainda não há requisitos. Acrescente o primeiro."
                rotuloAdicionar="+ Adicionar requisito"
                itens={emEdicao.requisitos}
                onChange={(requisitos) => alterarLicenca({ requisitos })}
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
                Preenche a folha «Custos - Licenciamento». O resto da classificação decorre das escolhas acima.
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
                  onChange={(tipoSolucao) =>
                    alterarLicenca({
                      eavalia: { ...emEdicao.eavalia, tipoSolucao },
                    })
                  }
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
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Métrica, quantidade e preço de referência</h3>
            </header>
            {!unica && (
              <div className="forma-preco">
                <span className="rotulo">Forma do preço</span>
                <div className="opcoes-natureza" role="radiogroup" aria-label="Forma do preço">
                  {FORMAS_PRECO.map((f) => (
                    <label
                      key={f.valor}
                      className={
                        emEdicao.formaPreco === f.valor ? "opcao-natureza opcao-natureza-ativa" : "opcao-natureza"
                      }
                    >
                      <input
                        type="radio"
                        name="forma-preco"
                        value={f.valor}
                        checked={emEdicao.formaPreco === f.valor}
                        onChange={() => alterarLicenca({ formaPreco: f.valor })}
                      />
                      <span>
                        <strong>{f.titulo}</strong>
                        <span className="meta">{f.texto}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
            </div>
            {origensDoPreco}
            {emEdicao.metrica === "volume" && (
              <div className="linha-campos linha-campos-separada">
                <label className="campo-crescente">
                  <span className="rotulo">Unidade de volume</span>
                  <input
                    type="text"
                    value={emEdicao.unidadeVolume}
                    placeholder="ex.: GB de armazenamento, análises por dia, documentos digitalizados"
                    aria-invalid={emEdicao.unidadeVolume.trim() === ""}
                    onChange={(e) => alterarLicenca({ unidadeVolume: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="linha-campos linha-campos-numeros">
              <label className="campo-numero-rotulado">
                <span className="rotulo">{global ? "Quantidade abrangida" : "Quantidade"}</span>
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
                    sufixo={emEdicao.metrica !== "" ? metricaPorExtenso({ ...emEdicao, quantidade: 2 }) : undefined}
                    invalido={!Number.isInteger(emEdicao.quantidade) || emEdicao.quantidade < 1}
                    onChange={(quantidade) => alterarLicenca({ quantidade })}
                  />
                )}
              </label>
              <label className="campo-numero-rotulado">
                <span className="rotulo">
                  {global ? "Preço global de referência (c/ IVA)" : "Preço unitário de referência (c/ IVA)"}
                </span>
                <CampoNumero
                  valor={emEdicao.precoComIva}
                  min={0}
                  step={0.01}
                  sufixo={emEdicao.direitoUso === "temporario" ? (anual ? "€ / ano" : "€ / mês") : "€"}
                  aria-label={global ? "Preço global de referência" : "Preço unitário de referência"}
                  invalido={!(emEdicao.precoComIva > 0)}
                  onChange={alterarPreco}
                />
              </label>
            </div>
            {semIvaENota}
            {unica && (
              <p className="ajuda">
                Licença única: cobre todo o território ou toda a entidade, e a quantidade fica em 1. O preço é o da
                licença inteira.
              </p>
            )}
            {global && (
              <p className="ajuda">
                Preço global: a quantidade descreve a dimensão da licença («até {formatarNumero(emEdicao.quantidade)}{" "}
                {metricaPorExtenso(emEdicao) || "licenças"}») e não multiplica o preço. No mapa de preços, o concorrente
                cota um valor único.
              </p>
            )}
            {valor !== null && valor.total > 0 && (
              <p className="ajuda">
                <strong>Valor estimado desta licença: {formatarMoeda(valor.total)} sem IVA</strong> (
                {emEdicao.direitoUso === "temporario"
                  ? `${global ? "" : `${formatarNumero(emEdicao.quantidade)} × `}${formatarMoeda(emEdicao.precoUnitario)} × ${
                      anual ? `${formatarNumero(emEdicao.periodoMeses / 12)} anos` : `${emEdicao.periodoMeses} meses`
                    }`
                  : `${global ? "" : `${formatarNumero(emEdicao.quantidade)} × `}${formatarMoeda(emEdicao.precoUnitario)}${
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
