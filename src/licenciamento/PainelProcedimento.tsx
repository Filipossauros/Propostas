import { useState } from "react";
import type {
  ContextoAjusteDireto,
  EntidadeConvidada,
  FundamentoAjusteDireto,
  PedidoLicenciamento,
  ProcedimentoProposto,
  TipoProcedimento,
} from "../core/licenciamento";
import {
  CONTEXTOS_AJUSTE_DIRETO,
  FUNDAMENTOS_AJUSTE_DIRETO,
  FUNDAMENTOS_MATERIAIS,
  PROCEDIMENTOS,
  convidados,
  ehAjusteDiretoMaterial,
  entidadeVazia,
  nifValido,
  pedeMotivoDoConvite,
} from "../core/licenciamento";
import { moverItem } from "../ui/useReordenavel";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
}

type Descricao = "requisitos" | "produto" | "exclusivo";

const DESCRICOES: Array<{ valor: Descricao; titulo: string; texto: string }> = [
  {
    valor: "requisitos",
    titulo: "Por requisitos, sem marca",
    texto:
      "Descrevem-se as funcionalidades mínimas; qualquer produto que as cumpra pode ser proposto. No eAvalia: " +
      "«Submissão à concorrência».",
  },
  {
    valor: "produto",
    titulo: "Produto identificado, com vários fornecedores",
    texto:
      "Indica-se a licença, o fabricante e a versão; concorrem distribuidores ou revendedores. Justifica-se a " +
      "referência à marca (art.º 49.º, n.º 8, do CCP).",
  },
  {
    valor: "exclusivo",
    titulo: "Só uma entidade a pode fornecer",
    texto:
      "Motivos técnicos ou direitos exclusivos: não há alternativa razoável nem outro fornecedor. O procedimento é o " +
      "ajuste direto por critério material.",
  },
];

const ORDEM_PROCEDIMENTOS: TipoProcedimento[] = [
  "concursoPublico",
  "consultaPrevia",
  "consultaPreviaEspecial",
  "ajusteDireto",
  "acordoQuadro",
  "outro",
];

function descricaoDe(pedido: PedidoLicenciamento): Descricao {
  if (pedido.natureza === "aberta") return "requisitos";
  return pedido.fornecedorUnico ? "exclusivo" : "produto";
}

/** Os cartões de escolha única, como no resto do L1. */
function Opcoes<T extends string | boolean>({
  nome,
  rotulo,
  valor,
  opcoes,
  onChange,
  colunas = 3,
}: {
  nome: string;
  rotulo: string;
  valor: T;
  opcoes: Array<{ valor: T; titulo: string; texto: string; extra?: string; indisponivel?: string }>;
  onChange: (valor: T) => void;
  colunas?: 2 | 3;
}) {
  return (
    <div className={`opcoes-natureza opcoes-${colunas}-colunas`} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <label
          key={String(o.valor)}
          className={[
            "opcao-natureza",
            valor === o.valor ? "opcao-natureza-ativa" : "",
            o.indisponivel ? "opcao-natureza-indisponivel" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={o.indisponivel}
        >
          <input
            type="radio"
            name={nome}
            checked={valor === o.valor}
            disabled={o.indisponivel !== undefined}
            onChange={() => onChange(o.valor)}
          />
          <span>
            <strong>{o.titulo}</strong>
            {o.extra && <span className="minimo-convidados">{o.extra}</span>}
            <span className="meta">{o.texto}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * A descrição do objeto e o procedimento proposto (L1): duas decisões
 * separadas. A descrição diz o que sai no Anexo III (requisitos, ou a licença
 * identificada); o procedimento diz quem se convida e o que se fundamenta. A
 * escolha final do procedimento é da equipa de contratação — aqui propõe-se,
 * e os valores não se verificam.
 */
export function PainelProcedimento({ pedido, onAlterar }: Props) {
  const p = pedido.procedimento;
  const descricao = descricaoDe(pedido);
  const unico = descricao === "exclusivo";
  const n = convidados(p);
  // Com o fundamento por escolher, o critério material escolhe-se antes da alínea (ou já, com fornecedor único).
  const [modoMaterialEscolhido, setModoMaterial] = useState(false);
  const modoMaterial = unico || modoMaterialEscolhido;

  const alterarProcedimento = (alteracao: Partial<ProcedimentoProposto>) =>
    onAlterar((atual) => ({ ...atual, procedimento: { ...atual.procedimento, ...alteracao } }));
  const alterarAcordo = (alteracao: Partial<ProcedimentoProposto["acordoQuadro"]>) =>
    onAlterar((atual) => ({
      ...atual,
      procedimento: { ...atual.procedimento, acordoQuadro: { ...atual.procedimento.acordoQuadro, ...alteracao } },
    }));

  function escolherDescricao(d: Descricao) {
    onAlterar((atual) => {
      if (d === "requisitos") return { ...atual, natureza: "aberta", fornecedorUnico: false };
      if (d === "produto") return { ...atual, natureza: "determinado", fornecedorUnico: false };
      // Só uma entidade: o procedimento passa a ser o ajuste direto material.
      const fundamento = atual.procedimento.fundamentoAjusteDireto;
      return {
        ...atual,
        natureza: "determinado",
        fornecedorUnico: true,
        procedimento: {
          ...atual.procedimento,
          tipo: "ajusteDireto",
          fundamentoAjusteDireto: fundamento === "valor" ? "" : fundamento,
        },
      };
    });
  }

  const extraDe = (t: TipoProcedimento): string | undefined =>
    t === "consultaPrevia"
      ? "≥ 3 convidados"
      : t === "consultaPreviaEspecial"
        ? "≥ 5 convidados"
        : t === "ajusteDireto"
          ? "1 convidado"
          : undefined;

  const tituloConvite = p.tipo === "acordoQuadro" ? "Cocontratantes a convidar" : "Entidades a convidar";
  const notaConvite =
    n === null
      ? ""
      : n.maximo === 1
        ? p.tipo === "acordoQuadro"
          ? "O cocontratante do acordo-quadro a quem se adjudica (uma linha)."
          : "A entidade a convidar (uma linha)."
        : `Uma por linha, pelo menos ${n.minimo}${
            p.tipo === "consultaPreviaEspecial"
              ? " (consulta prévia especial)"
              : p.tipo === "consultaPrevia"
                ? " (consulta prévia)"
                : ""
          }. Saem numa tabela na manifestação de necessidades.`;

  return (
    <>
      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Como se descreve o que se compra</h3>
          <p className="painel-nota">Decide o que sai no Anexo III: os requisitos, ou a licença identificada.</p>
        </header>
        <Opcoes<Descricao>
          nome="descricao-objeto"
          rotulo="Como se descreve o que se compra"
          valor={descricao}
          opcoes={DESCRICOES}
          onChange={escolherDescricao}
        />
        {descricao === "produto" && (
          <label className="campo campo-convite-motivo">
            <span className="rotulo">Porque se identifica o produto (sai na manifestação de necessidades)</span>
            <textarea
              rows={3}
              value={pedido.justificacaoProduto}
              placeholder="ex.: A plataforma em uso na SPMS e nas entidades do SNS é esta; a mudança obrigaria a migrar…"
              aria-invalid={pedido.justificacaoProduto.trim() === ""}
              onChange={(e) => onAlterar((atual) => ({ ...atual, justificacaoProduto: e.target.value }))}
            />
          </label>
        )}
        <p className="ajuda">
          Em qualquer dos casos, o preço é o único aspeto submetido à concorrência: tudo o que aqui se escreve são
          termos e condições do contrato.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Procedimento proposto</h3>
          <p className="painel-nota">
            A escolha final é da equipa de contratação; aqui propõe-se. Define quem se convida e o que se fundamenta. Os
            valores e os limites de cada procedimento verificam-se na contratação.
          </p>
        </header>
        <Opcoes<TipoProcedimento>
          nome="procedimento-proposto"
          rotulo="Procedimento proposto"
          valor={p.tipo}
          opcoes={ORDEM_PROCEDIMENTOS.map((t) => ({
            valor: t,
            ...PROCEDIMENTOS[t],
            extra: extraDe(t),
            indisponivel:
              unico && t !== "ajusteDireto"
                ? "Só uma entidade pode fornecer: o procedimento é o ajuste direto por critério material."
                : undefined,
          }))}
          onChange={(tipo) => alterarProcedimento({ tipo })}
        />

        {p.tipo === "ajusteDireto" && (
          <div className="subpainel-procedimento">
            <h4>Fundamento do ajuste direto</h4>
            <Opcoes<"valor" | "material" | "">
              nome="ajuste-direto-material"
              rotulo="Fundamento do ajuste direto"
              colunas={2}
              valor={
                p.fundamentoAjusteDireto === ""
                  ? modoMaterial
                    ? "material"
                    : ""
                  : ehAjusteDiretoMaterial(p)
                    ? "material"
                    : "valor"
              }
              opcoes={[
                {
                  valor: "valor",
                  titulo: "Em função do valor (art.º 20.º, n.º 1, al. d))",
                  texto:
                    "Valor inferior a 75 000 €. Não precisa de outro fundamento; o valor verifica-se na contratação.",
                  indisponivel: unico ? "Só uma entidade pode fornecer: o fundamento é material." : undefined,
                },
                {
                  valor: "material",
                  titulo: "Por critério material",
                  texto: "Qualquer que seja o valor: escolhe-se a alínea e explica-se.",
                },
              ]}
              onChange={(modo) => {
                setModoMaterial(modo === "material");
                alterarProcedimento({
                  fundamentoAjusteDireto:
                    modo === "material" ? (ehAjusteDiretoMaterial(p) ? p.fundamentoAjusteDireto : "") : "valor",
                });
              }}
            />
            {ehAjusteDiretoMaterial(p) && (p.fundamentoAjusteDireto !== "" || modoMaterial) && (
              <>
                <div className="linha-campos">
                  <label className="campo-crescente">
                    <span className="rotulo">Fundamento legal</span>
                    <select
                      value={p.fundamentoAjusteDireto}
                      aria-invalid={p.fundamentoAjusteDireto === ""}
                      onChange={(e) =>
                        alterarProcedimento({ fundamentoAjusteDireto: e.target.value as FundamentoAjusteDireto | "" })
                      }
                    >
                      <option value="">— por escolher —</option>
                      {FUNDAMENTOS_MATERIAIS.map((f) => (
                        <option key={f} value={f}>
                          {FUNDAMENTOS_AJUSTE_DIRETO[f].rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campo-crescente">
                    <span className="rotulo">Contexto (opcional — explica, não fundamenta)</span>
                    <select
                      value={p.contexto}
                      onChange={(e) => alterarProcedimento({ contexto: e.target.value as ContextoAjusteDireto })}
                    >
                      <option value="">—</option>
                      {(Object.entries(CONTEXTOS_AJUSTE_DIRETO) as Array<[ContextoAjusteDireto, string]>).map(
                        ([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <label className="campo">
                  <span className="rotulo">Explicação do fundamento (sai na manifestação de necessidades)</span>
                  <textarea
                    rows={3}
                    value={p.explicacao}
                    placeholder="ex.: A SNOMED International é a única entidade que licencia a SNOMED CT…"
                    aria-invalid={p.explicacao.trim() === ""}
                    onChange={(e) => alterarProcedimento({ explicacao: e.target.value })}
                  />
                </label>
                {p.fundamentoAjusteDireto === "subscricao" && (
                  <p className="ajuda">
                    Só para software pronto a usar, sem desenvolvimento nem personalização, em subscrição pela Internet,
                    fornecido pelo titular dos direitos ou por entidade por ele autorizada, com condições predefinidas,
                    e abaixo do limiar europeu (art.º 27.º, n.º 3).
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {p.tipo === "acordoQuadro" && (
          <div className="subpainel-procedimento">
            <h4>Acordo-quadro</h4>
            <div className="linha-campos">
              <label className="campo-crescente">
                <span className="rotulo">Central de compras</span>
                <input
                  type="text"
                  list="centrais-de-compras"
                  value={p.acordoQuadro.central}
                  placeholder="ex.: ESPAP"
                  aria-invalid={p.acordoQuadro.central.trim() === ""}
                  onChange={(e) => alterarAcordo({ central: e.target.value })}
                />
                <datalist id="centrais-de-compras">
                  <option value="ESPAP" />
                  <option value="SPMS" />
                </datalist>
              </label>
              <label className="campo-crescente campo-largo">
                <span className="rotulo">Acordo-quadro (designação e n.º)</span>
                <input
                  type="text"
                  value={p.acordoQuadro.designacao}
                  placeholder="ex.: Acordo-quadro de licenciamento de software, AQ-…"
                  aria-invalid={p.acordoQuadro.designacao.trim() === ""}
                  onChange={(e) => alterarAcordo({ designacao: e.target.value })}
                />
              </label>
              <label className="campo-crescente">
                <span className="rotulo">Lote (facultativo)</span>
                <input
                  type="text"
                  value={p.acordoQuadro.lote}
                  placeholder="ex.: Lote 1"
                  onChange={(e) => alterarAcordo({ lote: e.target.value })}
                />
              </label>
            </div>
            <Opcoes<ProcedimentoProposto["acordoQuadro"]["modalidade"]>
              nome="modalidade-acordo-quadro"
              rotulo="Modalidade do acordo-quadro"
              colunas={2}
              valor={p.acordoQuadro.modalidade}
              opcoes={[
                {
                  valor: "porConcretizar",
                  titulo: "Termos por concretizar — convite aos cocontratantes",
                  texto:
                    "Os cocontratantes apresentam propostas sobre o que o acordo-quadro deixou à concorrência (art.º 259.º).",
                },
                {
                  valor: "fixados",
                  titulo: "Termos todos fixados — ajuste direto ao cocontratante",
                  texto:
                    "O acordo-quadro fixa todas as condições: adjudica-se diretamente a um cocontratante (art.º 258.º).",
                },
              ]}
              onChange={(modalidade) => alterarAcordo({ modalidade })}
            />
            {p.acordoQuadro.modalidade === "porConcretizar" && (
              <label className="campo-opcao campo-todos-cocontratantes">
                <input
                  type="checkbox"
                  checked={p.acordoQuadro.todosOsCocontratantes}
                  onChange={(e) => alterarAcordo({ todosOsCocontratantes: e.target.checked })}
                />
                <span>Convidar todos os cocontratantes que reúnam as condições necessárias (sem lista)</span>
              </label>
            )}
          </div>
        )}

        {p.tipo === "outro" && (
          <div className="subpainel-procedimento">
            <label className="campo">
              <span className="rotulo">Procedimento proposto e porquê (sai na manifestação de necessidades)</span>
              <textarea
                rows={3}
                value={p.outro}
                placeholder="ex.: Concurso limitado por prévia qualificação, por ser necessário avaliar previamente a capacidade técnica…"
                aria-invalid={p.outro.trim() === ""}
                onChange={(e) => alterarProcedimento({ outro: e.target.value })}
              />
            </label>
            <label className="campo-estreito">
              <span className="rotulo">Consulta ao mercado (eAvalia)</span>
              <select
                value={p.consultaMercadoOutro}
                onChange={(e) =>
                  alterarProcedimento({ consultaMercadoOutro: e.target.value === "Sim" ? "Sim" : "Não" })
                }
              >
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </label>
          </div>
        )}
      </section>

      {n !== null && (
        <>
          {pedeMotivoDoConvite(p) && (
            <section className="painel">
              <header className="painel-cabecalho">
                <h3>Motivo do convite</h3>
              </header>
              <label className="campo campo-convite-motivo">
                <span className="rotulo">
                  Motivo do convite a estas entidades (sai na manifestação de necessidades)
                </span>
                <textarea
                  rows={3}
                  value={pedido.convite.motivo}
                  placeholder="ex.: São as entidades que, no mercado nacional, comercializam e dão suporte a plataformas com a escala exigida."
                  aria-invalid={pedido.convite.motivo.trim() === ""}
                  onChange={(e) =>
                    onAlterar((atual) => ({ ...atual, convite: { ...atual.convite, motivo: e.target.value } }))
                  }
                />
              </label>
            </section>
          )}
          <EditorEntidades
            titulo={tituloConvite}
            nota={notaConvite}
            rotuloColuna={p.tipo === "acordoQuadro" ? "Cocontratante" : "Entidade"}
            entidades={pedido.convite.entidades}
            onChange={(entidades) => onAlterar((atual) => ({ ...atual, convite: { ...atual.convite, entidades } }))}
          />
        </>
      )}
    </>
  );
}

/**
 * As entidades a convidar, uma por linha, com o NIF (obrigatório). Numa
 * entidade estrangeira escreve-se a identificação fiscal do país, sem a
 * validação do NIF português.
 */
function EditorEntidades({
  titulo,
  nota,
  rotuloColuna,
  entidades,
  onChange,
}: {
  titulo: string;
  nota: string;
  rotuloColuna: string;
  entidades: EntidadeConvidada[];
  onChange: (entidades: EntidadeConvidada[]) => void;
}) {
  const alterar = (idx: number, alteracao: Partial<EntidadeConvidada>) =>
    onChange(entidades.map((e, i) => (i === idx ? { ...e, ...alteracao } : e)));
  const nifs = entidades.map((e) => e.nif.replace(/\s/g, "").toUpperCase());

  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <h3>{titulo}</h3>
        <p className="painel-nota">
          {nota} O NIF é obrigatório; numa entidade estrangeira, a identificação fiscal do país.
        </p>
      </header>
      {entidades.length === 0 ? (
        <p className="estado-vazio">Ainda não há entidades. Acrescente a primeira.</p>
      ) : (
        <div className="tabela-edicao">
          <div className="tabela-edicao-cabecalho grelha-entidade">
            <span />
            <span>{rotuloColuna}</span>
            <span>NIF</span>
            <span>Estrangeira</span>
            <span />
          </div>
          <ul className="lista-requisitos">
            {entidades.map((e, idx) => {
              const nif = e.nif.trim();
              const nifInvalido = nif === "" || (!e.estrangeira && !nifValido(nif));
              const nifRepetido = nif !== "" && nifs.filter((x) => x === nifs[idx]).length > 1;
              return (
                <li key={e.id} className="linha-edicao">
                  <div className="grelha-entidade">
                    <span className="pega pega-fixa" aria-hidden="true">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={e.designacao}
                      placeholder="ex.: Documenta Sistemas, S.A."
                      aria-label={`${rotuloColuna} ${idx + 1}`}
                      aria-invalid={e.designacao.trim() === ""}
                      onChange={(ev) => alterar(idx, { designacao: ev.target.value })}
                    />
                    <input
                      type="text"
                      inputMode={e.estrangeira ? "text" : "numeric"}
                      value={e.nif}
                      placeholder={e.estrangeira ? "ex.: GB 123456789" : "9 dígitos"}
                      aria-label={`${e.estrangeira ? "Identificação fiscal" : "NIF"} de ${e.designacao.trim() || `${rotuloColuna} ${idx + 1}`}`}
                      aria-invalid={nifInvalido || nifRepetido}
                      onChange={(ev) => alterar(idx, { nif: ev.target.value })}
                    />
                    <label className="campo-opcao celula-estrangeira">
                      <input
                        type="checkbox"
                        checked={e.estrangeira}
                        aria-label={`${e.designacao.trim() || `${rotuloColuna} ${idx + 1}`} é estrangeira`}
                        onChange={(ev) => alterar(idx, { estrangeira: ev.target.checked })}
                      />
                      <span className="rotulo-movel" aria-hidden="true">
                        Estrangeira
                      </span>
                    </label>
                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => onChange(moverItem(entidades, idx, idx - 1))}
                        disabled={idx === 0}
                        title="Mover para cima"
                        aria-label={`Mover a entidade ${idx + 1} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => onChange(moverItem(entidades, idx, idx + 1))}
                        disabled={idx === entidades.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover a entidade ${idx + 1} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao-icone botao-perigo"
                        onClick={() => onChange(entidades.filter((_, i) => i !== idx))}
                        title="Remover entidade"
                        aria-label={`Remover a entidade ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {nif !== "" && !e.estrangeira && !nifValido(nif) && (
                    <p className="aviso aviso-erro">NIF inválido: nove dígitos, com o dígito de controlo.</p>
                  )}
                  {nifRepetido && <p className="aviso aviso-erro">Este NIF está repetido.</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button type="button" className="botao-secundario" onClick={() => onChange([...entidades, entidadeVazia()])}>
        + Adicionar entidade
      </button>
    </section>
  );
}
