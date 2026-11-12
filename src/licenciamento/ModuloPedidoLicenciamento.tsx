import { useState } from "react";
import { anosDeInicioAdmitidos } from "../core/types";
import type { ErroValidacao } from "../core/perfil";
import type { PedidoLicenciamento } from "../core/licenciamento";
import {
  PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO,
  anosDoPedido,
  comIva,
  comMargemLicenciamento,
  comTaxaIva,
  designacaoDoLote,
  justificacaoMargemDoPedido,
  margemDoPedido,
  linhasDoMapa,
  moverLicencaParaLote,
  nomeDaLicenca,
  nomeProcedimentoLicenciamento,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  validarProdutoLicenciamento,
  valorEstimado,
  valorPorAno,
  valoresDosLotes,
} from "../core/licenciamento";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import { ErroModeloEavalia } from "../excel/eavalia";
import { descarregarPacote } from "../ui/pacote";
import { ficheirosDoPedidoLicenciamento, nomeDoPacoteDeLicenciamento } from "../saidas/pacotes";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
}

/**
 * L3 · Pedido e Anexo Técnico: os lotes, o valor estimado, a margem, o júri e
 * o pacote com a manifestação de necessidades, o eAvalia, os mapas de
 * quantidades e preços e o JSON do pedido.
 */
export function ModuloPedidoLicenciamento({ pedido, onAlterar }: Props) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);

  const nomeProcedimento = nomeProcedimentoLicenciamento(pedido.nomeProduto);
  const anosDeInicio = anosDeInicioAdmitidos();
  const anos = anosDoPedido(pedido);
  const comMargem = comMargemLicenciamento(pedido);
  const lotes = valoresDosLotes(pedido);
  const lotesComMargem = valoresDosLotes(comMargem);
  const margem = margemDoPedido(pedido);

  const noModulo = (sufixo: string, lista: ErroValidacao[]) =>
    lista.map((e) => ({ ...e, mensagem: `${e.mensagem} (${sufixo})` }));
  const errosDoProduto = noModulo("Módulo 1 · Produto", validarProdutoLicenciamento(pedido));
  const errosDasLicencas = noModulo("L1 · Licenças", validarLicencas(pedido));
  const errosDasCondicoes = noModulo("L2 · Condições", validarCondicoes(pedido));
  const errosDoPedido = validarPedido(pedido);
  const erros = [...errosDoProduto, ...errosDasLicencas, ...errosDasCondicoes, ...errosDoPedido];
  const comPdf = pedido.numeroInformacao.trim() !== "" && pedido.numeroOrcamento.trim() !== "";

  async function descarregar() {
    setMensagem(null);
    setAGerar(true);
    try {
      await descarregarPacote(nomeDoPacoteDeLicenciamento(pedido.nomeProduto), await ficheirosDoPedidoLicenciamento(pedido));
    } catch (erro) {
      console.error(erro);
      setMensagem({
        tipo: "erro",
        texto:
          erro instanceof ErroModeloEavalia
            ? erro.message
            : `Não foi possível gerar o Anexo Técnico${erro instanceof Error && erro.message ? `: ${erro.message}` : "."}`,
      });
    } finally {
      setAGerar(false);
    }
  }

  return (
    <div className="modulo modulo-licenciamento">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo L3 · Pedido e Anexo Técnico</h2>
        </div>
        <p className="modulo-subtitulo">
          Agrupa as licenças em lotes, fixa o período e a margem, nomeia o júri e descarrega o pedido completo.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o responsável do procedimento.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Parâmetros do procedimento</h3>
        </header>
        <label>
          <span className="rotulo">Nome do procedimento</span>
          <input
            type="text"
            className="campo-derivado"
            value={nomeProcedimento}
            readOnly
            aria-readonly="true"
            placeholder={`${PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO}…`}
            title="Formado a partir do nome do produto. Altere o nome do produto no Módulo 1."
          />
        </label>
        <p className="ajuda">
          O nome do procedimento é «{PREFIXO_NOME_PROCEDIMENTO_LICENCIAMENTO.trim()}» seguido do nome do produto, e
          altera-se alterando esse nome no Módulo 1. Todos os preços unitários são introduzidos sem IVA.
        </p>

        <label className="campo-opcao">
          <input
            type="checkbox"
            checked={pedido.umLotePorConcorrente}
            onChange={(e) => onAlterar((atual) => ({ ...atual, umLotePorConcorrente: e.target.checked }))}
          />
          <span>
            <strong>Cada concorrente não pode ficar com mais do que um lote</strong>
            <span className="ajuda">
              Os lotes são apreciados por ordem do número: quem ficar com o lote 1 fica impedido nos seguintes. A regra
              sai no documento Word, com título próprio.
            </span>
          </span>
        </label>

        <label className="campo-opcao">
          <input
            type="checkbox"
            checked={pedido.encargosPlurianuais.ativo}
            onChange={(e) =>
              onAlterar((atual) => ({
                ...atual,
                encargosPlurianuais: { ...atual.encargosPlurianuais, ativo: e.target.checked },
              }))
            }
          />
          <span>
            <strong>Procedimento com encargos a mais de um ano</strong>
            <span className="meta">
              A execução estende-se por mais do que um ano económico, e a despesa dos anos seguintes carece de
              autorização prévia.
            </span>
          </span>
        </label>

        {pedido.encargosPlurianuais.ativo && (
          <div className="campo-dependente">
            <label className="campo-estreito">
              <span className="rotulo">Ano de início do contrato</span>
              <select
                value={pedido.encargosPlurianuais.anoInicio}
                aria-invalid={!anosDeInicio.includes(pedido.encargosPlurianuais.anoInicio)}
                onChange={(e) =>
                  onAlterar((atual) => ({
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
                {!anosDeInicio.includes(pedido.encargosPlurianuais.anoInicio) && (
                  <option value={pedido.encargosPlurianuais.anoInicio}>
                    {pedido.encargosPlurianuais.anoInicio} (fora do prazo)
                  </option>
                )}
              </select>
            </label>
            <p className="ajuda">
              O contrato começa em janeiro do ano de início; os anos do pedido são os que o maior período do L1
              abrange — {anos.join(", ")}. A subscrição e a manutenção repartem-se pelos meses de cada ano; as
              licenças perpétuas ficam no primeiro.
            </p>
          </div>
        )}
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Lotes</h3>
          <p className="painel-nota">
            Por omissão, um lote por licença. Para juntar licenças, mude o lote de uma delas para o lote da outra.
          </p>
        </header>

        {lotes.length === 0 && <p className="estado-vazio">Ainda não há licenças. Acrescente-as no L1.</p>}

        <div className="lista-lotes">
          {lotes.map((l) => (
            <div key={l.lote.id} className="lote-licenciamento">
              <div className="linha-campos">
                <strong className="lote-licenciamento-numero">Lote {l.lote.numero}</strong>
                <label className="campo-crescente">
                  <span className="rotulo-oculto">Designação do lote {l.lote.numero}</span>
                  <input
                    type="text"
                    value={l.lote.designacao}
                    placeholder={designacaoDoLote({ ...l.lote, designacao: "" }, pedido)}
                    onChange={(e) =>
                      onAlterar((atual) => ({
                        ...atual,
                        lotes: valoresDosLotes(atual).map((x) =>
                          x.lote.id === l.lote.id ? { ...x.lote, designacao: e.target.value } : x.lote,
                        ),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="tabela-envolvente">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Linha do mapa de preços</th>
                      <th scope="col">Métrica</th>
                      <th scope="col" className="numerico">
                        Qtd.
                      </th>
                      <th scope="col" className="numerico">
                        Períodos
                      </th>
                      <th scope="col" className="numerico">
                        Preço unit. <span className="cabecalho-nota">s/ IVA</span>
                      </th>
                      <th scope="col" className="numerico">
                        Valor <span className="cabecalho-nota">s/ IVA</span>
                      </th>
                      <th scope="col">Lote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.linhas.flatMap(({ licenca }) =>
                      linhasDoMapa(licenca, pedido.natureza, anos.length).map((linha, k) => (
                        <tr key={`${licenca.id}-${linha.tipo}`}>
                          <td>{linha.designacao}</td>
                          <td>{linha.metrica || "—"}</td>
                          <td className="numerico">{formatarNumero(linha.quantidade)}</td>
                          <td className="numerico">{formatarNumero(linha.periodos)}</td>
                          <td className="numerico">
                            {formatarMoeda(linha.precoUnitario)}
                            <span className="meta"> {linha.unidade.replace(/^€ /, "")}</span>
                          </td>
                          <td className="numerico">{formatarMoeda(linha.total)}</td>
                          <td>
                            {k === 0 && (
                              <select
                                className="seletor-lote"
                                value={l.lote.id}
                                aria-label={`Lote de ${nomeDaLicenca(licenca, pedido.natureza) || "licença"}`}
                                onChange={(e) =>
                                  onAlterar((atual) =>
                                    moverLicencaParaLote(atual, licenca.id, e.target.value === "" ? null : e.target.value),
                                  )
                                }
                              >
                                {lotes.map((x) => (
                                  <option key={x.lote.id} value={x.lote.id}>
                                    Lote {x.lote.numero}
                                  </option>
                                ))}
                                {l.linhas.length > 1 && <option value="">Novo lote</option>}
                              </select>
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={5}>
                        Valor do lote {l.lote.numero} <span className="cabecalho-nota">antes da margem</span>
                      </th>
                      <td className="numerico">
                        <strong>{formatarMoeda(l.total)}</strong>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
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

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Resumo do procedimento</h3>
        </header>
        {lotes.length === 0 ? (
          <p className="estado-vazio">A tabela aparece quando houver licenças.</p>
        ) : (
          <div className="tabela-envolvente">
            <table className="tabela tabela-resumo-licenciamento">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  {anos.length > 1 &&
                    anos.map((ano) => (
                      <th key={ano} scope="col" className="numerico">
                        {ano} <span className="cabecalho-nota">s/ IVA</span>
                      </th>
                    ))}
                  <th scope="col" className="numerico">
                    Valor estimado <span className="cabecalho-nota">sem IVA</span>
                  </th>
                  <th scope="col" className="numerico">
                    IVA <span className="cabecalho-nota">{formatarNumero(pedido.taxaIva)}%</span>
                  </th>
                  <th scope="col" className="numerico">
                    Valor estimado <span className="cabecalho-nota">com IVA</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lotesComMargem.map((l) => {
                  const v = comIva(l.total, pedido.taxaIva);
                  return (
                    <tr key={l.lote.id}>
                      <td>
                        {l.lote.numero}
                        <span className="meta"> {designacaoDoLote(l.lote, comMargem)}</span>
                      </td>
                      {anos.length > 1 &&
                        l.porAno.map((valor, i) => (
                          <td key={anos[i]} className="numerico">
                            {formatarMoeda(valor)}
                          </td>
                        ))}
                      <td className="numerico">{formatarMoeda(v.semIva)}</td>
                      <td className="numerico">{formatarMoeda(v.iva)}</td>
                      <td className="numerico">{formatarMoeda(v.comIva)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Valor estimado do contrato</th>
                  {anos.length > 1 &&
                    valorPorAno(comMargem).map((valor, i) => (
                      <td key={anos[i]} className="numerico">
                        {formatarMoeda(valor)}
                      </td>
                    ))}
                  {(() => {
                    const v = comIva(valorEstimado(comMargem), pedido.taxaIva);
                    return (
                      <>
                        <td className="numerico">
                          <strong>{formatarMoeda(v.semIva)}</strong>
                        </td>
                        <td className="numerico">{formatarMoeda(v.iva)}</td>
                        <td className="numerico">
                          <strong>{formatarMoeda(v.comIva)}</strong>
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {margem > 0 && (
          <p className="ajuda">
            Valores com a margem prudencial de {formatarNumero(margem)} % já aplicada ao preço unitário de cada licença
            — os mesmos que saem no Anexo Técnico.
          </p>
        )}
        <div className="linha-campos linha-campos-numeros">
          <label className="campo-numero-rotulado">
            <span className="rotulo">Taxa de IVA</span>
            <CampoNumero
              valor={pedido.taxaIva}
              min={0}
              step={1}
              sufixo="%"
              invalido={!(pedido.taxaIva >= 0)}
              // Os preços escrevem-se com IVA: mudar a taxa recalcula os sem IVA.
              onChange={(taxaIva) => onAlterar((atual) => comTaxaIva(atual, taxaIva))}
            />
          </label>
          <label className="campo-numero-rotulado">
            <span className="rotulo">Margem prudencial</span>
            <CampoNumero
              valor={pedido.margemPrudencial}
              min={0}
              step={1}
              sufixo="%"
              invalido={!(pedido.margemPrudencial >= 0)}
              aria-label="Margem prudencial"
              onChange={(margemPrudencial) => onAlterar((atual) => ({ ...atual, margemPrudencial }))}
            />
          </label>
        </div>
        <label className="campo campo-justificacao-margem">
          <span className="rotulo">
            {pedido.margemPrudencial > 0 ? "Fundamento da margem prudencial" : "Fundamento da margem prudencial a 0 %"}
          </span>
          <textarea
            rows={5}
            value={justificacaoMargemDoPedido(pedido)}
            aria-invalid={justificacaoMargemDoPedido(pedido).trim() === ""}
            onChange={(e) => onAlterar((atual) => ({ ...atual, justificacaoMargem: e.target.value }))}
          />
        </label>
        {pedido.justificacaoMargem !== null && (
          <button
            type="button"
            className="botao-discreto"
            onClick={() => onAlterar((atual) => ({ ...atual, justificacaoMargem: null }))}
          >
            Repor o texto por omissão
          </button>
        )}
        <p className="ajuda">
          A margem prudencial é uma percentagem acrescentada ao preço unitário de referência de cada licença para
          acautelar variações de preço até à adjudicação e durante a execução do contrato (por exemplo, a revisão das
          tabelas dos fabricantes ou titulares), de modo a que o valor estimado não fique abaixo do que o mercado praticará. O
          fundamento é obrigatório. Acima de 0 %, a margem passa a todos os valores do Anexo Técnico — licenças, lotes,
          anos, valor estimado, eAvalia e mapas de preços. O texto por omissão acompanha a margem enquanto não for
          alterado.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Júri técnico e assinatura</h3>
          <p className="painel-nota">
            Os três elementos que a manifestação de necessidades propõe para o júri. O coordenador assina a
            informação, e a unidade sai na assinatura por baixo da direção.
          </p>
        </header>
        <div className="grelha-juri">
          {(
            [
              ["diretor", "Diretor", "Nome do diretor"],
              ["coordenador", "Coordenador", "Nome do coordenador"],
              ["unidade", "Unidade (coordenação)", "ex.: Unidade de Planeamento, Arquitetura, Conformidade e Engenharia"],
              ["gestorProjeto", "Gestor do produto", "Nome do gestor do produto"],
            ] as const
          ).map(([campo, rotulo, exemplo]) => (
            <label key={campo} className="campo">
              <span className="rotulo">{rotulo}</span>
              <input
                type="text"
                className={`campo-juri-${campo}`}
                value={pedido.juri[campo]}
                placeholder={exemplo}
                aria-invalid={pedido.juri[campo].trim() === ""}
                onChange={(e) => onAlterar((atual) => ({ ...atual, juri: { ...atual.juri, [campo]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
        <p className="ajuda">Obrigatórios.</p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Anexo Técnico</h3>
        </header>
        <div className="linha-campos">
          <label className="campo-numero-informacao">
            <span className="rotulo">N.º da informação</span>
            <input
              type="text"
              value={pedido.numeroInformacao}
              placeholder="facultativo"
              onChange={(e) => onAlterar((atual) => ({ ...atual, numeroInformacao: e.target.value }))}
            />
          </label>
          <label className="campo-numero-informacao">
            <span className="rotulo">N.º de orçamento</span>
            <input
              type="text"
              className="campo-numero-orcamento"
              value={pedido.numeroOrcamento}
              placeholder="facultativo"
              onChange={(e) => onAlterar((atual) => ({ ...atual, numeroOrcamento: e.target.value }))}
            />
          </label>
        </div>
        <p className="ajuda">
          Facultativos. Preenchem, no Word, o «N.º» e o «N.º orçamento» da informação; o que ficar por preencher sai a
          vermelho. Só com os dois preenchidos o ZIP leva também a informação em PDF.
        </p>
        <ul className="verificacao-anexo">
          {[
            { nome: "Produto (Módulo 1)", lista: errosDoProduto },
            {
              nome: `Licenças (L1) · ${pedido.licencas.length === 1 ? "1 licença" : `${pedido.licencas.length} licenças`}`,
              lista: errosDasLicencas,
            },
            { nome: "Condições do contrato (L2)", lista: errosDasCondicoes },
            { nome: "Lotes, parâmetros e júri (este módulo)", lista: errosDoPedido },
          ].map((linha) => (
            <li key={linha.nome}>
              <span>{linha.nome}</span>
              {linha.lista.length === 0 ? (
                <span className="estado-verificacao">completo</span>
              ) : (
                <span
                  className="estado-verificacao estado-verificacao-falta"
                  title={linha.lista.map((e) => e.mensagem).join("\n")}
                >
                  {linha.lista.length === 1 ? "1 questão por resolver" : `${linha.lista.length} questões por resolver`}
                </span>
              )}
            </li>
          ))}
          <li>
            <span>N.º da informação e n.º de orçamento</span>
            <span className="estado-verificacao">
              {comPdf ? "preenchidos · sai também o PDF" : "facultativos · sem os dois não sai o PDF"}
            </span>
          </li>
        </ul>
        <p className="ajuda">
          <strong>O ZIP vai conter:</strong> a manifestação de necessidades em Word{comPdf ? " e em PDF" : ""}, o pedido
          de parecer prévio eAvalia («Alinhamento Tecnológico», com todas as medidas «Não aplicável», e «Custos -
          Licenciamento»),{" "}
          {lotes.length === 1 ? "1 mapa" : `${lotes.length} mapas`} de quantidades e preços em Excel (um por lote) e o
          JSON do pedido.
        </p>
        <div className="acoes">
          <button
            type="button"
            className="botao-principal"
            onClick={() => void descarregar()}
            disabled={aGerar || erros.length > 0}
          >
            {aGerar ? "A gerar…" : "Descarregar Anexo Técnico (ZIP)"}
          </button>
        </div>
        {erros.length > 0 && (
          <p className="aviso aviso-atencao" role="status">
            Para descarregar, resolva primeiro: {erros.map((e) => e.mensagem).join(" · ")}
          </p>
        )}
      </section>
    </div>
  );
}
