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
  LotesJSON,
  MesAno,
} from "../core/types";
import type { DeclaracaoAtribuida } from "../core/avaliacaoProcedimento";
import { gerarId } from "../core/id";
import {
  CAMPOS_IDENTIFICACAO,
  LINHA_SUBTITULO,
  NOME_FOLHA_EXPERIENCIA,
  NOME_FOLHA_LEIAME,
  NOME_FOLHA_LISTAS,
  OFFSET_CLIENTE_PROJETO,
  OFFSET_DATAS_PROJETO,
  OFFSET_FUNCAO,
  OFFSET_PRIMEIRA_LINHA_REQUISITO,
  SUFIXO_SUBTITULO_ADICIONAL,
  linhaInicialBloco,
  subtituloAdicional,
} from "./layout";

/** Resultado da leitura combinada de uma célula de mês e uma de ano. */
interface MesAnoLido {
  valor: MesAno | null;
  /**
   * true quando a data não se pode usar: só uma das duas células (mês/ano)
   * preenchida, ou uma delas com casas decimais ou com algo que não é número.
   */
  incompleto: boolean;
  /** true quando uma das células tem casas decimais ou não é número. */
  invalido: boolean;
}

function lerTexto(sheet: XLSX.WorkSheet, ref: string): string {
  const cell = sheet[ref];
  if (!cell || cell.v === undefined || cell.v === null) return "";
  return String(cell.v).trim();
}

/**
 * Um mês ou um ano: só números inteiros. Uma célula com casas decimais (3,5)
 * ou com texto que não é número não é arredondada nem truncada — fica
 * inválida, e a data a que pertence não conta.
 */
function lerInteiro(sheet: XLSX.WorkSheet, ref: string): { valor: number | null; invalido: boolean } {
  const cell = sheet[ref];
  if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === "") {
    return { valor: null, invalido: false };
  }
  const n = typeof cell.v === "number" ? cell.v : Number(String(cell.v).trim().replace(",", "."));
  return Number.isInteger(n) ? { valor: n, invalido: false } : { valor: null, invalido: true };
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
  if (mes.invalido || ano.invalido) return { valor: null, incompleto: true, invalido: true };
  if (mes.valor === null && ano.valor === null) return { valor: null, incompleto: false, invalido: false };
  if (mes.valor === null || ano.valor === null) return { valor: null, incompleto: true, invalido: false };
  return { valor: { mes: mes.valor, ano: ano.valor }, incompleto: false, invalido: false };
}

function lerDeclara(sheet: XLSX.WorkSheet, ref: string): "SIM" | "NÃO" | null {
  const texto = lerTexto(sheet, ref);
  return texto === "SIM" || texto === "NÃO" ? texto : null;
}

function identificacaoVazia(): Identificacao {
  return { nome: "", entidadeConcorrente: "", procedimento: "", lote: "", loteDesignacao: "", perfil: "" };
}

/**
 * Localiza a folha do perfil que se está a analisar.
 *
 * O formulário passou a ter uma folha por perfil, e o nome da folha é a
 * designação truncada aos 31 carateres do Excel — não serve de chave fiável.
 * O subtítulo, esse, traz a designação por inteiro: é por aí que se procura.
 * As alternativas cobrem os ficheiros de perfil único das versões anteriores.
 */
function encontrarFolhaExperiencia(workbook: XLSX.WorkBook, perfil: string): XLSX.WorkSheet | null {
  const candidatas = workbook.SheetNames.filter(
    (nome) => nome !== NOME_FOLHA_LEIAME && nome !== NOME_FOLHA_LISTAS,
  );

  const alvo = perfil.trim();
  for (const nome of candidatas) {
    const sheet = workbook.Sheets[nome];
    if (sheet && lerTexto(sheet, `A${LINHA_SUBTITULO}`) === alvo) return sheet;
  }

  if (workbook.Sheets[NOME_FOLHA_EXPERIENCIA]) return workbook.Sheets[NOME_FOLHA_EXPERIENCIA];
  if (candidatas.length === 1) return workbook.Sheets[candidatas[0]] ?? null;
  return null;
}

/** A folha de experiência adicional do perfil, se o ficheiro a tiver. */
function encontrarFolhaAdicional(workbook: XLSX.WorkBook, perfil: string): XLSX.WorkSheet | null {
  const alvo = subtituloAdicional(perfil.trim());
  for (const nome of workbook.SheetNames) {
    const sheet = workbook.Sheets[nome];
    if (sheet && lerTexto(sheet, `A${LINHA_SUBTITULO}`) === alvo) return sheet;
  }
  return null;
}

/**
 * Os blocos de projeto de uma folha, numerados a partir de `primeiroIndice`.
 * As datas com casas decimais ou que não são números ficam assinaladas.
 */
function lerBlocos(
  sheet: XLSX.WorkSheet,
  config: ConfiguracaoAvaliacao,
  primeiroIndice: number,
  folha: "principal" | "adicional",
  alertas: Alerta[],
): Bloco[] {
  const nRequisitos = config.requisitos.length;
  const blocos: Bloco[] = [];

  for (let i = 1; i <= config.nBlocos; i++) {
    const indice = primeiroIndice + i - 1;
    const linhaInicial = linhaInicialBloco(i, nRequisitos);
    const linhaDatas = linhaInicial + OFFSET_DATAS_PROJETO;
    let datasInvalidas = false;

    const linhasRequisito: LinhaRequisito[] = config.requisitos.map((requisito, r) => {
      const linhaReq = linhaInicial + OFFSET_PRIMEIRA_LINHA_REQUISITO + r;
      const inicio = lerMesAno(sheet, `E${linhaReq}`, `F${linhaReq}`);
      const fim = lerMesAno(sheet, `G${linhaReq}`, `H${linhaReq}`);
      datasInvalidas ||= inicio.invalido || fim.invalido;
      return {
        requisitoId: requisito.id,
        declara: lerDeclara(sheet, `D${linhaReq}`),
        inicio: inicio.valor,
        fim: fim.valor,
        inicioIncompleto: inicio.incompleto,
        fimIncompleto: fim.incompleto,
      };
    });

    const projInicio = lerMesAno(sheet, `B${linhaDatas}`, `C${linhaDatas}`);
    const projFim = lerMesAno(sheet, `E${linhaDatas}`, `F${linhaDatas}`);
    datasInvalidas ||= projInicio.invalido || projFim.invalido;
    if (datasInvalidas) {
      alertas.push({
        tipo: "dataInvalida",
        mensagem:
          `Bloco ${indice}: mês ou ano com casas decimais, ou que não é número — essa data não é considerada ` +
          `(trata-se como incompleta).`,
        blocoIndice: indice,
      });
    }

    blocos.push({
      indice,
      cliente: lerTexto(sheet, `B${linhaInicial + OFFSET_CLIENTE_PROJETO}`),
      projeto: lerTexto(sheet, `E${linhaInicial + OFFSET_CLIENTE_PROJETO}`),
      funcao: lerTexto(sheet, `B${linhaInicial + OFFSET_FUNCAO}`),
      projInicio: projInicio.valor,
      projFim: projFim.valor,
      linhas: linhasRequisito,
      folha,
    });
  }
  return blocos;
}

/** Se as designações dos requisitos do primeiro bloco da folha não coincidem, por ordem, com as da configuração. */
function requisitosDivergem(sheet: XLSX.WorkSheet, config: ConfiguracaoAvaliacao): boolean {
  const primeiraLinha = linhaInicialBloco(1, config.requisitos.length) + OFFSET_PRIMEIRA_LINHA_REQUISITO;
  return config.requisitos.some((requisito, idx) => lerTexto(sheet, `A${primeiraLinha + idx}`) !== requisito.designacao);
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
  const sheet = encontrarFolhaExperiencia(workbook, config.perfil);

  if (!sheet) {
    alertas.push({
      tipo: "estruturaIncompativel",
      mensagem: `Não foi encontrada no ficheiro a folha do perfil "${config.perfil}".`,
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

  const blocos = lerBlocos(sheet, config, 1, "principal", alertas);

  // A folha de experiência adicional continua a numeração (projetos 16 a 30,
  // com 15 por folha). Os ficheiros que não a tenham são lidos como antes.
  const adicional = encontrarFolhaAdicional(workbook, config.perfil);
  if (adicional) blocos.push(...lerBlocos(adicional, config, config.nBlocos + 1, "adicional", alertas));

  // As designações do primeiro bloco identificam a estrutura do ficheiro: se não
  // coincidirem, por ordem, com as da configuração, as âncoras não são de confiança.
  const divergem = requisitosDivergem(sheet, config) || (adicional !== null && requisitosDivergem(adicional, config));
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

/**
 * Uma folha só conta como declaração entregue se tiver alguma coisa escrita.
 *
 * O ficheiro de um lote traz uma folha por perfil, e o candidato preenche
 * apenas a sua: as restantes vêm em branco e não devem contar como propostas
 * por analisar.
 */
function temConteudo(declaracao: Declaracao): boolean {
  const { nome, entidadeConcorrente, procedimento } = declaracao.identificacao;
  if (nome.trim() !== "" || entidadeConcorrente.trim() !== "" || procedimento.trim() !== "") return true;

  return declaracao.blocos.some(
    (b) =>
      b.cliente.trim() !== "" ||
      b.projeto.trim() !== "" ||
      b.funcao.trim() !== "" ||
      b.projInicio !== null ||
      b.projFim !== null ||
      b.linhas.some((l) => l.declara !== null || l.inicio !== null || l.fim !== null),
  );
}

/**
 * Lê todas as folhas preenchidas de um workbook e encaminha cada uma para o
 * par (lote, perfil) a que respeita.
 *
 * O encaminhamento faz-se pela designação do perfil, que está no subtítulo da
 * folha, e pelo número do lote, que vem pré-preenchido na identificação. Sem
 * isto, o júri teria de dizer à mão a que lote e perfil pertence cada um dos
 * ficheiros recebidos.
 */
export function lerDeclaracoesDoWorkbook(
  nomeFicheiro: string,
  workbook: XLSX.WorkBook,
  config: LotesJSON,
): DeclaracaoAtribuida[] {
  const atribuidas: DeclaracaoAtribuida[] = [];

  for (const nomeFolha of workbook.SheetNames) {
    if (nomeFolha === NOME_FOLHA_LEIAME || nomeFolha === NOME_FOLHA_LISTAS) continue;

    const sheet = workbook.Sheets[nomeFolha];
    if (!sheet) continue;

    const perfilDaFolha = lerTexto(sheet, `A${LINHA_SUBTITULO}`);
    // A folha adicional lê-se com a principal do mesmo perfil.
    if (perfilDaFolha.endsWith(SUFIXO_SUBTITULO_ADICIONAL)) continue;
    const numeroLote = lerTexto(sheet, `B${CAMPOS_IDENTIFICACAO.find((c) => c.campo === "lote")!.linha}`);

    const candidatos = config.lotes.flatMap((lote) =>
      lote.perfis
        .filter((entrada) => entrada.perfil.perfil.trim() === perfilDaFolha)
        .map((entrada) => ({ lote, entrada })),
    );
    // Com o mesmo perfil em vários lotes, o número do lote desempata.
    const escolhido =
      candidatos.find(({ lote }) => lote.numero.trim() === numeroLote) ??
      (candidatos.length === 1 ? candidatos[0] : undefined);

    if (escolhido === undefined) continue;

    const { declaracao } = lerDeclaracaoExcel(nomeFicheiro, workbook, {
      perfil: escolhido.entrada.perfil.perfil,
      nBlocos: config.nBlocos,
      requisitos: escolhido.entrada.perfil.requisitos,
      nMinimoElementos: escolhido.entrada.nMinimoElementos,
    });

    if (!temConteudo(declaracao)) continue;
    atribuidas.push({ declaracao, loteId: escolhido.lote.id, perfilEmLoteId: escolhido.entrada.id });
  }

  return atribuidas;
}
