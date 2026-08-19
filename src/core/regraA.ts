// Núcleo de cálculo — Regra A (PLANO.md secção 6).
// Módulo puro, sem dependências de UI. Determinismo total: mesmo input -> mesmo output.

import type { Bloco, LinhaRequisito, MesAno, Requisito } from "./types";

/** Representa um mês de calendário como inteiro: ano * 12 + mes. */
export function paraMesInt(ma: MesAno): number {
  return ma.ano * 12 + ma.mes;
}

export function deMesInt(m: number): MesAno {
  const ano = Math.floor((m - 1) / 12);
  const mes = m - ano * 12;
  return { ano, mes };
}

/** Contagem inclusiva de meses entre dois inteiros de mês (ambos os extremos incluídos). */
export function contarMesesInclusive(inicio: number, fim: number): number {
  return fim >= inicio ? fim - inicio + 1 : 0;
}

export type OrigemPeriodo = "linha" | "projeto";

export interface PeriodoAdmitido {
  blocoIndice: number;
  requisitoId: string;
  origem: OrigemPeriodo;
  inicio: MesAno;
  fim: MesAno;
  inicioInt: number;
  fimInt: number;
}

export interface PeriodoDescartado {
  blocoIndice: number;
  requisitoId: string;
  motivo: string;
}

export type ResultadoPeriodoLinha =
  | { admitido: true; periodo: PeriodoAdmitido }
  | { admitido: false; descartado: PeriodoDescartado };

/**
 * Determina o período do projeto (com fim efetivo já resolvido para "em curso").
 * Devolve null quando não há dados suficientes para determinar o fim.
 */
function projFimEfetivo(bloco: Bloco, dataLimitePropostas: MesAno): MesAno | null {
  if (bloco.projFim !== null) return bloco.projFim;
  if (bloco.emCurso === "Sim") return dataLimitePropostas;
  return null;
}

/**
 * Determina o período de uma linha de requisito (6.1), aplicando as 4 regras:
 * datas próprias > herança do projeto > "em curso" > contenção no período do projeto.
 */
export function determinarPeriodoLinha(
  bloco: Bloco,
  linha: LinhaRequisito,
  dataLimitePropostas: MesAno,
): ResultadoPeriodoLinha {
  const descartar = (motivo: string): ResultadoPeriodoLinha => ({
    admitido: false,
    descartado: { blocoIndice: bloco.indice, requisitoId: linha.requisitoId, motivo },
  });

  const fimProjeto = projFimEfetivo(bloco, dataLimitePropostas);
  const temDatasProprias = linha.inicio !== null || linha.fim !== null;

  let origem: OrigemPeriodo;
  let efInicio: MesAno | null;
  let efFim: MesAno | null;

  if (!temDatasProprias) {
    origem = "projeto";
    efInicio = bloco.projInicio;
    efFim = fimProjeto;
  } else {
    origem = "linha";
    efInicio = linha.inicio ?? bloco.projInicio;
    efFim = linha.fim ?? fimProjeto;
  }

  if (efInicio === null || efFim === null) {
    return descartar("Data de início ou de fim indeterminável (projeto sem datas suficientes)");
  }

  const inicioInt = paraMesInt(efInicio);
  const fimInt = paraMesInt(efFim);

  if (fimInt < inicioInt) {
    return descartar("Início posterior ao fim");
  }

  if (bloco.projInicio !== null && fimProjeto !== null) {
    const projInicioInt = paraMesInt(bloco.projInicio);
    const projFimInt = paraMesInt(fimProjeto);
    if (inicioInt < projInicioInt || fimInt > projFimInt) {
      return descartar("Período fora do período do projeto");
    }
  }

  return {
    admitido: true,
    periodo: {
      blocoIndice: bloco.indice,
      requisitoId: linha.requisitoId,
      origem,
      inicio: efInicio,
      fim: efFim,
      inicioInt,
      fimInt,
    },
  };
}

export interface ApuramentoRequisito {
  requisitoId: string;
  mesesApurados: number;
  mesesMinimos: number;
  cumpre: boolean;
  periodosAdmitidos: PeriodoAdmitido[];
  periodosDescartados: PeriodoDescartado[];
}

/** Apura um único requisito ao longo de todos os blocos de uma declaração (6.2). */
export function apurarRequisito(
  blocos: Bloco[],
  requisito: Requisito,
  dataLimitePropostas: MesAno,
): ApuramentoRequisito {
  const periodosAdmitidos: PeriodoAdmitido[] = [];
  const periodosDescartados: PeriodoDescartado[] = [];

  for (const bloco of blocos) {
    for (const linha of bloco.linhas) {
      if (linha.requisitoId !== requisito.id) continue;
      if (linha.declara !== "SIM") continue;

      const resultado = determinarPeriodoLinha(bloco, linha, dataLimitePropostas);
      if (resultado.admitido) {
        periodosAdmitidos.push(resultado.periodo);
      } else {
        periodosDescartados.push(resultado.descartado);
      }
    }
  }

  const meses = new Set<number>();
  for (const periodo of periodosAdmitidos) {
    for (let m = periodo.inicioInt; m <= periodo.fimInt; m++) {
      meses.add(m);
    }
  }

  const mesesApurados = meses.size;

  return {
    requisitoId: requisito.id,
    mesesApurados,
    mesesMinimos: requisito.mesesMinimos,
    cumpre: mesesApurados >= requisito.mesesMinimos,
    periodosAdmitidos,
    periodosDescartados,
  };
}

export interface ApuramentoElemento {
  requisitos: ApuramentoRequisito[];
  cumpre: boolean;
}

/** Apura todos os requisitos de uma declaração/elemento. */
export function apurarElemento(
  blocos: Bloco[],
  requisitos: Requisito[],
  dataLimitePropostas: MesAno,
): ApuramentoElemento {
  const resultados = requisitos.map((r) => apurarRequisito(blocos, r, dataLimitePropostas));
  return {
    requisitos: resultados,
    cumpre: resultados.every((r) => r.cumpre),
  };
}
