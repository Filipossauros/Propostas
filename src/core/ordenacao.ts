// Ordenação das propostas pelo preço — Módulo 4.
//
// O Módulo 3 apura quem cumpre os requisitos mínimos; aqui entra o único fator
// submetido à concorrência, que é o preço. É por isso que a ordenação vive
// noutro módulo: os dados vêm de sítios diferentes — o apuramento, do
// formulário de declaração; o preço, da proposta — e chegam em momentos
// diferentes.

import type { ResultadoLote, ResultadoProcedimento } from "./avaliacaoProcedimento";
import { ordenarLotes } from "./avaliacaoProcedimento";
import type { LotesJSON } from "./types";

/** Preço proposto, sem IVA, indexado por `${loteId} ${concorrente}`. */
export type PrecosPropostos = Record<string, number | null>;

export function chavePreco(loteId: string, concorrente: string): string {
  return `${loteId} ${concorrente}`;
}

/** Os lotes do apuramento pela ordem do seu número, que é a ordem da regra. */
function porNumeroDeLote(resultado: ResultadoProcedimento): ResultadoLote[] {
  const ordem = ordenarLotes(
    resultado.lotes.map((l) => ({ id: l.loteId, numero: l.numero, designacao: l.designacao, perfis: [] })),
  );
  const posicao = new Map(ordem.map((l, idx) => [l.id, idx]));
  return [...resultado.lotes].sort((a, b) => (posicao.get(a.loteId) ?? 0) - (posicao.get(b.loteId) ?? 0));
}

/** Uma proposta admitida a um lote, à espera de preço. */
export interface PropostaAdmitida {
  loteId: string;
  numero: string;
  designacao: string;
  concorrente: string;
}

/**
 * As propostas que entram na ordenação: as admitidas, e só essas.
 *
 * Quem não cumpre os requisitos mínimos não chega a esta fase — não há preço
 * que o recupere.
 */
export function propostasAdmitidas(resultado: ResultadoProcedimento): PropostaAdmitida[] {
  return porNumeroDeLote(resultado).flatMap((lote) =>
    lote.concorrentes
      .filter((c) => c.admitido)
      .map((c) => ({
        loteId: lote.loteId,
        numero: lote.numero,
        designacao: lote.designacao,
        concorrente: c.concorrente,
      })),
  );
}

export interface PropostaOrdenada {
  concorrente: string;
  /** Preço proposto sem IVA. Null quando ainda não foi indicado. */
  preco: number | null;
  /** Lugar na ordenação do lote, contando só quem não está impedido. Null para os impedidos e sem preço. */
  posicao: number | null;
  vencedora: boolean;
  /**
   * Número do lote que este concorrente já venceu e que, pela regra de um lote
   * por concorrente, o afasta deste. Null quando não há impedimento.
   */
  impedidaPeloLote: string | null;
  /** Outro concorrente apresentou exatamente o mesmo preço a este lote. */
  empatada: boolean;
}

export interface LoteOrdenado {
  loteId: string;
  numero: string;
  designacao: string;
  propostas: PropostaOrdenada[];
  /** Falta o preço de pelo menos uma proposta admitida: a ordenação ainda é provisória. */
  precosEmFalta: number;
}

export interface Ordenacao {
  lotes: LoteOrdenado[];
  umLotePorConcorrente: boolean;
}

/**
 * Ordena as propostas de cada lote pelo preço mais baixo.
 *
 * Com a limitação de um lote por concorrente, os lotes resolvem-se pela ordem
 * crescente do número: quem vence o lote 1 sai da corrida nos seguintes, ainda
 * que aí apresentasse o preço mais baixo. Tem de haver uma ordem fixada, ou o
 * resultado dependeria de por onde se começasse — e é a do número do lote que
 * o documento do procedimento fixa.
 *
 * Uma proposta sem preço não é ordenada nem vence: não há como a comparar.
 */
export function ordenarPropostas(
  resultado: ResultadoProcedimento,
  precos: PrecosPropostos,
  umLotePorConcorrente = resultado.umLotePorConcorrente,
): Ordenacao {
  const jaVenceu = new Map<string, string>();

  const lotes = porNumeroDeLote(resultado).map((lote): LoteOrdenado => {
    const candidatos = lote.concorrentes
      .filter((c) => c.admitido)
      .map((c) => ({ concorrente: c.concorrente, preco: precos[chavePreco(lote.loteId, c.concorrente)] ?? null }))
      .sort((a, b) => {
        if (a.preco === null && b.preco === null) return a.concorrente.localeCompare(b.concorrente, "pt");
        if (a.preco === null) return 1;
        if (b.preco === null) return -1;
        return a.preco - b.preco || a.concorrente.localeCompare(b.concorrente, "pt");
      });

    let lugar = 0;
    let jaHaVencedora = false;

    const propostas = candidatos.map((candidato): PropostaOrdenada => {
      const impedidaPeloLote = umLotePorConcorrente ? jaVenceu.get(candidato.concorrente) ?? null : null;
      const ordenavel = impedidaPeloLote === null && candidato.preco !== null;
      const posicao = ordenavel ? ++lugar : null;
      const vencedora = ordenavel && !jaHaVencedora;
      if (vencedora) jaHaVencedora = true;

      return {
        concorrente: candidato.concorrente,
        preco: candidato.preco,
        posicao,
        vencedora,
        impedidaPeloLote,
        empatada:
          candidato.preco !== null && candidatos.filter((outro) => outro.preco === candidato.preco).length > 1,
      };
    });

    // Só depois de fechado o lote é que o vencedor passa a impedir: dentro do
    // mesmo lote nenhum concorrente afasta outro.
    if (umLotePorConcorrente) {
      const vencedora = propostas.find((p) => p.vencedora);
      if (vencedora !== undefined && !jaVenceu.has(vencedora.concorrente)) {
        jaVenceu.set(vencedora.concorrente, lote.numero);
      }
    }

    return {
      loteId: lote.loteId,
      numero: lote.numero,
      designacao: lote.designacao,
      propostas,
      precosEmFalta: propostas.filter((p) => p.preco === null).length,
    };
  });

  return { lotes, umLotePorConcorrente };
}

/** Preço em euros, como aparece nas peças do procedimento. */
export function formatarPreco(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/** A regra da ordenação, dita por extenso, quando a limitação está ativa. */
export const REGRA_UM_LOTE =
  "Cada concorrente só pode ficar com um lote. Os lotes são decididos pela ordem crescente do número: " +
  "quem vence o lote com o número mais baixo sai da corrida nos lotes seguintes, ainda que aí apresente " +
  "o preço mais baixo.";

/** O projeto e o procedimento, para dar contexto aos ficheiros gerados. */
export function contextoDe(config: LotesJSON): string {
  return [config.nomeProjeto, config.nomeProcedimento].filter((t) => t.trim() !== "").join(" · ");
}
