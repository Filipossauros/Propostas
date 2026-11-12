// A tabela de referência do valor hora — Módulo 3 da bolsa de horas.
//
// Fundamenta, de forma genérica, os valores hora usados nos lotes: não há uma
// relação de um para um entre os perfis do procedimento e as linhas da tabela
// (o preço/hora de cada perfil continua a escrever-se no lote). A base pode ser
// a rate média das propostas dos últimos procedimentos de natureza equivalente,
// os valores hora anteriormente adjudicados, ou ambas. Sai no Anexo I da
// manifestação de necessidades, ponto 3.

import type { ErroValidacao } from "./perfil";
import { gerarId } from "./id";

export type FundamentoValorHora = "media" | "adjudicado" | "ambos";

export const FUNDAMENTOS_VALOR_HORA: Record<FundamentoValorHora, { titulo: string; texto: string }> = {
  media: {
    titulo: "Rate média das propostas",
    texto: "Média das propostas admitidas nos últimos procedimentos de natureza equivalente.",
  },
  adjudicado: {
    titulo: "Valores anteriormente adjudicados",
    texto: "Valor hora adjudicado em procedimentos ou contratos anteriores.",
  },
  ambos: {
    titulo: "Ambos",
    texto: "Uma tabela de cada: rates médias das propostas e valores adjudicados.",
  },
};

/** Uma linha da tabela das rates médias das propostas (valores sem IVA, em €/h). */
export interface LinhaRateMedia {
  id: string;
  perfil: string;
  /** Os procedimentos, um por linha. */
  procedimentos: string;
  propostas: number;
  base: number;
  maisAlta: number;
  media: number;
}

/** Uma linha da tabela dos valores anteriormente adjudicados (sem IVA, em €/h). */
export interface LinhaAdjudicado {
  id: string;
  perfil: string;
  /** O procedimento ou o contrato. */
  procedimento: string;
  ano: number;
  valorHora: number;
}

export interface ReferenciaValorHora {
  fundamento: FundamentoValorHora;
  media: LinhaRateMedia[];
  adjudicados: LinhaAdjudicado[];
}

type SemId<T> = Omit<T, "id">;

/**
 * O quadro de referência da SPMS: as rates dos concursos anteriores. É o ponto
 * de partida da tabela, que depois se edita no Módulo 3.
 */
export const TABELA_RATES_SPMS: ReadonlyArray<SemId<LinhaRateMedia>> = [
  { perfil: "Analista Funcional", procedimentos: "20260065\n20260066\n20260080", propostas: 28, base: 54.1, maisAlta: 46.5, media: 26.22 },
  { perfil: "Arquiteto de Sistemas", procedimentos: "20260080", propostas: 4, base: 59.51, maisAlta: 52, media: 47.31 },
  { perfil: "Backend — Java data access", procedimentos: "20260065", propostas: 6, base: 54.1, maisAlta: 46.5, media: 29.29 },
  { perfil: "Backend — System Integration", procedimentos: "20260080", propostas: 4, base: 54.1, maisAlta: 38.13, media: 27.3 },
  {
    perfil: "Consultor de Administração de Sistemas e Observabilidade",
    procedimentos: "20260081",
    propostas: 1,
    base: 54.1,
    maisAlta: 28.12,
    media: 28.12,
  },
  { perfil: "Frontend", procedimentos: "20260081", propostas: 7, base: 54.1, maisAlta: 46.5, media: 27.5 },
  { perfil: "Tester", procedimentos: "20260065\n20260066\n20260080\n20260081", propostas: 23, base: 27.05, maisAlta: 27.05, media: 22.6 },
  { perfil: "UX-UI Designer", procedimentos: "20260066", propostas: 13, base: 54.1, maisAlta: 37.25, media: 27.64 },
  { perfil: "Gestor de Projeto", procedimentos: "20230160", propostas: 6, base: 40.5, maisAlta: 39.7, media: 34.13 },
  { perfil: "Developer de Integração", procedimentos: "20230160", propostas: 4, base: 35.14, maisAlta: 34.9, media: 30.08 },
  { perfil: "Suporte IOP", procedimentos: "20230160", propostas: 8, base: 35.14, maisAlta: 34.9, media: 30.95 },
];

export function linhasRatesSpms(): LinhaRateMedia[] {
  return TABELA_RATES_SPMS.map((l) => ({ ...l, id: gerarId() }));
}

export function referenciaValorHoraInicial(): ReferenciaValorHora {
  return { fundamento: "media", media: linhasRatesSpms(), adjudicados: [] };
}

export function linhaRateMediaVazia(): LinhaRateMedia {
  return { id: gerarId(), perfil: "", procedimentos: "", propostas: 0, base: 0, maisAlta: 0, media: 0 };
}

export function linhaAdjudicadoVazia(): LinhaAdjudicado {
  return { id: gerarId(), perfil: "", procedimento: "", ano: 0, valorHora: 0 };
}

export function usaRateMedia(f: FundamentoValorHora): boolean {
  return f !== "adjudicado";
}

export function usaAdjudicados(f: FundamentoValorHora): boolean {
  return f !== "media";
}

/** A diferença da rate média para o valor base, em percentagem inteira; `null` sem valor base. */
export function diferencaMediaBase(l: Pick<LinhaRateMedia, "base" | "media">): number | null {
  if (!(l.base > 0) || !(l.media >= 0)) return null;
  return Math.round(((l.base - l.media) / l.base) * 100);
}

/** Os procedimentos de uma linha, um por linha, sem linhas vazias. */
export function procedimentosDe(l: Pick<LinhaRateMedia, "procedimentos">): string[] {
  return l.procedimentos
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

const finito = (v: unknown, omissao = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : omissao);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** A tabela guardada, posta em dia. Sem ela (agrupamentos anteriores), parte do quadro da SPMS. */
export function normalizarReferenciaValorHora(bruto: unknown): ReferenciaValorHora {
  if (bruto === undefined || bruto === null) return referenciaValorHoraInicial();
  const r = objeto(bruto);
  const fundamento: FundamentoValorHora =
    r.fundamento === "adjudicado" || r.fundamento === "ambos" ? r.fundamento : "media";
  const media = Array.isArray(r.media)
    ? r.media.map((x) => {
        const o = objeto(x);
        return {
          id: texto(o.id) || gerarId(),
          perfil: texto(o.perfil),
          procedimentos: texto(o.procedimentos),
          propostas: finito(o.propostas),
          base: finito(o.base),
          maisAlta: finito(o.maisAlta),
          media: finito(o.media),
        };
      })
    : linhasRatesSpms();
  const adjudicados = Array.isArray(r.adjudicados)
    ? r.adjudicados.map((x) => {
        const o = objeto(x);
        return {
          id: texto(o.id) || gerarId(),
          perfil: texto(o.perfil),
          procedimento: texto(o.procedimento),
          ano: finito(o.ano),
          valorHora: finito(o.valorHora),
        };
      })
    : [];
  return { fundamento, media, adjudicados };
}

/** O que falta na tabela: só nas partes que o fundamento usa. */
export function validarReferenciaValorHora(ref: ReferenciaValorHora, anoAtual = new Date().getFullYear()): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const falta = (mensagem: string) => erros.push({ campo: "referenciaValorHora", mensagem });
  if (usaRateMedia(ref.fundamento)) {
    if (ref.media.length === 0) falta("Valor hora de referência: acrescente pelo menos uma linha de rates médias.");
    ref.media.forEach((l, i) => {
      const nome = l.perfil.trim() || `linha ${i + 1}`;
      if (l.perfil.trim() === "") falta(`Rates médias, linha ${i + 1}: indique o perfil.`);
      if (procedimentosDe(l).length === 0) falta(`Rates médias, ${nome}: indique o(s) procedimento(s).`);
      if (!(Number.isInteger(l.propostas) && l.propostas >= 1))
        falta(`Rates médias, ${nome}: indique o n.º de propostas admitidas.`);
      if (!(l.base > 0) || !(l.maisAlta > 0) || !(l.media > 0))
        falta(`Rates médias, ${nome}: indique a rate do valor base, a mais alta e a média.`);
    });
  }
  if (usaAdjudicados(ref.fundamento)) {
    if (ref.adjudicados.length === 0)
      falta("Valor hora de referência: acrescente pelo menos uma linha de valores adjudicados.");
    ref.adjudicados.forEach((l, i) => {
      const nome = l.perfil.trim() || `linha ${i + 1}`;
      if (l.perfil.trim() === "") falta(`Valores adjudicados, linha ${i + 1}: indique o perfil.`);
      if (l.procedimento.trim() === "") falta(`Valores adjudicados, ${nome}: indique o procedimento ou o contrato.`);
      if (!(Number.isInteger(l.ano) && l.ano >= 2000 && l.ano <= anoAtual))
        falta(`Valores adjudicados, ${nome}: indique o ano da adjudicação.`);
      if (!(l.valorHora > 0)) falta(`Valores adjudicados, ${nome}: indique o valor hora adjudicado.`);
    });
  }
  return erros;
}
