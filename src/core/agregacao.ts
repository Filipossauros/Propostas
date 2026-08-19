// Apuramento e agregação por concorrente.

import type { Alerta, ConfiguracaoAvaliacao, Declaracao } from "./types";
import type { ApuramentoElemento } from "./regraA";
import { validarEApurar } from "./validar";
import { construirMapaReconciliacao, type GrupoConcorrentes } from "./reconciliacao";

export interface ResultadoElemento {
  declaracao: Declaracao;
  /** Nome do concorrente após reconciliação. */
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

const SEM_ENTIDADE = "(entidade concorrente por preencher)";

/** Apura cada declaração pela Regra A e agrega por concorrente. */
export function apurarEAgregar(
  declaracoes: Declaracao[],
  config: ConfiguracaoAvaliacao,
  grupos: GrupoConcorrentes[],
  /** Alertas do comparador PDF↔Excel, indexados pelo id da declaração. */
  alertasPdfPorDeclaracao?: Map<string, Alerta[]>,
): ResultadoConcorrente[] {
  const mapaReconciliacao = construirMapaReconciliacao(grupos);

  const resultadosElemento: ResultadoElemento[] = declaracoes.map((declaracaoBruta) => {
    const { declaracao, apuramento } = validarEApurar(declaracaoBruta, config);
    const entidade = declaracao.identificacao.entidadeConcorrente.trim();
    const concorrente = entidade === "" ? SEM_ENTIDADE : mapaReconciliacao.get(entidade) ?? entidade;
    const alertasPdf = alertasPdfPorDeclaracao?.get(declaracao.id) ?? [];

    return { declaracao, concorrente, apuramento, alertas: [...declaracao.alertas, ...alertasPdf] };
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

      return {
        concorrente,
        elementos,
        nElementos,
        nElementosSuficiente,
        todosElementosCumprem,
        cumpre: todosElementosCumprem && nElementosSuficiente,
        nAlertas: elementos.reduce((soma, e) => soma + e.alertas.length, 0),
      };
    })
    .sort((a, b) => a.concorrente.localeCompare(b.concorrente, "pt"));
}

/** Designações dos requisitos que um elemento não cumpre, na ordem da configuração. */
export function requisitosFalhados(apuramento: ApuramentoElemento, config: ConfiguracaoAvaliacao): string[] {
  const porId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));
  return apuramento.requisitos
    .filter((r) => !r.cumpre)
    .map((r) => porId.get(r.requisitoId) ?? r.requisitoId);
}
