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
 * O bloco de projeto sem início ou sem fim do projeto não se pode apurar: as
 * datas da linha herdam o período do projeto, ou têm de caber nele (n.os 11, alínea i), e
 * 12 das regras), e sem esse período não há com que as comparar. Toda a
 * experiência do bloco fica por considerar.
 */
export function blocoSemDatas(bloco: Bloco): boolean {
  return bloco.projInicio === null || bloco.projFim === null;
}

/**
 * Sem cliente/entidade, projeto ou função, o projeto conta — as regras já não
 * o anulam —, mas fica assinalado: o júri pode pedir evidências (n.º 14) e, sem
 * elas, não o considerar (`excluidoPeloJuri`).
 */
export function blocoSemIdentificacao(bloco: Bloco): boolean {
  return bloco.cliente.trim() === "" || bloco.projeto.trim() === "" || bloco.funcao.trim() === "";
}

/**
 * Determina o período de uma linha de requisito (6.1): datas próprias da
 * linha > herança do período do projeto > contenção no período do projeto >
 * teto do mês da data-limite de apresentação de propostas (n.º 13).
 */
export function determinarPeriodoLinha(
  bloco: Bloco,
  linha: LinhaRequisito,
  teto: MesAno,
): ResultadoPeriodoLinha {
  const descartar = (motivo: string): ResultadoPeriodoLinha => ({
    admitido: false,
    descartado: { blocoIndice: bloco.indice, requisitoId: linha.requisitoId, motivo },
  });

  if (bloco.excluidoPeloJuri) {
    return descartar("Projeto não considerado pelo júri, por falta de evidências");
  }

  if (blocoSemDatas(bloco)) {
    return descartar("Bloco de projeto sem início ou sem fim do projeto — experiência não considerada");
  }

  if (linha.inicioIncompleto || linha.fimIncompleto) {
    return descartar(
      "Preenchimento incompleto das datas de início/fim da experiência (mês sem ano, ou ano sem mês) — experiência não considerada",
    );
  }

  // A partir daqui bloco.projInicio e bloco.projFim são garantidamente não nulos.
  const temDatasProprias = linha.inicio !== null || linha.fim !== null;
  const origem: OrigemPeriodo = temDatasProprias ? "linha" : "projeto";
  const efInicio = linha.inicio ?? bloco.projInicio!;
  const efFim = linha.fim ?? bloco.projFim!;

  const inicioInt = paraMesInt(efInicio);
  const fimInt = paraMesInt(efFim);

  if (fimInt < inicioInt) {
    return descartar("Início posterior ao fim");
  }

  const projInicioInt = paraMesInt(bloco.projInicio!);
  const projFimInt = paraMesInt(bloco.projFim!);
  if (inicioInt < projInicioInt || fimInt > projFimInt) {
    return descartar("Período fora do período do projeto");
  }

  if (fimInt > paraMesInt(teto)) {
    return descartar("Período prolonga-se após a data-limite de apresentação de propostas");
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
export function apurarRequisito(blocos: Bloco[], requisito: Requisito, teto: MesAno): ApuramentoRequisito {
  const periodosAdmitidos: PeriodoAdmitido[] = [];
  const periodosDescartados: PeriodoDescartado[] = [];

  for (const bloco of blocos) {
    for (const linha of bloco.linhas) {
      if (linha.requisitoId !== requisito.id) continue;
      if (linha.declara !== "SIM") continue;

      const resultado = determinarPeriodoLinha(bloco, linha, teto);
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
export function apurarElemento(blocos: Bloco[], requisitos: Requisito[], teto: MesAno): ApuramentoElemento {
  const resultados = requisitos.map((r) => apurarRequisito(blocos, r, teto));
  return {
    requisitos: resultados,
    cumpre: resultados.every((r) => r.cumpre),
  };
}
