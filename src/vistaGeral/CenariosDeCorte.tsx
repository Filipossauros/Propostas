import { useState } from "react";
import { formatarMoeda, formatarNumero } from "../core/lotes";
import {
  alteracoesSemEfeito,
  aplicarCenario,
  comInternoMovido,
  comHorasNoAno,
  comPassoDeHoras,
  comPessoas,
  comQuantidade,
  comRetirada,
  horasDaEntrada,
  horasNoCenario,
  linhaAlterada,
  PASSO_HORAS,
  projetoTodoCortado,
  quantidadeNoCenario,
  retiradaNoCenario,
  comValorHora,
  comProjetoCortado,
  comProjetoReposto,
  duplicarCenario,
  nomeLivre,
  novoCenario,
  pessoasNoCenario,
  valorHoraNoCenario,
  projetoDoInterno,
  semAlteracoesSemEfeito,
  type Cenario,
} from "../core/cenarios";
import {
  anosDoOrcamento,
  ehLinhaDeLicenca,
  lotesDoProjeto,
  pessoasDaUnidade,
  pessoasDoProjeto,
  totaisPorAnoDaUnidade,
  totaisPorAnoDaUnidadeSemIva,
  valorDaEntradaNoAno,
  valorDoProjetoNoAno,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import { BotaoColapsar, EtiquetaDoProjeto, resumoDoProjeto } from "./projetoColapsavel";
import { ResumoGeral } from "./ResumoGeral";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  orcamento: OrcamentoUnidade;
  /** Os botões de colapsar e expandir todos os projetos. */
  barraColapso: React.ReactNode;
  colapsados: ReadonlySet<string>;
  onAlternarColapso: (projetoId: string) => void;
  onAlterar: (alterar: (atual: OrcamentoUnidade) => OrcamentoUnidade) => void;
  onMoverProjeto: (arrastadoId: string, alvoId: string) => void;
  onDeslocarProjeto: (projetoId: string, passos: number) => void;
}

/**
 * Cenários de corte: o orçamento com menos pessoas, sem tocar no orçamento.
 *
 * Corta-se linha a linha, pessoa a pessoa, e vê-se logo o efeito no total de
 * cada ano. Os internos não se cortam — a unidade não os contrata —, mas podem
 * passar de um projeto para outro, o que muda o peso de cada projeto.
 */
export function CenariosDeCorte({
  orcamento,
  barraColapso,
  colapsados,
  onAlternarColapso,
  onAlterar,
  onMoverProjeto,
  onDeslocarProjeto,
}: Props) {
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const cenario = orcamento.cenarios.find((c) => c.id === ativoId) ?? orcamento.cenarios[0] ?? null;

  function alterarCenario(alterar: (c: Cenario) => Cenario) {
    if (cenario === null) return;
    onAlterar((atual) => ({
      ...atual,
      cenarios: atual.cenarios.map((c) => (c.id === cenario.id ? alterar(c) : c)),
    }));
  }

  function criar() {
    const novo = novoCenario(nomeLivre(orcamento.cenarios));
    onAlterar((atual) => ({ ...atual, cenarios: [...atual.cenarios, novo] }));
    setAtivoId(novo.id);
  }

  function duplicar() {
    if (cenario === null) return;
    const copia = duplicarCenario(cenario, nomeLivre(orcamento.cenarios, `${cenario.nome} (cópia)`));
    onAlterar((atual) => ({ ...atual, cenarios: [...atual.cenarios, copia] }));
    setAtivoId(copia.id);
  }

  function apagar() {
    if (cenario === null || !confirm(`Apagar o cenário «${cenario.nome}»? O orçamento não é alterado.`)) return;
    onAlterar((atual) => ({ ...atual, cenarios: atual.cenarios.filter((c) => c.id !== cenario.id) }));
    setAtivoId(null);
  }

  if (orcamento.projetos.length === 0) {
    return (
      <section className="painel">
        <p className="estado-vazio">
          Ainda não há pedidos no orçamento. Marque-os na vista «Orçamento» (ou na biblioteca) para poder criar
          cenários.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Cenário</h3>
          <p className="painel-nota">
            Cada cenário guarda só os cortes; os valores vêm sempre do orçamento, que nunca é alterado aqui.
          </p>
        </header>

        <div className="barra-cenarios">
          {orcamento.cenarios.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === cenario?.id ? "chip-cenario chip-cenario-ativo" : "chip-cenario"}
              aria-pressed={c.id === cenario?.id}
              onClick={() => setAtivoId(c.id)}
            >
              {c.nome}
            </button>
          ))}
          <button type="button" className="botao-secundario" onClick={criar}>
            + Novo cenário
          </button>
          {cenario !== null && (
            <>
              <button type="button" className="botao-discreto" onClick={duplicar}>
                Duplicar
              </button>
              <button type="button" className="botao-discreto botao-perigo" onClick={apagar}>
                Apagar
              </button>
            </>
          )}
        </div>

        {cenario === null ? (
          <p className="estado-vazio">
            Ainda não há cenários. Crie o primeiro para começar a cortar pessoas sem mexer no orçamento.
          </p>
        ) : (
          <>
            <label className="campo-unidade">
              <span>Nome do cenário</span>
              <input
                type="text"
                className="campo-nome-cenario"
                value={cenario.nome}
                onChange={(e) => alterarCenario((c) => ({ ...c, nome: e.target.value }))}
              />
            </label>
            <Comparacao orcamento={orcamento} cenario={cenario} />
          </>
        )}
      </section>

      {cenario !== null && (
        <>
          <AvisoSemEfeito
            orcamento={orcamento}
            cenario={cenario}
            onLimpar={() => alterarCenario((c) => semAlteracoesSemEfeito(orcamento, c))}
          />

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Resumo geral no cenário</h3>
              <p className="painel-nota">As pessoas de cada projeto e o seu peso na unidade, já com os cortes.</p>
            </header>
            <ResumoGeral
              orcamento={aplicarCenario(orcamento, cenario)}
              onMoverProjeto={onMoverProjeto}
              onDeslocarProjeto={onDeslocarProjeto}
            />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Cortes, linha a linha</h3>
              <p className="painel-nota">
                Num perfil, use − e + para retirar ou repor pessoas, ajuste as horas de cada ano (por elemento) em passos
                de {PASSO_HORAS} h — com −{PASSO_HORAS} / +{PASSO_HORAS}, ou escrevendo-as — e altere o valor hora (sem IVA): o valor
                de cada ano acompanha. Numa licença de preço unitário corte a quantidade; qualquer licença pode ser
                retirada. Os internos não se cortam, mas podem passar para outro projeto.
              </p>
            </header>
            {barraColapso}
            <TabelaDoCenario
              orcamento={orcamento}
              cenario={cenario}
              colapsados={colapsados}
              onAlternarColapso={onAlternarColapso}
              onAlterarCenario={alterarCenario}
            />
          </section>
        </>
      )}
    </>
  );
}

function Diferenca({ antes, depois, moeda }: { antes: number; depois: number; moeda: boolean }) {
  const dif = depois - antes;
  if (Math.abs(dif) < 0.005) return <span className="diferenca-nula">sem alteração</span>;
  const pct = antes === 0 ? null : (dif / antes) * 100;
  const valor = moeda ? formatarMoeda(dif) : formatarNumero(dif);
  return (
    <span className="diferenca">
      {dif > 0 && !valor.startsWith("+") ? "+" : ""}
      {valor}
      {pct !== null && ` (${formatarNumero(Math.round(pct * 10) / 10)} %)`}
    </span>
  );
}

/** O cenário contra o orçamento: pessoas e valor de cada ano, com a diferença. */
function Comparacao({ orcamento, cenario }: { orcamento: OrcamentoUnidade; cenario: Cenario }) {
  const noCenario = aplicarCenario(orcamento, cenario);
  const anos = anosDoOrcamento(orcamento);
  const antes = totaisPorAnoDaUnidade(orcamento);
  const depois = totaisPorAnoDaUnidade(noCenario);
  const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const semIvaAntes = soma(totaisPorAnoDaUnidadeSemIva(orcamento));
  const semIvaDepois = soma(totaisPorAnoDaUnidadeSemIva(noCenario));
  const pessoasAntes = pessoasDaUnidade(orcamento);
  const pessoasDepois = pessoasDaUnidade(noCenario);

  return (
    <dl className="tira-totais tira-comparacao">
      <div>
        <dt>Pessoas</dt>
        <dd>
          {pessoasAntes} → {pessoasDepois}
          <Diferenca antes={pessoasAntes} depois={pessoasDepois} moeda={false} />
        </dd>
      </div>
      {anos.map((ano, i) => (
        <div key={ano}>
          <dt>{ano} c/ IVA</dt>
          <dd>
            {formatarMoeda(depois[i])}
            <span className="valor-anterior">{formatarMoeda(antes[i])}</span>
            <Diferenca antes={antes[i]} depois={depois[i]} moeda />
          </dd>
        </div>
      ))}
      <div>
        <dt>Total s/ IVA</dt>
        <dd>
          {formatarMoeda(semIvaDepois)}
          <span className="valor-anterior">{formatarMoeda(semIvaAntes)}</span>
          <Diferenca antes={semIvaAntes} depois={semIvaDepois} moeda />
        </dd>
      </div>
    </dl>
  );
}

function AvisoSemEfeito({
  orcamento,
  cenario,
  onLimpar,
}: {
  orcamento: OrcamentoUnidade;
  cenario: Cenario;
  onLimpar: () => void;
}) {
  const n = alteracoesSemEfeito(orcamento, cenario);
  if (n === 0) return null;
  return (
    <p className="aviso aviso-atencao" role="status">
      {n === 1 ? "Uma alteração deste cenário já não se aplica" : `${n} alterações deste cenário já não se aplicam`} — a
      linha, o interno ou o projeto de destino deixou de existir no orçamento.{" "}
      <button type="button" className="botao-discreto" onClick={onLimpar}>
        Retirar do cenário
      </button>
    </p>
  );
}

interface PropsTabela {
  orcamento: OrcamentoUnidade;
  cenario: Cenario;
  colapsados: ReadonlySet<string>;
  onAlternarColapso: (projetoId: string) => void;
  onAlterarCenario: (alterar: (c: Cenario) => Cenario) => void;
}

function TabelaDoCenario({ orcamento, cenario, colapsados, onAlternarColapso, onAlterarCenario }: PropsTabela) {
  const anos = anosDoOrcamento(orcamento);
  const noCenario = aplicarCenario(orcamento, cenario);
  const nomes = orcamento.projetos.map((p) => p.nome);
  const origemDe = new Map(orcamento.projetos.flatMap((p) => p.internos.map((i) => [i.id, p.nome] as const)));

  return (
    <div className="tabela-envolvente">
      <table className="tabela tabela-unidade tabela-cenario">
        <thead>
          <tr>
            <th scope="col">Projeto</th>
            <th scope="col" className="numerico">
              Lote
            </th>
            <th scope="col">Perfil</th>
            <th scope="col" className="numerico">
              No orçamento
            </th>
            <th scope="col" className="numerico">
              No cenário
            </th>
            <th scope="col" className="numerico">
              Valor hora <span className="cabecalho-nota">s/ IVA</span>
            </th>
            {anos.map((ano) => (
              <th key={ano} scope="col" className="numerico">
                Total € c/ IVA <span className="cabecalho-nota">{ano}</span>
              </th>
            ))}
          </tr>
        </thead>

        {orcamento.projetos.map((projeto, p) => {
          const derivado = noCenario.projetos[p];
          const cortadas = projeto.entradas.reduce(
            (soma, e) => soma + e.pessoas - pessoasNoCenario(cenario, projeto, e),
            0,
          );
          const retiradas = projeto.entradas.filter((e) => retiradaNoCenario(cenario, projeto, e)).length;
          const alteradas = projeto.entradas.filter((e) => linhaAlterada(cenario, projeto, e)).length;
          const partesDoResumo: string[] = [];
          if (cortadas > 0) partesDoResumo.push(`−${cortadas} ${cortadas === 1 ? "pessoa" : "pessoas"}`);
          if (retiradas > 0) partesDoResumo.push(`${retiradas} ${retiradas === 1 ? "licença retirada" : "licenças retiradas"}`);
          if (partesDoResumo.length === 0 && alteradas > 0)
            partesDoResumo.push(`${alteradas} ${alteradas === 1 ? "linha alterada" : "linhas alteradas"}`);
          const resumoDosCortes = partesDoResumo.join(" · ") || "sem cortes";
          const colapsado = colapsados.has(projeto.id);
          const nLinhas = colapsado ? 1 : Math.max(1, projeto.entradas.length + derivado.internos.length);

          const celulaDoProjeto = (
            <th scope="rowgroup" rowSpan={nLinhas} className="celula-projeto">
              <div className="projeto-nome">
                <BotaoColapsar projeto={projeto} colapsado={colapsado} onAlternar={onAlternarColapso} />
                <strong>{projeto.nome}</strong>
              </div>
              <p className="meta">
                <EtiquetaDoProjeto projeto={projeto} />
              </p>
              <p className="meta">{resumoDosCortes}</p>
              <div className="acoes-linha">
                <button
                  type="button"
                  className="botao-discreto"
                  disabled={projetoTodoCortado(cenario, projeto)}
                  onClick={() => onAlterarCenario((c) => comProjetoCortado(c, projeto))}
                >
                  Cortar projeto
                </button>
                <button
                  type="button"
                  className="botao-discreto"
                  disabled={cortadas === 0 && retiradas === 0}
                  onClick={() => onAlterarCenario((c) => comProjetoReposto(c, projeto))}
                >
                  Repor
                </button>
              </div>
            </th>
          );

          if (colapsado) {
            const antes = pessoasDoProjeto(projeto);
            const depois = pessoasDoProjeto(derivado);
            return (
              <tbody key={projeto.id} className="grupo-projeto grupo-projeto-colapsado">
                <tr>
                  {celulaDoProjeto}
                  <td className="numerico">{lotesDoProjeto(projeto).length}</td>
                  <td>
                    <span className="meta">{resumoDoProjeto(projeto)}</span>
                  </td>
                  <td className="numerico">{antes}</td>
                  <td className="numerico">{depois}</td>
                  <td className="numerico">
                    <span className="meta">—</span>
                  </td>
                  {anos.map((ano) => {
                    const valor = valorDoProjetoNoAno(derivado, ano);
                    const anterior = valorDoProjetoNoAno(projeto, ano);
                    return (
                      <td key={ano} className="numerico">
                        {formatarMoeda(valor)}
                        {Math.abs(valor - anterior) >= 0.005 && (
                          <span className="valor-anterior">{formatarMoeda(anterior)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            );
          }

          const linhas: Array<{ chave: string; classe?: string; celulas: React.ReactNode }> = [
            ...projeto.entradas.map((entrada, i) => {
              if (ehLinhaDeLicenca(entrada)) {
                // Numa licença corta-se a quantidade (só nas de preço unitário) ou retira-se a linha.
                const retirada = retiradaNoCenario(cenario, projeto, entrada);
                const quantidade = quantidadeNoCenario(cenario, projeto, entrada);
                const alterada = linhaAlterada(cenario, projeto, entrada);
                return {
                  chave: entrada.id,
                  classe: retirada ? "linha-cortada" : undefined,
                  celulas: (
                    <>
                      <td className="numerico">{entrada.lote}</td>
                      <td className="celula-perfil">
                        {entrada.perfil} <span className="etiqueta-licenca">licença</span>
                        {retirada && <span className="etiqueta-opcional"> retirada</span>}
                        {entrada.quantidadePorExtenso !== undefined && (
                          <span className="meta meta-bloco">{entrada.quantidadePorExtenso}</span>
                        )}
                        <label className="campo-opcao campo-retirar">
                          <input
                            type="checkbox"
                            checked={retirada}
                            onChange={(e) => onAlterarCenario((c) => comRetirada(c, projeto, entrada, e.target.checked))}
                          />
                          <span>Retirar do cenário</span>
                        </label>
                      </td>
                      <td className="numerico">
                        {entrada.quantidadeAjustavel === true ? (
                          formatarNumero(entrada.quantidade ?? 0)
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                      <td className="numerico celula-quantidade">
                        {entrada.quantidadeAjustavel === true && !retirada ? (
                          <CampoNumero
                            valor={quantidade}
                            min={0}
                            step={1}
                            aria-label={`Quantidade de ${entrada.perfil} (${projeto.nome}) no cenário`}
                            onChange={(q) => onAlterarCenario((c) => comQuantidade(c, projeto, entrada, q))}
                          />
                        ) : (
                          <span className="meta">{retirada ? "0" : "—"}</span>
                        )}
                        {entrada.quantidadeAjustavel === true && entrada.unidadeQuantidade !== undefined && (
                          <span className="meta meta-bloco">{entrada.unidadeQuantidade}</span>
                        )}
                      </td>
                      <td className="numerico">
                        <span className="meta">—</span>
                      </td>
                      {anos.map((ano) => {
                        const valor = valorDaEntradaNoAno(derivado, derivado.entradas[i], ano);
                        const antes = valorDaEntradaNoAno(projeto, entrada, ano);
                        return (
                          <td key={ano} className="numerico">
                            {valor === null ? <span className="meta">—</span> : formatarMoeda(valor)}
                            {alterada && antes !== null && <span className="valor-anterior">{formatarMoeda(antes)}</span>}
                          </td>
                        );
                      })}
                    </>
                  ),
                };
              }
              const ficam = pessoasNoCenario(cenario, projeto, entrada);
              const valorHora = valorHoraNoCenario(cenario, projeto, entrada);
              const valorAlterado = Math.abs(valorHora - entrada.valorHoraSemIva) >= 0.005;
              const cortada = linhaAlterada(cenario, projeto, entrada);
              const horasOrcamento = horasDaEntrada(entrada);
              const horas = horasNoCenario(cenario, projeto, entrada);
              return {
                chave: entrada.id,
                classe: ficam === 0 ? "linha-cortada" : undefined,
                celulas: (
                  <>
                    <td className="numerico">{entrada.lote}</td>
                    <td className="celula-perfil">
                      {entrada.perfil}
                      {ficam === 0 && <span className="etiqueta-opcional"> cortado</span>}
                    </td>
                    <td className="numerico">{entrada.pessoas}</td>
                    <td className="numerico">
                      <span className="passo-pessoas">
                        <button
                          type="button"
                          aria-label={`Retirar uma pessoa de ${entrada.perfil} (${projeto.nome})`}
                          disabled={ficam === 0}
                          onClick={() => onAlterarCenario((c) => comPessoas(c, projeto, entrada, ficam - 1))}
                        >
                          −
                        </button>
                        <span>{ficam}</span>
                        <button
                          type="button"
                          aria-label={`Repor uma pessoa em ${entrada.perfil} (${projeto.nome})`}
                          disabled={ficam >= entrada.pessoas}
                          onClick={() => onAlterarCenario((c) => comPessoas(c, projeto, entrada, ficam + 1))}
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="numerico celula-valor-hora">
                      <CampoNumero
                        valor={valorHora}
                        min={0}
                        step={0.5}
                        sufixo="€"
                        aria-label={`Valor hora sem IVA de ${entrada.perfil} (${projeto.nome}) no cenário`}
                        onChange={(v) => onAlterarCenario((c) => comValorHora(c, projeto, entrada, v))}
                      />
                      {valorAlterado && (
                        <span className="valor-anterior">{formatarMoeda(entrada.valorHoraSemIva)}</span>
                      )}
                    </td>
                    {anos.map((ano) => {
                      const valor = valorDaEntradaNoAno(derivado, derivado.entradas[i], ano);
                      const antes = valorDaEntradaNoAno(projeto, entrada, ano);
                      const indice = ano - projeto.anoInicio;
                      const temHoras = valor !== null && (horasOrcamento[indice] ?? 0) > 0;
                      return (
                        <td key={ano} className="numerico">
                          {valor === null ? <span className="meta">—</span> : formatarMoeda(valor)}
                          {cortada && antes !== null && <span className="valor-anterior">{formatarMoeda(antes)}</span>}
                          {temHoras && ficam > 0 && (
                            <CampoHoras
                              horas={horas[indice]}
                              maximo={horasOrcamento[indice]}
                              rotulo={`Horas de ${ano} por elemento de ${entrada.perfil} (${projeto.nome})`}
                              onPasso={(sentido) =>
                                onAlterarCenario((c) => comPassoDeHoras(c, projeto, entrada, indice, sentido))
                              }
                              onEscrever={(h) => onAlterarCenario((c) => comHorasNoAno(c, projeto, entrada, indice, h))}
                            />
                          )}
                        </td>
                      );
                    })}
                  </>
                ),
              };
            }),
            ...derivado.internos.map((interno) => {
              const origem = origemDe.get(interno.id) ?? projeto.nome;
              return {
                chave: interno.id,
                classe: "linha-interno-registado",
                celulas: (
                  <>
                    <td className="numerico">
                      <span className="meta">—</span>
                    </td>
                    <td className="celula-perfil">
                      {interno.nome} <span className="etiqueta-interno">interno</span>
                      {/* Os internos não se cortam: só mudam de projeto. */}
                      <label className="linha-mover-interno">
                        <span>Fica em</span>
                        <select
                          className="seletor-projeto-interno"
                          aria-label={`Projeto de ${interno.nome} no cenário`}
                          value={projetoDoInterno(cenario, interno.id, origem)}
                          onChange={(e) =>
                            onAlterarCenario((c) => comInternoMovido(c, interno.id, origem, e.target.value))
                          }
                        >
                          {nomes.map((nome) => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      {origem !== projeto.nome && <span className="meta">No orçamento: {origem}</span>}
                    </td>
                    <td className="numerico">{origem === projeto.nome ? 1 : <span className="meta">—</span>}</td>
                    <td className="numerico">1</td>
                    <td className="numerico">
                      <span className="meta">—</span>
                    </td>
                    {anos.map((ano) => (
                      <td key={ano} className="numerico">
                        <span className="meta">—</span>
                      </td>
                    ))}
                  </>
                ),
              };
            }),
          ];

          return (
            <tbody key={projeto.id} className="grupo-projeto">
              {linhas.length === 0 ? (
                <tr>
                  {celulaDoProjeto}
                  <td colSpan={5 + anos.length}>
                    <span className="meta">Sem perfis nem elementos internos neste cenário.</span>
                  </td>
                </tr>
              ) : (
                linhas.map((linha, i) => (
                  <tr key={linha.chave} className={linha.classe}>
                    {i === 0 && celulaDoProjeto}
                    {linha.celulas}
                  </tr>
                ))
              )}
            </tbody>
          );
        })}

        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total da unidade
            </th>
            <td className="numerico">
              <strong>{pessoasDaUnidade(orcamento)}</strong>
            </td>
            <td className="numerico">
              <strong>{pessoasDaUnidade(noCenario)}</strong>
            </td>
            <td />
            {totaisPorAnoDaUnidade(noCenario).map((total, i) => (
              <td key={anos[i]} className="numerico">
                <strong>{formatarMoeda(total)}</strong>
                <span className="total-sem-iva">{formatarMoeda(totaisPorAnoDaUnidadeSemIva(noCenario)[i])} s/ IVA</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * As horas de um ano, por elemento: −8 / +8, ou escritas (arredondadas a
 * múltiplos de 8 ao sair do campo), entre zero e as do orçamento.
 */
function CampoHoras({
  horas,
  maximo,
  rotulo,
  onPasso,
  onEscrever,
}: {
  horas: number;
  maximo: number;
  rotulo: string;
  onPasso: (sentido: -1 | 1) => void;
  onEscrever: (horas: number) => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const confirmar = () => {
    if (texto === null) return;
    const n = Number(texto.replace(",", "."));
    if (texto.trim() !== "" && Number.isFinite(n)) onEscrever(n);
    setTexto(null);
  };
  return (
    <span className="passo-horas" role="group" aria-label={rotulo}>
      <button type="button" aria-label={`Menos ${PASSO_HORAS} h — ${rotulo}`} disabled={horas <= 0} onClick={() => onPasso(-1)}>
        −{PASSO_HORAS}
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={texto ?? formatarNumero(horas)}
        aria-label={rotulo}
        className={horas < maximo ? "horas-cortadas" : undefined}
        onFocus={() => setTexto(String(horas))}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setTexto(null);
        }}
      />
      <button
        type="button"
        aria-label={`Mais ${PASSO_HORAS} h — ${rotulo}`}
        disabled={horas >= maximo}
        onClick={() => onPasso(1)}
      >
        +{PASSO_HORAS}
      </button>
      <span className="passo-horas-unidade">h</span>
    </span>
  );
}
