// Leitura de uma declaração de experiência em Excel para o modelo interno.
// Extração estrutural pura — a validação semântica (campos obrigatórios, datas
// incoerentes, períodos fora do projeto) vive em src/core/validar.ts, que
// combina isto com o núcleo de cálculo (Regra A).

import * as XLSX from "xlsx";
import type {
  Alerta,
  Bloco,
  ConfiguracaoAvaliacao,
  Declaracao,
  Identificacao,
  LinhaRequisito,
  MesAno,
} from "../core/types";
import { gerarId } from "../core/id";
import {
  CAMPOS_IDENTIFICACAO,
  NOME_FOLHA_EXPERIENCIA,
  OFFSET_CLIENTE_PROJETO,
  OFFSET_DATAS_PROJETO,
  OFFSET_FUNCAO,
  OFFSET_PRIMEIRA_LINHA_REQUISITO,
  linhaInicialBloco,
} from "./layout";

/** Resultado da leitura combinada de uma célula de mês e uma de ano. */
interface MesAnoLido {
  valor: MesAno | null;
  /** true quando exatamente uma das duas células (mês/ano) está preenchida. */
  incompleto: boolean;
}

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

/**
 * Combina uma célula de mês e uma de ano. Distingue três casos: ambas em
 * branco (a data é omitida — herda o período do projeto, ou fica por
 * preencher, consoante o contexto), ambas preenchidas (data válida), e só
 * uma preenchida (preenchimento incompleto — a Regra A anula essa experiência).
 */
function lerMesAno(sheet: XLSX.WorkSheet, refMes: string, refAno: string): MesAnoLido {
  const mes = lerInteiro(sheet, refMes);
  const ano = lerInteiro(sheet, refAno);
  if (mes === null && ano === null) return { valor: null, incompleto: false };
  if (mes === null || ano === null) return { valor: null, incompleto: true };
  return { valor: { mes, ano }, incompleto: false };
}

function lerDeclara(sheet: XLSX.WorkSheet, ref: string): "SIM" | "NÃO" | null {
  const texto = lerTexto(sheet, ref);
  return texto === "SIM" || texto === "NÃO" ? texto : null;
}

function identificacaoVazia(): Identificacao {
  return { nome: "", entidadeConcorrente: "", procedimento: "", lote: "", perfil: "" };
}

export interface ResultadoLeitura {
  declaracao: Declaracao;
  /** false quando a estrutura básica (folha, âncoras, requisitos) não corresponde ao esperado. */
  estruturaValida: boolean;
}

/**
 * Lê um workbook de declaração de experiência, posicionando-se pelas âncoras
 * fixas descritas em layout.ts. O n.º de blocos e de requisitos vem sempre da
 * configuração, nunca do ficheiro — salvaguarda contra adulteração.
 */
export function lerDeclaracaoExcel(
  nomeFicheiro: string,
  workbook: XLSX.WorkBook,
  config: ConfiguracaoAvaliacao,
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
        id: gerarId(),
        ficheiro: nomeFicheiro,
        identificacao: identificacaoVazia(),
        blocos: [],
        alertas,
      },
    };
  }

  const identificacao = identificacaoVazia();
  for (const { linha, campo } of CAMPOS_IDENTIFICACAO) {
    identificacao[campo] = lerTexto(sheet, `B${linha}`);
  }

  const nRequisitos = config.requisitos.length;
  const blocos: Bloco[] = [];

  for (let i = 1; i <= config.nBlocos; i++) {
    const linhaInicial = linhaInicialBloco(i, nRequisitos);
    const linhaDatas = linhaInicial + OFFSET_DATAS_PROJETO;

    const linhasRequisito: LinhaRequisito[] = config.requisitos.map((requisito, r) => {
      const linhaReq = linhaInicial + OFFSET_PRIMEIRA_LINHA_REQUISITO + r;
      const inicio = lerMesAno(sheet, `E${linhaReq}`, `F${linhaReq}`);
      const fim = lerMesAno(sheet, `G${linhaReq}`, `H${linhaReq}`);
      return {
        requisitoId: requisito.id,
        declara: lerDeclara(sheet, `D${linhaReq}`),
        inicio: inicio.valor,
        fim: fim.valor,
        inicioIncompleto: inicio.incompleto,
        fimIncompleto: fim.incompleto,
      };
    });

    blocos.push({
      indice: i,
      cliente: lerTexto(sheet, `B${linhaInicial + OFFSET_CLIENTE_PROJETO}`),
      projeto: lerTexto(sheet, `E${linhaInicial + OFFSET_CLIENTE_PROJETO}`),
      funcao: lerTexto(sheet, `B${linhaInicial + OFFSET_FUNCAO}`),
      projInicio: lerMesAno(sheet, `B${linhaDatas}`, `C${linhaDatas}`).valor,
      projFim: lerMesAno(sheet, `E${linhaDatas}`, `F${linhaDatas}`).valor,
      linhas: linhasRequisito,
    });
  }

  // As designações do primeiro bloco identificam a estrutura do ficheiro: se não
  // coincidirem, por ordem, com as da configuração, as âncoras não são de confiança.
  const primeiraLinhaRequisitos = linhaInicialBloco(1, nRequisitos) + OFFSET_PRIMEIRA_LINHA_REQUISITO;
  const divergem = config.requisitos.some(
    (requisito, idx) => lerTexto(sheet, `A${primeiraLinhaRequisitos + idx}`) !== requisito.designacao,
  );
  if (divergem) {
    alertas.push({
      tipo: "requisitosDivergentes",
      mensagem:
        "As designações dos requisitos no ficheiro não coincidem, por ordem, com as da configuração carregada. " +
        "Confirme que se trata do formulário deste perfil.",
    });
  }

  return {
    estruturaValida: !divergem,
    declaracao: { id: gerarId(), ficheiro: nomeFicheiro, identificacao, blocos, alertas },
  };
}

export async function lerWorkbookDeFicheiro(ficheiro: File): Promise<XLSX.WorkBook> {
  const buffer = await ficheiro.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: false });
}
