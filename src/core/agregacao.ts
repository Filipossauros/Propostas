// Apuramento e agregação por concorrente — PLANO.md 7.1, passos 5 e 6.

import type { Alerta, ConfiguracaoJSON, Declaracao } from "./types";
import { apurarElemento, type ApuramentoElemento } from "./regraA";
import { parseDataLimite, validarDeclaracao } from "./validar";
import { construirMapaReconciliacao, type GrupoConcorrentes } from "./reconciliacao";

export interface ResultadoElemento {
  declaracao: Declaracao;
  /** Nome do concorrente após reconciliação (7.1, passo 4). */
  concorrente: string;
  apuramento: ApuramentoElemento;
  alertas: Alerta[];
}

export interface ResultadoConcorrente {
  concorrente: string;
  elementos: ResultadoElemento[];
  nElementos: number;
  nElementosSuficiente: boolean;
  todosElementosCumprem: boolean;
  /** Cumpre = todos os elementos cumprem E o n.º de elementos é suficiente. */
  cumpre: boolean;
  nAlertas: number;
}

/** Apura cada declaração pela Regra A e agrega por concorrente (passos 5 e 6). */
export function apurarEAgregar(
  declaracoes: Declaracao[],
  config: ConfiguracaoJSON,
  grupos: GrupoConcorrentes[],
): ResultadoConcorrente[] {
  const dataLimite = parseDataLimite(config.dataLimitePropostas);
  const mapaReconciliacao = construirMapaReconciliacao(grupos);

  const resultadosElemento: ResultadoElemento[] = declaracoes.map((declaracaoBruta) => {
    const declaracao = validarDeclaracao(declaracaoBruta, config);
    const apuramento = apurarElemento(declaracao.blocos, config.requisitos, dataLimite);
    const concorrente = mapaReconciliacao.get(declaracao.identificacao.entidadeConcorrente) ??
      declaracao.identificacao.entidadeConcorrente;

    return { declaracao, concorrente, apuramento, alertas: declaracao.alertas };
  });

  const porConcorrente = new Map<string, ResultadoElemento[]>();
  for (const resultado of resultadosElemento) {
    const lista = porConcorrente.get(resultado.concorrente) ?? [];
    lista.push(resultado);
    porConcorrente.set(resultado.concorrente, lista);
  }

  return [...porConcorrente.entries()]
    .map(([concorrente, elementos]) => {
      const nElementos = elementos.length;
      const nElementosSuficiente = nElementos >= config.nMinimoElementos;
      const todosElementosCumprem = elementos.every((e) => e.apuramento.cumpre);
      const nAlertas = elementos.reduce((soma, e) => soma + e.alertas.length, 0);

      return {
        concorrente,
        elementos,
        nElementos,
        nElementosSuficiente,
        todosElementosCumprem,
        cumpre: todosElementosCumprem && nElementosSuficiente,
        nAlertas,
      };
    })
    .sort((a, b) => a.concorrente.localeCompare(b.concorrente, "pt"));
}

/** Designações dos requisitos que um elemento não cumpre, na ordem da configuração. */
export function requisitosFalhados(apuramento: ApuramentoElemento, config: ConfiguracaoJSON): string[] {
  const porId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
  return apuramento.requisitos
    .filter((r) => !r.cumpre)
    .map((r) => porId.get(r.requisitoId) ?? r.requisitoId);
}
