// Cenários de corte do orçamento da unidade.
//
// Um cenário é uma variação do orçamento: as mesmas linhas, com menos pessoas
// em algumas delas, e os elementos internos eventualmente noutros projetos. O
// orçamento não se toca — o cenário guarda só o que muda, e os valores vêm
// sempre do orçamento, pelo que reimportar um projeto corrigido corrige também
// todos os cenários.
//
// O que muda guarda-se pelos nomes que se veem (projeto, lote, perfil) e não
// pelos identificadores internos das linhas: esses mudam a cada importação de
// um agrupamento, e um corte preso a eles perdia-se ao reimportar o projeto.
// Os internos não se importam — são registados na própria vista —, e o seu
// identificador é estável; o destino de um interno movido é o nome do projeto.
//
// Num perfil cortam-se pessoas inteiras e horas (por elemento, ano a ano, em
// passos de 8), e o valor hora pode mudar: o valor de cada ano é o do orçamento
// × as pessoas que ficam / as do orçamento × o valor hora do cenário / o do
// orçamento × as horas do ano no cenário / as do orçamento. Numa licença
// corta-se a quantidade (nas de preço unitário) ou retira-se a linha. Os
// internos não se cortam, só mudam de projeto.

import { gerarId } from "./id";
import { ANOS_PLURIANUAIS } from "./types";
import type { EntradaVistaGeral, OrcamentoUnidade, ProjetoVistaGeral } from "./vistaGeral";

/** O passo do corte de horas: um dia de trabalho. */
export const PASSO_HORAS = 8;

/**
 * O que muda numa linha do orçamento: as pessoas que ficam e, se foram
 * alterados, o valor hora sem IVA, as horas de cada ano, a quantidade ou a
 * retirada (numa licença).
 */
export interface CorteDeLinha {
  projeto: string;
  lote: string;
  perfil: string;
  ficam: number;
  /** Valor hora sem IVA no cenário; sem ele, é o do orçamento. */
  valorHoraSemIva?: number;
  /** As horas de cada ano, por elemento, no cenário; sem elas, as do orçamento. */
  horasPorAno?: number[];
  /** Numa licença de preço unitário: a quantidade no cenário. */
  quantidade?: number;
  /** Numa licença: retirada do cenário. */
  retirada?: boolean;
}

/** Um elemento interno que, no cenário, passa para outro projeto. */
export interface MovimentoDeInterno {
  internoId: string;
  /** Nome do projeto de destino. */
  paraProjeto: string;
}

export interface Cenario {
  id: string;
  nome: string;
  cortes: CorteDeLinha[];
  movimentos: MovimentoDeInterno[];
}

export function novoCenario(nome: string): Cenario {
  return { id: gerarId(), nome: nome.trim() || "Cenário", cortes: [], movimentos: [] };
}

/** Um nome que ainda não esteja em uso: «Cenário 1», «Cenário 2», … */
export function nomeLivre(cenarios: Cenario[], base = "Cenário"): string {
  const usados = new Set(cenarios.map((c) => c.nome));
  for (let i = 1; ; i++) {
    const nome = `${base} ${i}`;
    if (!usados.has(nome)) return nome;
  }
}

export function duplicarCenario(cenario: Cenario, nome: string): Cenario {
  return { ...structuredClone(cenario), id: gerarId(), nome };
}

function eDaLinha(corte: CorteDeLinha, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): boolean {
  return corte.projeto === projeto.nome && corte.lote === entrada.lote && corte.perfil === entrada.perfil;
}

function corteDaLinha(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): CorteDeLinha | undefined {
  return cenario.cortes.find((c) => eDaLinha(c, projeto, entrada));
}

/**
 * As horas de cada ano, por elemento, de uma linha do orçamento. Os orçamentos
 * anteriores não as guardavam: tiram-se do valor (pessoas × horas × valor hora).
 */
export function horasDaEntrada(entrada: EntradaVistaGeral): number[] {
  if (entrada.horasPorAno !== undefined)
    return Array.from({ length: ANOS_PLURIANUAIS }, (_v, i) => entrada.horasPorAno?.[i] ?? 0);
  const base = entrada.pessoas * entrada.valorHoraComIva;
  return Array.from({ length: ANOS_PLURIANUAIS }, (_v, i) =>
    base > 0 ? Math.round(((entrada.totaisPorAno[i] ?? 0) / base) * 100) / 100 : 0,
  );
}

/** As pessoas que ficam numa linha, no cenário. Sem corte, são as do orçamento. */
export function pessoasNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): number {
  const corte = corteDaLinha(cenario, projeto, entrada);
  return corte === undefined ? entrada.pessoas : Math.min(corte.ficam, entrada.pessoas);
}

/** O valor hora sem IVA de uma linha, no cenário. Sem alteração, é o do orçamento. */
export function valorHoraNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): number {
  return corteDaLinha(cenario, projeto, entrada)?.valorHoraSemIva ?? entrada.valorHoraSemIva;
}

/** As horas de cada ano, por elemento, no cenário — nunca acima das do orçamento. */
export function horasNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): number[] {
  const orcamento = horasDaEntrada(entrada);
  const cortadas = corteDaLinha(cenario, projeto, entrada)?.horasPorAno;
  return orcamento.map((h, i) => (cortadas?.[i] === undefined ? h : Math.max(0, Math.min(h, cortadas[i]))));
}

/** A quantidade de uma licença no cenário — nunca acima da do orçamento. */
export function quantidadeNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): number {
  const original = entrada.quantidade ?? 0;
  const q = corteDaLinha(cenario, projeto, entrada)?.quantidade;
  return q === undefined ? original : Math.max(0, Math.min(original, q));
}

/** Se a licença foi retirada do cenário. */
export function retiradaNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): boolean {
  return corteDaLinha(cenario, projeto, entrada)?.retirada === true;
}

interface EstadoDaLinha {
  ficam: number;
  valorHoraSemIva: number;
  horasPorAno: number[];
  quantidade: number;
  retirada: boolean;
}

function estadoNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): EstadoDaLinha {
  return {
    ficam: pessoasNoCenario(cenario, projeto, entrada),
    valorHoraSemIva: valorHoraNoCenario(cenario, projeto, entrada),
    horasPorAno: horasNoCenario(cenario, projeto, entrada),
    quantidade: quantidadeNoCenario(cenario, projeto, entrada),
    retirada: retiradaNoCenario(cenario, projeto, entrada),
  };
}

/**
 * Guarda o que muda numa linha. Só fica o que difere do orçamento; uma linha
 * que volte a ser igual à do orçamento deixa de se guardar.
 */
function comEstado(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  alteracao: Partial<EstadoDaLinha>,
): Cenario {
  const e = { ...estadoNoCenario(cenario, projeto, entrada), ...alteracao };
  const outros = cenario.cortes.filter((c) => !eDaLinha(c, projeto, entrada));
  const horasOrcamento = horasDaEntrada(entrada);
  const mesmoValor = Math.abs(e.valorHoraSemIva - entrada.valorHoraSemIva) < 0.005;
  const mesmasHoras = e.horasPorAno.every((h, i) => Math.abs(h - horasOrcamento[i]) < 0.005);
  const mesmaQuantidade = e.quantidade === (entrada.quantidade ?? 0);
  if (e.ficam === entrada.pessoas && mesmoValor && mesmasHoras && mesmaQuantidade && !e.retirada)
    return { ...cenario, cortes: outros };
  const linha: CorteDeLinha = { projeto: projeto.nome, lote: entrada.lote, perfil: entrada.perfil, ficam: e.ficam };
  if (!mesmoValor) linha.valorHoraSemIva = e.valorHoraSemIva;
  if (!mesmasHoras) linha.horasPorAno = e.horasPorAno;
  if (!mesmaQuantidade) linha.quantidade = e.quantidade;
  if (e.retirada) linha.retirada = true;
  return { ...cenario, cortes: [...outros, linha] };
}

/**
 * Define as pessoas que ficam numa linha, sem mexer no resto.
 *
 * Fica entre zero e as do orçamento — o cenário corta, não acrescenta.
 */
export function comPessoas(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  ficam: number,
): Cenario {
  const valor = Math.max(0, Math.min(entrada.pessoas, Math.round(Number.isFinite(ficam) ? ficam : entrada.pessoas)));
  return comEstado(cenario, projeto, entrada, { ficam: valor });
}

/**
 * Define o valor hora sem IVA de uma linha, sem mexer no resto. Fica em
 * cêntimos e nunca negativo; um valor que não é número repõe o do orçamento.
 */
export function comValorHora(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  valorHoraSemIva: number,
): Cenario {
  const valor = Number.isFinite(valorHoraSemIva)
    ? Math.max(0, Math.round(valorHoraSemIva * 100) / 100)
    : entrada.valorHoraSemIva;
  return comEstado(cenario, projeto, entrada, { valorHoraSemIva: valor });
}

/**
 * Define as horas de um ano (por elemento): arredondadas ao passo de 8 h,
 * entre zero e as do orçamento. Um valor que não é número repõe as do orçamento.
 */
export function comHorasNoAno(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  indiceAno: number,
  horas: number,
): Cenario {
  const orcamento = horasDaEntrada(entrada);
  if (indiceAno < 0 || indiceAno >= orcamento.length) return cenario;
  const maximo = orcamento[indiceAno];
  const arredondadas = Number.isFinite(horas) ? Math.round(horas / PASSO_HORAS) * PASSO_HORAS : maximo;
  const novas = horasNoCenario(cenario, projeto, entrada);
  novas[indiceAno] = Math.max(0, Math.min(maximo, arredondadas));
  return comEstado(cenario, projeto, entrada, { horasPorAno: novas });
}

/** Tira ou repõe 8 h num ano (por elemento), dentro dos limites. */
export function comPassoDeHoras(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  indiceAno: number,
  sentido: -1 | 1,
): Cenario {
  const atual = horasNoCenario(cenario, projeto, entrada)[indiceAno] ?? 0;
  const maximo = horasDaEntrada(entrada)[indiceAno] ?? 0;
  // A partir de um valor fora do passo (1 685 h), o primeiro passo acerta-o.
  const alvo =
    sentido < 0
      ? Math.ceil(atual / PASSO_HORAS) * PASSO_HORAS - PASSO_HORAS
      : Math.floor(atual / PASSO_HORAS) * PASSO_HORAS + PASSO_HORAS;
  const novas = horasNoCenario(cenario, projeto, entrada);
  novas[indiceAno] = Math.max(0, Math.min(maximo, alvo));
  return comEstado(cenario, projeto, entrada, { horasPorAno: novas });
}

/** Define a quantidade de uma licença de preço unitário: inteira, entre zero e a do orçamento. */
export function comQuantidade(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  quantidade: number,
): Cenario {
  const original = entrada.quantidade ?? 0;
  const q = Number.isFinite(quantidade) ? Math.max(0, Math.min(original, Math.round(quantidade))) : original;
  return comEstado(cenario, projeto, entrada, { quantidade: q });
}

/** Retira (ou repõe) uma licença do cenário. */
export function comRetirada(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  retirada: boolean,
): Cenario {
  return comEstado(cenario, projeto, entrada, { retirada });
}

/** Corta todas as pessoas externas do projeto, e retira as suas licenças. */
export function comProjetoCortado(cenario: Cenario, projeto: ProjetoVistaGeral): Cenario {
  return projeto.entradas.reduce(
    (c, entrada) => (entrada.tipo === "licenca" ? comRetirada(c, projeto, entrada, true) : comPessoas(c, projeto, entrada, 0)),
    cenario,
  );
}

/** Repõe as pessoas e as licenças do projeto; os valores hora, as horas e as quantidades alterados ficam. */
export function comProjetoReposto(cenario: Cenario, projeto: ProjetoVistaGeral): Cenario {
  return projeto.entradas.reduce(
    (c, entrada) =>
      entrada.tipo === "licenca"
        ? comRetirada(c, projeto, entrada, false)
        : comPessoas(c, projeto, entrada, entrada.pessoas),
    cenario,
  );
}

/** Se a linha está, no cenário, diferente do orçamento. */
export function linhaAlterada(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): boolean {
  return corteDaLinha(cenario, projeto, entrada) !== undefined;
}

/** Se o projeto ficou, no cenário, sem nada (sem pessoas externas e sem licenças). */
export function projetoTodoCortado(cenario: Cenario, projeto: ProjetoVistaGeral): boolean {
  return projeto.entradas.every((e) =>
    e.tipo === "licenca" ? retiradaNoCenario(cenario, projeto, e) : pessoasNoCenario(cenario, projeto, e) === 0,
  );
}

/** O projeto em que um interno fica no cenário: o de destino, se o moveram, ou o seu. */
export function projetoDoInterno(cenario: Cenario, internoId: string, origem: string): string {
  return cenario.movimentos.find((m) => m.internoId === internoId)?.paraProjeto ?? origem;
}

/** Move um interno para outro projeto; devolvê-lo ao projeto de origem desfaz o movimento. */
export function comInternoMovido(cenario: Cenario, internoId: string, origem: string, destino: string): Cenario {
  const outros = cenario.movimentos.filter((m) => m.internoId !== internoId);
  return {
    ...cenario,
    movimentos: destino === origem ? outros : [...outros, { internoId, paraProjeto: destino }],
  };
}

/**
 * O orçamento tal como fica no cenário.
 *
 * Devolve outro orçamento, e não uma lista de diferenças: o resumo, a tabela,
 * os totais e o Excel leem todos do mesmo sítio, e é isso que garante que
 * mostram o mesmo cenário sem cada um repetir a regra. O resultado não leva
 * cenários — é um retrato, e voltar a aplicar-lhe os cortes cortaria duas vezes.
 *
 * Com `semLinhasCortadas`, as linhas que ficam sem ninguém desaparecem: é o que
 * a vista da direção quer, para um perfil cortado não contar nas rates.
 */
export function aplicarCenario(
  orcamento: OrcamentoUnidade,
  cenario: Cenario,
  opcoes: { semLinhasCortadas?: boolean } = {},
): OrcamentoUnidade {
  const nomes = new Set(orcamento.projetos.map((p) => p.nome));
  const destinoDe = (internoId: string, origem: string) => {
    const destino = projetoDoInterno(cenario, internoId, origem);
    return nomes.has(destino) ? destino : origem;
  };

  const todosOsInternos = orcamento.projetos.flatMap((p) => p.internos.map((i) => ({ interno: i, origem: p.nome })));

  return {
    ...orcamento,
    cenarios: [],
    projetos: orcamento.projetos.map((projeto) => ({
      ...projeto,
      entradas: projeto.entradas
        .map((entrada) => {
          if (entrada.tipo === "licenca") {
            // Uma licença não tem pessoas: o valor acompanha a quantidade, ou sai.
            const retirada = retiradaNoCenario(cenario, projeto, entrada);
            const original = entrada.quantidade ?? 0;
            const quantidade = quantidadeNoCenario(cenario, projeto, entrada);
            const fator = retirada ? 0 : original > 0 ? quantidade / original : 1;
            return { ...entrada, quantidade, totaisPorAno: entrada.totaisPorAno.map((v) => v * fator) };
          }
          const ficam = pessoasNoCenario(cenario, projeto, entrada);
          const valorHora = valorHoraNoCenario(cenario, projeto, entrada);
          const horasOrcamento = horasDaEntrada(entrada);
          const horas = horasNoCenario(cenario, projeto, entrada);
          // O IVA da linha é o do orçamento: muda o valor, não a taxa.
          const iva = entrada.valorHoraSemIva === 0 ? 1 : entrada.valorHoraComIva / entrada.valorHoraSemIva;
          const fatorPessoas = entrada.pessoas === 0 ? 0 : ficam / entrada.pessoas;
          const fatorValor = entrada.valorHoraSemIva === 0 ? 1 : valorHora / entrada.valorHoraSemIva;
          return {
            ...entrada,
            pessoas: ficam,
            valorHoraSemIva: valorHora,
            valorHoraComIva: Math.round(valorHora * iva * 100) / 100,
            horasPorAno: horas,
            totaisPorAno: entrada.totaisPorAno.map((v, i) => {
              const fatorHoras = horasOrcamento[i] > 0 ? horas[i] / horasOrcamento[i] : 1;
              return v * fatorPessoas * fatorValor * fatorHoras;
            }),
          };
        })
        .filter((entrada) => !opcoes.semLinhasCortadas || entrada.pessoas > 0),
      // Primeiro os que já eram do projeto, depois os que chegam de outros.
      internos: [
        ...projeto.internos.filter((interno) => destinoDe(interno.id, projeto.nome) === projeto.nome),
        ...todosOsInternos
          .filter(({ interno, origem }) => origem !== projeto.nome && destinoDe(interno.id, origem) === projeto.nome)
          .map(({ interno }) => interno),
      ],
    })),
  };
}

/**
 * Quantos cortes e movimentos já não encontram onde se aplicar — uma linha
 * que deixou de existir, um interno apagado, um projeto de destino retirado.
 * Não se aplicam; a vista avisa, para quem olha saber que o cenário mudou.
 */
export function alteracoesSemEfeito(orcamento: OrcamentoUnidade, cenario: Cenario): number {
  const nomes = new Set(orcamento.projetos.map((p) => p.nome));
  const internos = new Set(orcamento.projetos.flatMap((p) => p.internos.map((i) => i.id)));
  const cortes = cenario.cortes.filter(
    (c) => !orcamento.projetos.some((p) => p.entradas.some((e) => eDaLinha(c, p, e))),
  ).length;
  const movimentos = cenario.movimentos.filter((m) => !internos.has(m.internoId) || !nomes.has(m.paraProjeto)).length;
  return cortes + movimentos;
}

/** Retira do cenário o que já não se aplica. */
export function semAlteracoesSemEfeito(orcamento: OrcamentoUnidade, cenario: Cenario): Cenario {
  const nomes = new Set(orcamento.projetos.map((p) => p.nome));
  const internos = new Set(orcamento.projetos.flatMap((p) => p.internos.map((i) => i.id)));
  return {
    ...cenario,
    cortes: cenario.cortes.filter((c) => orcamento.projetos.some((p) => p.entradas.some((e) => eDaLinha(c, p, e)))),
    movimentos: cenario.movimentos.filter((m) => internos.has(m.internoId) && nomes.has(m.paraProjeto)),
  };
}

// --------------------------------------------------------------------------
// (Des)serialização
// --------------------------------------------------------------------------

export function normalizarCenarios(bruto: unknown): Cenario[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((c) => {
    if (typeof c !== "object" || c === null) return [];
    const r = c as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" ? v : "");
    return [
      {
        id: texto(r.id) || gerarId(),
        nome: texto(r.nome).trim() || "Cenário",
        cortes: (Array.isArray(r.cortes) ? r.cortes : []).flatMap((x) => {
          if (typeof x !== "object" || x === null) return [];
          const k = x as Record<string, unknown>;
          const ficam = Number(k.ficam);
          if (!Number.isFinite(ficam) || ficam < 0) return [];
          const linha: CorteDeLinha = {
            projeto: texto(k.projeto),
            lote: texto(k.lote),
            perfil: texto(k.perfil),
            ficam: Math.round(ficam),
          };
          const valorHora = Number(k.valorHoraSemIva);
          if (k.valorHoraSemIva !== undefined && Number.isFinite(valorHora) && valorHora >= 0) {
            linha.valorHoraSemIva = valorHora;
          }
          if (Array.isArray(k.horasPorAno)) {
            linha.horasPorAno = k.horasPorAno.map((h) => {
              const n = Number(h);
              return Number.isFinite(n) && n >= 0 ? n : 0;
            });
          }
          const quantidade = Number(k.quantidade);
          if (k.quantidade !== undefined && Number.isFinite(quantidade) && quantidade >= 0) {
            linha.quantidade = Math.round(quantidade);
          }
          if (k.retirada === true) linha.retirada = true;
          return [linha];
        }),
        movimentos: (Array.isArray(r.movimentos) ? r.movimentos : []).flatMap((x) => {
          if (typeof x !== "object" || x === null) return [];
          const m = x as Record<string, unknown>;
          return texto(m.internoId) && texto(m.paraProjeto)
            ? [{ internoId: texto(m.internoId), paraProjeto: texto(m.paraProjeto) }]
            : [];
        }),
      },
    ];
  });
}
