import { useEffect, useState, type DragEvent } from "react";
import type { Lote, PerfilEmLote } from "../core/types";
import { comHorasDoAno, formatarMoeda, horasPorAnoDe, precoBaseEntrada, totalLote } from "../core/lotes";
import { certificacoesDoPerfil } from "../core/perfil";
import { DIAS_DE_FERIADO_MUNICIPAL, DIAS_DE_FERIAS, HORAS_POR_DIA, horasUteisDoAno } from "../core/horasUteis";
import { CampoNumero } from "../ui/CampoNumero";
import { DicaNota } from "../ui/DicaNota";
import { DicaRequisitos } from "../ui/DicaRequisitos";
import { moverItem, useReordenavel } from "../ui/useReordenavel";

interface Props {
  lote: Lote;
  onAlterar: (alteracao: Partial<Lote>) => void;
  onRemover: () => void;
  onRetirarPerfil: (perfilEmLoteId: string) => void;
  /**
   * Anos económicos do contrato, quando o procedimento leva pedido de encargos
   * plurianuais. Com eles, as horas escrevem-se ano a ano em vez de num total.
   */
  anosPlurianuais?: number[];
  /** Ano a que as horas úteis se referem quando não há repartição por anos. */
  anoDeReferencia: number;
  /** Os outros lotes, para onde um perfil pode passar. */
  outrosLotes: Array<{ id: string; rotulo: string }>;
  /** Passa um perfil deste lote para outro (pelo seletor, sem arrastar). */
  onMoverPerfil: (perfilEmLoteId: string, paraLoteId: string) => void;
  /** Recebe um perfil arrastado de outro lote, na posição `indice`. */
  onReceberPerfil: (deLoteId: string, perfilEmLoteId: string, indice: number) => void;
}

/**
 * O que viaja num arrasto de perfil: o lote de origem e o perfil. Com um tipo
 * próprio, o lote de destino sabe, ainda durante o arrasto, que é um perfil de
 * outro lote (o conteúdo só se lê ao largar).
 */
const TIPO_ARRASTO = "application/x-propostas-perfil-lote";

export function EditorLote({
  lote,
  onAlterar,
  onRemover,
  onRetirarPerfil,
  anosPlurianuais: anos,
  anoDeReferencia,
  outrosLotes,
  onMoverPerfil,
  onReceberPerfil,
}: Props) {
  const reordenavel = useReordenavel((de, para) => onAlterar({ perfis: moverItem(lote.perfis, de, para) }));
  // Onde cairia um perfil vindo de outro lote: depois da linha `n`, ou no fim (lote.perfis.length).
  const [alvoExterno, setAlvoExterno] = useState<number | null>(null);

  // Um arrasto largado fora (ou cancelado) não chega a este lote: limpa o destaque.
  useEffect(() => {
    if (alvoExterno === null) return;
    const limpar = () => window.setTimeout(() => setAlvoExterno(null), 0);
    document.addEventListener("dragend", limpar, true);
    document.addEventListener("drop", limpar, true);
    return () => {
      document.removeEventListener("dragend", limpar, true);
      document.removeEventListener("drop", limpar, true);
    };
  }, [alvoExterno]);

  /** Se o que se arrasta é um perfil de outro lote (um do próprio lote reordena-se). */
  function vemDeOutroLote(e: DragEvent<HTMLElement>): boolean {
    return reordenavel.aArrastar === null && Array.from(e.dataTransfer.types).includes(TIPO_ARRASTO);
  }

  function aceitar(e: DragEvent<HTMLElement>, indice: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (alvoExterno !== indice) setAlvoExterno(indice);
  }

  function receber(e: DragEvent<HTMLElement>, indice: number) {
    e.preventDefault();
    e.stopPropagation();
    setAlvoExterno(null);
    try {
      const { loteId, perfilEmLoteId } = JSON.parse(e.dataTransfer.getData(TIPO_ARRASTO)) as {
        loteId: string;
        perfilEmLoteId: string;
      };
      if (loteId !== lote.id) onReceberPerfil(loteId, perfilEmLoteId, indice);
    } catch {
      // Um arrasto sem os dados esperados não move nada.
    }
  }

  function alterarPerfil(perfilEmLoteId: string, alteracao: Partial<PerfilEmLote>) {
    onAlterar({
      perfis: lote.perfis.map((e) => (e.id === perfilEmLoteId ? { ...e, ...alteracao } : e)),
    });
  }

  function mover(idx: number, direcao: -1 | 1) {
    onAlterar({ perfis: moverItem(lote.perfis, idx, idx + direcao) });
  }

  /**
   * Enche as horas de todos os perfis do lote com as horas úteis do ano.
   *
   * É um ponto de partida, e não uma imposição: um perfil que só entre a meio
   * do contrato, ou a tempo parcial, corrige-se a seguir no seu campo. O que
   * isto poupa é ir contar dias a um calendário para os pôr todos iguais.
   */
  function preencherHorasUteis() {
    onAlterar({
      perfis: lote.perfis.map((entrada) =>
        anos === undefined
          ? { ...entrada, horas: horasUteisDoAno(anoDeReferencia).horas }
          : { ...entrada, horasPorAno: anos.map((ano) => horasUteisDoAno(ano).horas) },
      ),
    });
  }

  return (
    <article
      className={alvoExterno === null ? "cartao-lote" : "cartao-lote cartao-lote-alvo"}
      onDragOver={(e) => {
        if (vemDeOutroLote(e)) aceitar(e, lote.perfis.length);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAlvoExterno(null);
      }}
      onDrop={(e) => {
        if (vemDeOutroLote(e)) receber(e, lote.perfis.length);
      }}
    >
      <header className="cartao-lote-cabecalho">
        <label className="campo-estreito">
          <span className="rotulo">Lote n.º</span>
          <input
            type="text"
            value={lote.numero}
            onChange={(e) => onAlterar({ numero: e.target.value })}
            aria-invalid={lote.numero.trim() === ""}
          />
        </label>

        <label className="campo-crescente">
          <span className="rotulo">Designação do lote</span>
          <input
            type="text"
            value={lote.designacao}
            placeholder="ex.: Desenvolvimento aplicacional"
            onChange={(e) => onAlterar({ designacao: e.target.value })}
            aria-invalid={lote.designacao.trim() === ""}
          />
        </label>

        <button type="button" className="botao-discreto botao-perigo" onClick={onRemover}>
          Remover lote
        </button>
      </header>

      {lote.perfis.length > 0 && (
        <div className="cartao-lote-acoes">
          <button type="button" className="botao-discreto" onClick={preencherHorasUteis}>
            Preencher com as horas úteis
          </button>
          <DicaNota rotulo="Como se contam as horas úteis" ancora="esquerda">
            <ExplicacaoHorasUteis anos={anos ?? [anoDeReferencia]} />
          </DicaNota>
        </div>
      )}

      {lote.perfis.length === 0 ? (
        <p className="estado-vazio estado-vazio-encaixado">
          Sem perfis atribuídos a este lote. Atribua um em «Perfis por atribuir», ou arraste-o de outro lote.
        </p>
      ) : (
        <div className="tabela-edicao">
          {/* Uma linha por perfil, com os rótulos no cabeçalho: com vários
              perfis por lote, repetir "Horas" e "Preço/hora" em cada bloco
              triplicava a altura do cartão sem acrescentar informação. */}
          <div
            className={
              anos === undefined
                ? "tabela-edicao-cabecalho grelha-perfil-lote"
                : "tabela-edicao-cabecalho grelha-perfil-lote grelha-plurianual"
            }
          >
            <span />
            <span>Perfil</span>
            <span>N.º mín.</span>
            {anos === undefined ? <span>Horas</span> : anos.map((ano) => <span key={ano}>Horas {ano}</span>)}
            <span>Preço/hora</span>
            <span>Valor estimado s/ IVA</span>
            <span />
          </div>

          <ul className="lista-perfis-lote">
            {lote.perfis.map((entrada, idx) => {
              const alvo = reordenavel.propsAlvo(idx);
              const pega = reordenavel.propsPega(idx);
              return (
                <li
                  key={entrada.id}
                  className={reordenavel.aArrastar === idx ? "linha-edicao linha-a-arrastar" : "linha-edicao"}
                  onDragOver={(e) => (vemDeOutroLote(e) ? aceitar(e, idx + 1) : alvo.onDragOver(e))}
                  onDrop={(e) => (vemDeOutroLote(e) ? receber(e, idx + 1) : alvo.onDrop(e))}
                  data-alvo={alvo["data-alvo"] ?? (alvoExterno === idx + 1 ? true : undefined)}
                >
                  <div className={anos === undefined ? "grelha-perfil-lote" : "grelha-perfil-lote grelha-plurianual"}>
                    <span
                      className="pega"
                      title="Arrastar para reordenar, ou para outro lote"
                      aria-hidden="true"
                      {...pega}
                      onDragStart={(e) => {
                        pega.onDragStart(e);
                        e.dataTransfer.setData(
                          TIPO_ARRASTO,
                          JSON.stringify({ loteId: lote.id, perfilEmLoteId: entrada.id }),
                        );
                      }}
                    >
                      {idx + 1}
                    </span>

                    <div className="perfil-em-lote-titulo">
                      <strong>{entrada.perfil.perfil || "(perfil sem designação)"}</strong>
                      <DicaRequisitos
                        requisitos={entrada.perfil.requisitos}
                        certificacoes={certificacoesDoPerfil(entrada.perfil)}
                      />
                      {outrosLotes.length > 0 && (
                        <select
                          className="mover-para-lote"
                          value=""
                          aria-label={`Mover ${entrada.perfil.perfil || "o perfil"} para outro lote`}
                          onChange={(e) => {
                            if (e.target.value !== "") onMoverPerfil(entrada.id, e.target.value);
                          }}
                        >
                          <option value="">Mover para o lote…</option>
                          {outrosLotes.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <CampoNumero
                      valor={entrada.nMinimoElementos}
                      min={1}
                      step={1}
                      aria-label={`N.º mínimo de elementos de ${entrada.perfil.perfil}`}
                      invalido={!Number.isInteger(entrada.nMinimoElementos) || entrada.nMinimoElementos < 1}
                      onChange={(nMinimoElementos) => alterarPerfil(entrada.id, { nMinimoElementos })}
                    />

                    {/* Com pedido plurianual, as horas escrevem-se ano a ano e o
                      total é a soma: assim não há um total que discorde dos
                      anos, que seria a mesma peça a dizer dois números. */}
                    {anos === undefined ? (
                      <CampoNumero
                        valor={entrada.horas}
                        min={0}
                        step={1}
                        sufixo="h"
                        aria-label={`Horas de ${entrada.perfil.perfil}`}
                        invalido={!(entrada.horas > 0)}
                        onChange={(horas) => alterarPerfil(entrada.id, { horas })}
                      />
                    ) : (
                      anos.map((ano, i) => (
                        <CampoNumero
                          key={ano}
                          valor={horasPorAnoDe(entrada, true)[i]}
                          min={0}
                          step={1}
                          sufixo="h"
                          aria-label={`Horas de ${ano} de ${entrada.perfil.perfil}`}
                          invalido={!(horasPorAnoDe(entrada, true)[i] >= 0)}
                          onChange={(horas) => alterarPerfil(entrada.id, comHorasDoAno(entrada, i, horas))}
                        />
                      ))
                    )}

                    <CampoNumero
                      valor={entrada.valorHora}
                      min={0}
                      step={0.01}
                      sufixo="€"
                      aria-label={`Preço por hora de ${entrada.perfil.perfil}, sem IVA`}
                      invalido={!(entrada.valorHora > 0)}
                      onChange={(valorHora) => alterarPerfil(entrada.id, { valorHora })}
                    />

                    <strong className="valor-calculado">
                      {formatarMoeda(precoBaseEntrada(entrada, anos !== undefined))}
                    </strong>

                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        title="Mover para cima"
                        aria-label={`Mover ${entrada.perfil.perfil} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        onClick={() => mover(idx, 1)}
                        disabled={idx === lote.perfis.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover ${entrada.perfil.perfil} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="botao-icone botao-perigo"
                        onClick={() => onRetirarPerfil(entrada.id)}
                        title="Retirar do lote"
                        aria-label={`Retirar ${entrada.perfil.perfil} do lote`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <footer className="cartao-lote-rodape">
        <span>Valor estimado do lote (sem IVA)</span>
        <strong>{formatarMoeda(totalLote(lote, 0, anos !== undefined).semIva)}</strong>
      </footer>
    </article>
  );
}

/**
 * O cálculo por extenso, ano a ano.
 *
 * As contas aparecem porque quem assina a peça responde por elas: um número
 * que sai de um botão sem se saber de onde vem obriga a refazê-lo à mão para
 * confiar nele, e então mais valia escrevê-lo à mão.
 */
function ExplicacaoHorasUteis({ anos }: { anos: number[] }) {
  return (
    <>
      <p>
        Dias de semana do ano, menos os feriados nacionais que caiam em dia útil, menos {DIAS_DE_FERIAS} dias de férias,
        menos {DIAS_DE_FERIADO_MUNICIPAL} dia de feriado municipal, vezes {HORAS_POR_DIA} horas por dia.
      </p>
      <ul>
        {anos.map((ano) => {
          const c = horasUteisDoAno(ano);
          return (
            <li key={ano}>
              <span>
                {ano}: ({c.diasDeSemana} dias de semana − {c.feriados} feriados − {c.ferias} férias − {c.municipal}{" "}
                municipal) × {c.horasPorDia} h
              </span>
              <strong>{c.horas} h</strong>
            </li>
          );
        })}
      </ul>
      <p>
        O feriado municipal conta um dia, sem se saber qual: depende do concelho da prestação, mas todos têm um. Fica de
        fora o Carnaval, que é tolerância de ponto e não feriado obrigatório. Corrija as horas à mão se o quiser
        descontar.
      </p>
    </>
  );
}
