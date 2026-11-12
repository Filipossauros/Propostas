import type { LotesJSON } from "../core/types";
import {
  FUNDAMENTOS_VALOR_HORA,
  diferencaMediaBase,
  linhaAdjudicadoVazia,
  linhaRateMediaVazia,
  linhasRatesSpms,
  usaAdjudicados,
  usaRateMedia,
  type FundamentoValorHora,
  type LinhaAdjudicado,
  type LinhaRateMedia,
  type ReferenciaValorHora,
} from "../core/referenciaValorHora";
import { ehJustificacaoPorOmissao, justificacaoPorOmissao } from "../core/margem";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  config: LotesJSON;
  onAlterarConfig: (atualizar: (atual: LotesJSON) => LotesJSON) => void;
}

/**
 * A tabela de referência do valor hora: a base, genérica, dos valores hora dos
 * lotes — sem ligação perfil a perfil. Sai no Anexo I da manifestação.
 */
export function ReferenciaValorHoraEditor({ config, onAlterarConfig }: Props) {
  const ref = config.referenciaValorHora;
  const alterar = (alteracao: Partial<ReferenciaValorHora>) =>
    onAlterarConfig((atual) => {
      const nova = { ...atual.referenciaValorHora, ...alteracao };
      // O fundamento da margem por omissão acompanha a base escolhida; um escrito à mão fica.
      const justificacaoMargem = ehJustificacaoPorOmissao(atual.justificacaoMargem)
        ? justificacaoPorOmissao(atual.margemPrudencial, nova.fundamento)
        : atual.justificacaoMargem;
      return { ...atual, referenciaValorHora: nova, justificacaoMargem };
    });
  const alterarMedia = (id: string, alteracao: Partial<LinhaRateMedia>) =>
    alterar({ media: ref.media.map((l) => (l.id === id ? { ...l, ...alteracao } : l)) });
  const alterarAdjudicado = (id: string, alteracao: Partial<LinhaAdjudicado>) =>
    alterar({ adjudicados: ref.adjudicados.map((l) => (l.id === id ? { ...l, ...alteracao } : l)) });

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>Valor hora de referência</h3>
        <p className="painel-nota">
          A base, genérica, dos valores hora dos lotes: não se liga perfil a perfil, e o preço/hora de cada perfil
          continua a escrever-se no lote. Sai no Anexo I da manifestação de necessidades (ponto 3). Valores sem IVA.
        </p>
      </header>

      <span className="rotulo">Fundamento dos valores hora</span>
      <div className="opcoes-natureza opcoes-tres" role="radiogroup" aria-label="Fundamento dos valores hora">
        {(Object.entries(FUNDAMENTOS_VALOR_HORA) as Array<[FundamentoValorHora, { titulo: string; texto: string }]>).map(
          ([valor, f]) => (
            <label
              key={valor}
              className={ref.fundamento === valor ? "opcao-natureza opcao-natureza-ativa" : "opcao-natureza"}
            >
              <input
                type="radio"
                name="fundamento-valor-hora"
                checked={ref.fundamento === valor}
                onChange={() => alterar({ fundamento: valor })}
              />
              <span>
                <strong>{f.titulo}</strong>
                <span className="meta">{f.texto}</span>
              </span>
            </label>
          ),
        )}
      </div>

      {usaRateMedia(ref.fundamento) && (
        <>
          <h4 className="titulo-tabela-referencia">Rate média das propostas</h4>
          {ref.media.length === 0 ? (
            <p className="estado-vazio">Sem linhas. Acrescente a primeira, ou reponha a tabela da SPMS.</p>
          ) : (
            <div className="tabela-envolvente">
              <table className="tabela tabela-referencia">
                <thead>
                  <tr>
                    <th scope="col">Perfil</th>
                    <th scope="col">
                      Procedimento(s) <span className="cabecalho-nota">um por linha</span>
                    </th>
                    <th scope="col" className="numerico" title="N.º de propostas admitidas">
                      Propostas <span className="cabecalho-nota">admitidas</span>
                    </th>
                    <th scope="col" className="numerico" title="Rate do valor base do procedimento">
                      Valor base <span className="cabecalho-nota">€/h</span>
                    </th>
                    <th scope="col" className="numerico" title="Rate mais alta válida (proposta)">
                      Mais alta <span className="cabecalho-nota">€/h</span>
                    </th>
                    <th scope="col" className="numerico" title="Rate média das propostas">
                      Média <span className="cabecalho-nota">€/h</span>
                    </th>
                    <th scope="col" className="numerico" title="Diferença da rate média para o valor base">
                      Diferença
                    </th>
                    <th scope="col">
                      <span className="rotulo-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ref.media.map((l, i) => {
                    const dif = diferencaMediaBase(l);
                    return (
                      <tr key={l.id}>
                        <td>
                          <textarea
                            rows={l.perfil.length > 28 ? 2 : 1}
                            value={l.perfil}
                            aria-label={`Perfil da linha ${i + 1} das rates médias`}
                            aria-invalid={l.perfil.trim() === ""}
                            onChange={(e) => alterarMedia(l.id, { perfil: e.target.value })}
                          />
                        </td>
                        <td>
                          <textarea
                            rows={Math.max(1, l.procedimentos.split("\n").length)}
                            value={l.procedimentos}
                            aria-label={`Procedimentos da linha ${i + 1} das rates médias`}
                            aria-invalid={l.procedimentos.trim() === ""}
                            onChange={(e) => alterarMedia(l.id, { procedimentos: e.target.value })}
                          />
                        </td>
                        <td className="numerico">
                          <CampoNumero
                            valor={l.propostas}
                            min={1}
                            step={1}
                            aria-label={`N.º de propostas da linha ${i + 1}`}
                            invalido={!(Number.isInteger(l.propostas) && l.propostas >= 1)}
                            onChange={(propostas) => alterarMedia(l.id, { propostas })}
                          />
                        </td>
                        {(
                          [
                            ["base", "Rate do valor base"],
                            ["maisAlta", "Rate mais alta"],
                            ["media", "Rate média"],
                          ] as const
                        ).map(([campo, rotulo]) => (
                          <td key={campo} className="numerico">
                            <CampoNumero
                              valor={l[campo]}
                              min={0}
                              step={0.01}
                              aria-label={`${rotulo} da linha ${i + 1}`}
                              invalido={!(l[campo] > 0)}
                              onChange={(v) => alterarMedia(l.id, { [campo]: v })}
                            />
                          </td>
                        ))}
                        <td className="numerico">
                          <span className="valor-calculado">{dif === null ? "—" : `${dif} %`}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="botao-icone botao-perigo"
                            title="Remover a linha"
                            aria-label={`Remover a linha ${i + 1} das rates médias`}
                            onClick={() => alterar({ media: ref.media.filter((x) => x.id !== l.id) })}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="acoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => alterar({ media: [...ref.media, linhaRateMediaVazia()] })}
            >
              + Acrescentar linha
            </button>
            <button
              type="button"
              className="botao-discreto"
              onClick={() => {
                if (confirm("Repor as rates médias com o quadro de referência da SPMS? As linhas atuais são substituídas."))
                  alterar({ media: linhasRatesSpms() });
              }}
            >
              Repor a tabela da SPMS
            </button>
          </div>
        </>
      )}

      {usaAdjudicados(ref.fundamento) && (
        <>
          <h4 className="titulo-tabela-referencia">Valores anteriormente adjudicados</h4>
          {ref.adjudicados.length === 0 ? (
            <p className="estado-vazio">Sem linhas. Acrescente a primeira.</p>
          ) : (
            <div className="tabela-envolvente">
              <table className="tabela tabela-referencia">
                <thead>
                  <tr>
                    <th scope="col">Perfil</th>
                    <th scope="col">Procedimento ou contrato</th>
                    <th scope="col" className="numerico">
                      Ano da adjudicação
                    </th>
                    <th scope="col" className="numerico">
                      Valor hora adjudicado <span className="cabecalho-nota">€/h</span>
                    </th>
                    <th scope="col">
                      <span className="rotulo-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ref.adjudicados.map((l, i) => (
                    <tr key={l.id}>
                      <td>
                        <input
                          type="text"
                          value={l.perfil}
                          placeholder="ex.: Programador Sénior — Java"
                          aria-label={`Perfil da linha ${i + 1} dos valores adjudicados`}
                          aria-invalid={l.perfil.trim() === ""}
                          onChange={(e) => alterarAdjudicado(l.id, { perfil: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={l.procedimento}
                          placeholder="ex.: CP 2024/0112 (contrato n.º 87/2024)"
                          aria-label={`Procedimento ou contrato da linha ${i + 1}`}
                          aria-invalid={l.procedimento.trim() === ""}
                          onChange={(e) => alterarAdjudicado(l.id, { procedimento: e.target.value })}
                        />
                      </td>
                      <td className="numerico">
                        <CampoNumero
                          valor={l.ano}
                          min={2000}
                          step={1}
                          aria-label={`Ano da adjudicação da linha ${i + 1}`}
                          invalido={!(Number.isInteger(l.ano) && l.ano >= 2000)}
                          onChange={(ano) => alterarAdjudicado(l.id, { ano })}
                        />
                      </td>
                      <td className="numerico">
                        <CampoNumero
                          valor={l.valorHora}
                          min={0}
                          step={0.01}
                          aria-label={`Valor hora adjudicado da linha ${i + 1}`}
                          invalido={!(l.valorHora > 0)}
                          onChange={(valorHora) => alterarAdjudicado(l.id, { valorHora })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="botao-icone botao-perigo"
                          title="Remover a linha"
                          aria-label={`Remover a linha ${i + 1} dos valores adjudicados`}
                          onClick={() => alterar({ adjudicados: ref.adjudicados.filter((x) => x.id !== l.id) })}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="acoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => alterar({ adjudicados: [...ref.adjudicados, linhaAdjudicadoVazia()] })}
            >
              + Acrescentar linha
            </button>
          </div>
        </>
      )}
      <p className="ajuda">
        A diferença da rate média para o valor base calcula-se sozinha. As linhas não têm de coincidir com os perfis
        dos lotes: a tabela fundamenta os valores hora no seu conjunto.
      </p>
    </section>
  );
}
