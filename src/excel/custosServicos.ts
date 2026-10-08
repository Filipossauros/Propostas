// A folha «Custos - Serviços» do eAvalia, preenchida com os perfis do procedimento.
//
// O modelo traz a folha oculta e com onze blocos «Recurso», um por perfil, de
// cinco linhas cada:
//
//   6  Recurso I                                   (fundido de A a F)
//   7  Tipo | [B7]   Perfil | [D7]   Descrição | [F7]
//   8
//   9  Valor/hora | [B9]   N.º horas | [D9]   Custo total | =B9*D9
//   10
//
// Cada perfil de cada lote ocupa um bloco: o tipo de serviço e a designação
// vêm do Módulo 2, o preço/hora e as horas do Módulo 3. O custo total é a
// fórmula do próprio modelo, e a soma dos blocos dá o valor estimado sem IVA.
//
// Quando há mais perfis do que blocos, a nota do modelo pede que se
// acrescentem linhas: acrescentam-se blocos iguais ao último, com as mesmas
// listas, a mesma formatação condicional e a mesma fórmula.
//
// Como no resto do eAvalia, escreve-se diretamente no XML do modelo, sem o
// reescrever — ver `eavalia.ts`.

import { horasContratadas } from "../core/lotes";
import type { DesignacaoPerfil, LotesJSON, TipoServico } from "../core/types";
import {
  celulaDeNumero,
  celulaDeTexto,
  ErroModeloEavalia,
  escreverCelula,
  FOLHA_CUSTOS_SERVICOS,
  NOME_FOLHA_CUSTOS_SERVICOS,
  textoDaMedida,
} from "./eavaliaModelo";
import { lerFolhaDoEavalia, type FolhaDesenhavel } from "./folhaDoAlinhamento";

/** A linha do primeiro bloco: a do cabeçalho «Recurso I». */
export const PRIMEIRA_LINHA_DOS_RECURSOS = 6;
export const LINHAS_POR_RECURSO = 5;
/** Quantos blocos traz o modelo. */
export const RECURSOS_NO_MODELO = 11;

/** Um bloco «Recurso» da folha, com o que lá se escreve. */
export interface RecursoDeServico {
  tipo: TipoServico | "";
  perfil: DesignacaoPerfil | "";
  /** A designação do perfil no Anexo Técnico — o nome que lhe foi dado no Módulo 2. */
  descricao: string;
  valorHora: number;
  /** Horas de todos os elementos, em todos os anos: n.º de elementos × horas contratadas. */
  horas: number;
}

/**
 * Os recursos do procedimento: um por perfil em cada lote, pela ordem dos lotes.
 *
 * Um perfil colocado em mais do que um lote dá um bloco por lote — os preços e
 * as horas podem não ser os mesmos —, e a descrição diz de que lote é cada um.
 */
export function recursosDoProcedimento(config: LotesJSON): RecursoDeServico[] {
  const plurianual = config.encargosPlurianuais.ativo;
  const lotesPorPerfil = new Map<string, number>();
  for (const lote of config.lotes) {
    for (const entrada of lote.perfis) {
      lotesPorPerfil.set(entrada.perfil.id, (lotesPorPerfil.get(entrada.perfil.id) ?? 0) + 1);
    }
  }

  return config.lotes.flatMap((lote) =>
    lote.perfis.map((entrada) => {
      const nome = entrada.perfil.perfil.trim();
      const repetido = (lotesPorPerfil.get(entrada.perfil.id) ?? 0) > 1;
      return {
        tipo: entrada.perfil.tipoServico ?? "",
        perfil: entrada.perfil.designacao ?? "",
        descricao: repetido ? `${nome} (Lote ${lote.numero})` : nome,
        valorHora: Number.isFinite(entrada.valorHora) ? entrada.valorHora : 0,
        horas: entrada.nMinimoElementos * horasContratadas(entrada, plurianual),
      };
    }),
  );
}

/** I, II, III, … — a numeração dos blocos no modelo. */
export function numeroRomano(n: number): string {
  const valores: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let resto = n;
  let romano = "";
  for (const [valor, letras] of valores) {
    while (resto >= valor) {
      romano += letras;
      resto -= valor;
    }
  }
  return romano;
}

/** A linha do cabeçalho do bloco `indice` (a contar de 0). */
export function linhaDoRecurso(indice: number): number {
  return PRIMEIRA_LINHA_DOS_RECURSOS + indice * LINHAS_POR_RECURSO;
}

// --------------------------------------------------------------------------
// Visibilidade da folha
// --------------------------------------------------------------------------

/** O livro com a folha `nome` visível — o modelo trá-la oculta. */
export function comFolhaVisivel(workbook: string, nome: string = NOME_FOLHA_CUSTOS_SERVICOS): string {
  const folha = new RegExp(`<sheet\\b[^>]*\\bname="${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`).exec(workbook);
  if (folha === null) throw new ErroModeloEavalia(`O modelo eAvalia não tem a folha «${nome}».`);
  return workbook.replace(folha[0], () => folha[0].replace(/\s+state="[^"]*"/, ""));
}

// --------------------------------------------------------------------------
// Blocos a mais
// --------------------------------------------------------------------------

/** Uma referência `B9` (ou `$B$9`) com a linha mudada, se `muda` disser que sim. */
function deslocarRefs(texto: string, desloc: number, muda: (linha: number) => boolean): string {
  return texto.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (inteira, d1: string, coluna: string, d2: string, linha: string) => {
    const n = Number(linha);
    return muda(n) ? `${d1}${coluna}${d2}${n + desloc}` : inteira;
  });
}

/** Uma linha da folha deslocada: o `r` da linha, o de cada célula e as fórmulas. */
function deslocarLinha(row: string, desloc: number, muda: (linha: number) => boolean): string {
  return row
    .replace(/^<row r="(\d+)"/, (_i, n: string) => `<row r="${Number(n) + desloc}"`)
    .replace(/<c r="([A-Z]+)(\d+)"/g, (_i, coluna: string, n: string) => `<c r="${coluna}${Number(n) + desloc}"`)
    .replace(/<f>([^<]*)<\/f>/g, (_i, formula: string) => `<f>${deslocarRefs(formula, desloc, muda)}</f>`);
}

function linhaDeRef(ref: string): number {
  return Number(/\d+/.exec(ref)?.[0] ?? 0);
}

/**
 * A folha com blocos suficientes para `quantos` recursos.
 *
 * Os blocos novos são cópias do último do modelo, postos a seguir a ele; o que
 * vem depois — a nota «acrescentar mais linhas» — desce o necessário. As fusões,
 * a formatação condicional e as listas de escolha acompanham: as do último
 * bloco repetem-se em cada bloco novo, e as de baixo descem.
 */
export function comBlocosSuficientes(xml: string, quantos: number): string {
  const extra = quantos - RECURSOS_NO_MODELO;
  if (extra <= 0) return xml;

  const inicioUltimo = linhaDoRecurso(RECURSOS_NO_MODELO - 1);
  const depoisDoUltimo = inicioUltimo + LINHAS_POR_RECURSO;
  const desloc = extra * LINHAS_POR_RECURSO;
  const noUltimo = (n: number) => n >= inicioUltimo && n < depoisDoUltimo;
  const abaixo = (n: number) => n >= depoisDoUltimo;
  const copias = Array.from({ length: extra }, (_v, j) => (j + 1) * LINHAS_POR_RECURSO);

  // 1. As linhas.
  const dados = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (dados === null) throw new ErroModeloEavalia("A folha dos custos dos serviços não tem dados.");
  const linhas = dados[1].match(/<row\b[^>]*?\/>|<row\b[^>]*>[\s\S]*?<\/row>/g) ?? [];
  const numero = (row: string) => Number(/^<row r="(\d+)"/.exec(row)?.[1] ?? 0);
  const doUltimo = linhas.filter((row) => noUltimo(numero(row)));
  const novasLinhas = [
    ...linhas.filter((row) => numero(row) < depoisDoUltimo),
    ...copias.flatMap((d) => doUltimo.map((row) => deslocarLinha(row, d, noUltimo))),
    ...linhas.filter((row) => abaixo(numero(row))).map((row) => deslocarLinha(row, desloc, abaixo)),
  ];
  let novo = xml.replace(dados[0], () => `<sheetData>${novasLinhas.join("")}</sheetData>`);

  // 2. A dimensão da folha.
  novo = novo.replace(/<dimension ref="([^"]*)"\/>/, (_i, ref: string) => `<dimension ref="${deslocarRefs(ref, desloc, abaixo)}"/>`);

  // 3. As fusões: o cabeçalho de cada bloco novo, e a nota de baixo, que desce.
  novo = novo.replace(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/, (_i, corpo: string) => {
    const fusoes = corpo.match(/<mergeCell ref="[^"]*"\/>/g) ?? [];
    const refDe = (f: string) => /ref="([^"]*)"/.exec(f)![1];
    const todas = [
      ...fusoes.map((f) => `<mergeCell ref="${deslocarRefs(refDe(f), desloc, abaixo)}"/>`),
      ...copias.flatMap((d) =>
        fusoes
          .filter((f) => refDe(f).split(":").every((r) => noUltimo(linhaDeRef(r))))
          .map((f) => `<mergeCell ref="${deslocarRefs(refDe(f), d, noUltimo)}"/>`),
      ),
    ];
    return `<mergeCells count="${todas.length}">${todas.join("")}</mergeCells>`;
  });

  // 4. A formatação condicional: as regras das células do último bloco, uma
  //    vez por bloco novo, cada uma com prioridade própria a seguir às do modelo.
  const formatacoes = novo.match(/<conditionalFormatting\b[^>]*>[\s\S]*?<\/conditionalFormatting>/g) ?? [];
  let prioridade = Math.max(0, ...[...novo.matchAll(/<cfRule\b[^>]*priority="(\d+)"/g)].map((m) => Number(m[1])));
  const sqrefDe = (cf: string) => /sqref="([^"]*)"/.exec(cf)![1];
  const novasFormatacoes = copias.flatMap((d) =>
    formatacoes
      .filter((cf) => sqrefDe(cf).split(/\s+/).every((r) => noUltimo(linhaDeRef(r))))
      .map((cf) =>
        cf
          .replace(/sqref="([^"]*)"/, (_i, refs: string) => `sqref="${deslocarRefs(refs, d, noUltimo)}"`)
          .replace(/<formula>([^<]*)<\/formula>/g, (_i, f: string) => `<formula>${deslocarRefs(f, d, noUltimo)}</formula>`)
          .replace(/priority="\d+"/g, () => `priority="${++prioridade}"`),
      ),
  );
  if (formatacoes.length > 0) {
    const ultima = formatacoes[formatacoes.length - 1];
    const fim = novo.lastIndexOf(ultima) + ultima.length;
    novo = novo.slice(0, fim) + novasFormatacoes.join("") + novo.slice(fim);
  }

  // 5. As listas de escolha — as do próprio XML e as da extensão x14.
  const alargar = (refs: string) => {
    const lista = refs.split(/\s+/).filter((r) => r !== "");
    return [
      ...lista.map((r) => deslocarRefs(r, desloc, abaixo)),
      ...copias.flatMap((d) => lista.filter((r) => noUltimo(linhaDeRef(r))).map((r) => deslocarRefs(r, d, noUltimo))),
    ].join(" ");
  };
  novo = novo
    .replace(/(<dataValidation\b[^>]*\bsqref=")([^"]*)(")/g, (_i, a: string, refs: string, b: string) => `${a}${alargar(refs)}${b}`)
    .replace(/<xm:sqref>([^<]*)<\/xm:sqref>/g, (_i, refs: string) => `<xm:sqref>${alargar(refs)}</xm:sqref>`);

  return novo;
}

// --------------------------------------------------------------------------
// Preenchimento
// --------------------------------------------------------------------------

/** Confirma que a folha é a do modelo esperado, antes de lhe escrever. */
function confirmarModelo(xml: string, cadeias: string[]): void {
  const esperado = (linha: number, inicio: string) => {
    if (!textoDaMedida(xml, linha, cadeias).startsWith(inicio)) {
      throw new ErroModeloEavalia(
        `A linha ${linha} da folha «${NOME_FOLHA_CUSTOS_SERVICOS}» já não é a esperada ("${inicio}…"). ` +
          "O ficheiro-modelo terá sido substituído por outra versão.",
      );
    }
  };
  esperado(1, NOME_FOLHA_CUSTOS_SERVICOS);
  for (let i = 0; i < RECURSOS_NO_MODELO; i++) {
    const linha = linhaDoRecurso(i);
    esperado(linha, "Recurso");
    esperado(linha + 1, "Tipo");
    esperado(linha + 3, "Valor/hora");
  }
}

/** O custo total: a fórmula do modelo, com o resultado já calculado para quem a lê sem recalcular. */
function comCustoTotal(xml: string, ref: string, valor: number): string {
  const celula = new RegExp(`<c r="${ref}"[^>]*>\\s*<f>([^<]*)</f>`).exec(xml);
  if (celula === null) throw new ErroModeloEavalia(`A célula ${ref} do modelo eAvalia já não tem a fórmula do custo total.`);
  const formula = celula[1];
  return escreverCelula(xml, ref, (atributos) => `<c r="${ref}"${atributos}><f>${formula}</f><v>${valor}</v></c>`, true);
}

/**
 * Escreve os recursos na folha.
 *
 * `cadeias` são as cadeias partilhadas do livro, para confirmar o modelo. Os
 * blocos todos — também os que ficam por usar — saem numerados I, II, III…: o
 * modelo repete «Recurso II» no quinto, e a numeração errada passava para a
 * imagem do Word.
 */
export function preencherCustosServicos(xml: string, recursos: RecursoDeServico[], cadeias: string[]): string {
  confirmarModelo(xml, cadeias);
  let folha = comBlocosSuficientes(xml, recursos.length);
  const blocos = Math.max(RECURSOS_NO_MODELO, recursos.length);

  for (let i = 0; i < blocos; i++) {
    const linha = linhaDoRecurso(i);
    folha = escreverCelula(folha, `A${linha}`, (a) => celulaDeTexto(`A${linha}`, a, `Recurso ${numeroRomano(i + 1)}`), true);

    const recurso = recursos[i];
    if (recurso === undefined) continue;
    const texto = (ref: string, valor: string) => {
      if (valor.trim() !== "") folha = escreverCelula(folha, ref, (a) => celulaDeTexto(ref, a, valor));
    };
    const numero = (ref: string, valor: number) => {
      if (valor > 0) folha = escreverCelula(folha, ref, (a) => celulaDeNumero(ref, a, valor));
    };

    texto(`B${linha + 1}`, recurso.tipo);
    texto(`D${linha + 1}`, recurso.perfil);
    texto(`F${linha + 1}`, recurso.descricao);
    numero(`B${linha + 3}`, recurso.valorHora);
    numero(`D${linha + 3}`, recurso.horas);
    if (recurso.valorHora > 0 && recurso.horas > 0) {
      folha = comCustoTotal(folha, `F${linha + 3}`, recurso.valorHora * recurso.horas);
    }
  }
  return folha;
}

// --------------------------------------------------------------------------
// Leitura, para a imagem do Word
// --------------------------------------------------------------------------

/**
 * A folha dos custos de um eAvalia gerado, pronta a desenhar.
 *
 * Só até ao último recurso preenchido: os blocos que sobram no modelo, vazios,
 * e a nota de que se podem acrescentar linhas não dizem nada a quem lê a
 * informação. Cada recurso fica inteiro na mesma página.
 */
export function lerFolhaDosCustos(xlsx: Uint8Array | ArrayBuffer, recursos: number): Promise<FolhaDesenhavel> {
  const blocos = Math.max(1, recursos);
  return lerFolhaDoEavalia(xlsx, FOLHA_CUSTOS_SERVICOS, {
    // A linha dos valores do último bloco; a de baixo é só espaço.
    ateLinha: linhaDoRecurso(blocos - 1) + 3,
    // As linhas contam de 0: o cabeçalho do bloco, na linha `l`, é a `l - 1`.
    juntas: Array.from({ length: blocos }, (_v, i): [number, number] => [linhaDoRecurso(i) - 1, linhaDoRecurso(i) + 2]),
  });
}
