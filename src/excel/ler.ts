// Leitura de uma declaração de experiência em Excel para o modelo interno (PLANO.md 3.2).
// Extração estrutural pura — a validação semântica (campos obrigatórios, datas
// incoerentes, períodos fora do projeto) vive no módulo de avaliação (Fase 3),
// que combina isto com o núcleo de cálculo (Regra A).

import * as XLSX from "xlsx";
import type { Alerta, Bloco, ConfiguracaoJSON, Declaracao, Identificacao, LinhaRequisito, MesAno } from "../core/types";
import {
  CAMPOS_IDENTIFICACAO,
  NOME_FOLHA_EXPERIENCIA,
  OFFSET_CLIENTE_PROJETO,
  OFFSET_DATAS_PROJETO,
  OFFSET_FUNCAO,
  OFFSET_PRIMEIRA_LINHA_REQUISITO,
  linhaInicialBloco,
} from "./layout";

function lerTexto(sheet: XLSX.WorkSheet, ref: string): string {
  const cell = sheet[ref];
  if (!cell || cell.v === undefined || cell.v === null) return "";
  return String(cell.v).trim();
}

function lerInteiro(sheet: XLSX.WorkSheet, ref: string): number | null {
  const cell = sheet[ref];
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return null;
  const n = typeof cell.v === "number" ? cell.v : Number(String(cell.v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function lerMesAno(sheet: XLSX.WorkSheet, refMes: string, refAno: string): MesAno | null {
  const mes = lerInteiro(sheet, refMes);
  const ano = lerInteiro(sheet, refAno);
  if (mes === null || ano === null) return null;
  return { mes, ano };
}

function lerSimNao(sheet: XLSX.WorkSheet, ref: string): "Sim" | "Não" | null {
  const texto = lerTexto(sheet, ref);
  if (texto === "Sim" || texto === "Não") return texto;
  return null;
}

function lerDeclara(sheet: XLSX.WorkSheet, ref: string): "SIM" | "NÃO" | null {
  const texto = lerTexto(sheet, ref);
  if (texto === "SIM" || texto === "NÃO") return texto;
  return null;
}

export interface ResultadoLeitura {
  declaracao: Declaracao;
  /** false quando a estrutura básica (folha, âncoras) não corresponde ao esperado. */
  estruturaValida: boolean;
}

/**
 * Lê um workbook de declaração de experiência, posicionando-se pelas âncoras
 * fixas descritas em layout.ts. O n.º de blocos e de requisitos vem sempre da
 * configuração (config), nunca do ficheiro — ver PLANO.md princípio 2.
 */
export function lerDeclaracaoExcel(
  nomeFicheiro: string,
  workbook: XLSX.WorkBook,
  config: ConfiguracaoJSON,
): ResultadoLeitura {
  const alertas: Alerta[] = [];
  const sheet = workbook.Sheets[NOME_FOLHA_EXPERIENCIA];

  if (!sheet) {
    alertas.push({
      tipo: "estruturaIncompativel",
      mensagem: `Folha "${NOME_FOLHA_EXPERIENCIA}" não encontrada no ficheiro.`,
    });
    return {
      estruturaValida: false,
      declaracao: {
        ficheiro: nomeFicheiro,
        identificacao: {
          nome: "",
          documento: "",
          entidadeConcorrente: "",
          procedimento: "",
          lote: "",
          perfil: "",
        },
        blocos: [],
        alertas,
      },
    };
  }

  const identificacao: Identificacao = {
    nome: "",
    documento: "",
    entidadeConcorrente: "",
    procedimento: "",
    lote: "",
    perfil: "",
  };
  for (const { linha, campo } of CAMPOS_IDENTIFICACAO) {
    identificacao[campo] = lerTexto(sheet, `B${linha}`);
  }

  const nRequisitos = config.requisitos.length;
  const blocos: Bloco[] = [];

  for (let i = 1; i <= config.nBlocos; i++) {
    const linhaInicial = linhaInicialBloco(i, nRequisitos);

    const cliente = lerTexto(sheet, `B${linhaInicial + OFFSET_CLIENTE_PROJETO}`);
    const projeto = lerTexto(sheet, `E${linhaInicial + OFFSET_CLIENTE_PROJETO}`);
    const funcao = lerTexto(sheet, `B${linhaInicial + OFFSET_FUNCAO}`);
    const linhaDatas = linhaInicial + OFFSET_DATAS_PROJETO;
    const projInicio = lerMesAno(sheet, `B${linhaDatas}`, `C${linhaDatas}`);
    const projFim = lerMesAno(sheet, `E${linhaDatas}`, `F${linhaDatas}`);
    const emCurso = lerSimNao(sheet, `H${linhaDatas}`);

    const linhasRequisito: LinhaRequisito[] = [];
    for (let r = 0; r < nRequisitos; r++) {
      const linhaReq = linhaInicial + OFFSET_PRIMEIRA_LINHA_REQUISITO + r;
      const requisito = config.requisitos[r];
      linhasRequisito.push({
        requisitoId: requisito.id,
        declara: lerDeclara(sheet, `D${linhaReq}`),
        inicio: lerMesAno(sheet, `E${linhaReq}`, `F${linhaReq}`),
        fim: lerMesAno(sheet, `G${linhaReq}`, `H${linhaReq}`),
      });
    }

    blocos.push({
      indice: i,
      cliente,
      projeto,
      funcao,
      projInicio,
      projFim,
      emCurso,
      linhas: linhasRequisito,
    });
  }

  const nomesLidos = blocos[0]?.linhas.map((_, idx) => lerTexto(sheet, `A${
    linhaInicialBloco(1, nRequisitos) + OFFSET_PRIMEIRA_LINHA_REQUISITO + idx
  }`)) ?? [];
  const nomesEsperados = config.requisitos.map((r) => r.designacao);
  const divergem = nomesLidos.length !== nomesEsperados.length ||
    nomesLidos.some((nome, idx) => nome !== nomesEsperados[idx]);
  if (divergem) {
    alertas.push({
      tipo: "requisitosDivergentes",
      mensagem: "As designações dos requisitos no ficheiro não coincidem, por ordem, com as da configuração.",
    });
  }

  return {
    estruturaValida: !divergem,
    declaracao: { ficheiro: nomeFicheiro, identificacao, blocos, alertas },
  };
}

export async function lerWorkbookDeFicheiro(ficheiro: File): Promise<XLSX.WorkBook> {
  const buffer = await ficheiro.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: false });
}
