// Validação semântica de uma declaração lida — PLANO.md 7.1, passo 3.
// Combina o resultado estrutural do leitor (src/excel/ler.ts) com o núcleo de
// cálculo (Regra A) para produzir a lista completa de alertas. A aplicação
// sinaliza, nunca exclui (princípio 4).

import { ANO_MAXIMO, ANO_MINIMO } from "./types";
import type { Alerta, Bloco, ConfiguracaoJSON, Declaracao, MesAno } from "./types";
import { apurarElemento, paraMesInt, type ApuramentoElemento } from "./regraA";

/** Bloco preenchido (7.1): consta qualquer elemento identificativo do cliente, projeto ou período. */
export function blocoPreenchido(bloco: Bloco): boolean {
  return (
    bloco.cliente.trim() !== "" ||
    bloco.projeto.trim() !== "" ||
    bloco.funcao.trim() !== "" ||
    bloco.projInicio !== null ||
    bloco.projFim !== null ||
    bloco.emCurso !== null
  );
}

function anoForaDoIntervalo(data: MesAno | null): boolean {
  return data !== null && (data.ano < ANO_MINIMO || data.ano > ANO_MAXIMO || data.mes < 1 || data.mes > 12);
}

function validarCamposObrigatorios(bloco: Bloco): Alerta[] {
  if (!blocoPreenchido(bloco)) return [];
  const alertas: Alerta[] = [];
  for (const linha of bloco.linhas) {
    if (linha.declara === null) {
      alertas.push({
        tipo: "campoObrigatorioBranco",
        mensagem: `Bloco ${bloco.indice}: "Declara experiência?" por preencher para o requisito.`,
        blocoIndice: bloco.indice,
        requisitoId: linha.requisitoId,
      });
    }
  }
  return alertas;
}

function validarDatasBloco(bloco: Bloco): Alerta[] {
  const alertas: Alerta[] = [];

  for (const data of [bloco.projInicio, bloco.projFim]) {
    if (anoForaDoIntervalo(data)) {
      alertas.push({
        tipo: "datasIncoerentes",
        mensagem: `Bloco ${bloco.indice}: data do projeto fora do intervalo admitido (${ANO_MINIMO}–${ANO_MAXIMO}).`,
        blocoIndice: bloco.indice,
      });
    }
  }

  if (bloco.projInicio !== null && bloco.projFim !== null && paraMesInt(bloco.projFim) < paraMesInt(bloco.projInicio)) {
    alertas.push({
      tipo: "datasIncoerentes",
      mensagem: `Bloco ${bloco.indice}: a data de início do projeto é posterior à data de fim.`,
      blocoIndice: bloco.indice,
    });
  }

  for (const linha of bloco.linhas) {
    for (const data of [linha.inicio, linha.fim]) {
      if (anoForaDoIntervalo(data)) {
        alertas.push({
          tipo: "datasIncoerentes",
          mensagem: `Bloco ${bloco.indice}: data de experiência fora do intervalo admitido (${ANO_MINIMO}–${ANO_MAXIMO}).`,
          blocoIndice: bloco.indice,
          requisitoId: linha.requisitoId,
        });
      }
    }
    if (linha.inicio !== null && linha.fim !== null && paraMesInt(linha.fim) < paraMesInt(linha.inicio)) {
      alertas.push({
        tipo: "datasIncoerentes",
        mensagem: `Bloco ${bloco.indice}: a data de início da experiência é posterior à data de fim.`,
        blocoIndice: bloco.indice,
        requisitoId: linha.requisitoId,
      });
    }
  }

  return alertas;
}

function validarIdentificacao(declaracao: Declaracao): Alerta[] {
  const alertas: Alerta[] = [];
  if (declaracao.identificacao.nome.trim() === "") {
    alertas.push({ tipo: "identificacaoIncompleta", mensagem: "Nome do candidato por preencher." });
  }
  if (declaracao.identificacao.entidadeConcorrente.trim() === "") {
    alertas.push({ tipo: "identificacaoIncompleta", mensagem: "Entidade concorrente por preencher." });
  }
  return alertas;
}

/** Alertas derivados dos períodos descartados pela Regra A (6.1.4). */
function alertasDoApuramento(apuramento: ApuramentoElemento, requisitosPorId: Map<string, string>): Alerta[] {
  const alertas: Alerta[] = [];
  for (const resultado of apuramento.requisitos) {
    const designacao = requisitosPorId.get(resultado.requisitoId) ?? resultado.requisitoId;
    for (const descarte of resultado.periodosDescartados) {
      const tipo = descarte.motivo.includes("fora do período") ? "periodoForaDoProjeto" : "datasIncoerentes";
      alertas.push({
        tipo,
        mensagem: `Bloco ${descarte.blocoIndice}, requisito "${designacao}": ${descarte.motivo.toLowerCase()}.`,
        blocoIndice: descarte.blocoIndice,
        requisitoId: descarte.requisitoId,
      });
    }
  }
  return alertas;
}

/**
 * Valida uma declaração já lida, devolvendo-a com a lista completa de
 * alertas (estruturais + semânticos), sem nunca excluir dados.
 */
export function validarDeclaracao(declaracao: Declaracao, config: ConfiguracaoJSON): Declaracao {
  const dataLimite = parseDataLimite(config.dataLimitePropostas);
  const apuramento = apurarElemento(declaracao.blocos, config.requisitos, dataLimite);
  const requisitosPorId = new Map(config.requisitos.map((r) => [r.id, r.designacao]));

  const alertasSemânticos: Alerta[] = [
    ...validarIdentificacao(declaracao),
    ...declaracao.blocos.flatMap(validarCamposObrigatorios),
    ...declaracao.blocos.flatMap(validarDatasBloco),
    ...alertasDoApuramento(apuramento, requisitosPorId),
  ];

  return {
    ...declaracao,
    alertas: [...declaracao.alertas, ...alertasSemânticos],
  };
}

export function parseDataLimite(dataLimitePropostas: string): MesAno {
  const data = new Date(dataLimitePropostas);
  return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 };
}
