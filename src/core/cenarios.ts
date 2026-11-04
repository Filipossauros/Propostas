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
// Só se cortam pessoas inteiras: o valor de uma linha é o valor por pessoa ×
// as pessoas que ficam. Os internos não se cortam, só mudam de projeto.

import { gerarId } from "./id";
import type { EntradaVistaGeral, OrcamentoUnidade, ProjetoVistaGeral } from "./vistaGeral";

/** As pessoas que ficam numa linha do orçamento, quando são menos do que as do orçamento. */
export interface CorteDeLinha {
  projeto: string;
  lote: string;
  perfil: string;
  ficam: number;
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

/** As pessoas que ficam numa linha, no cenário. Sem corte, são as do orçamento. */
export function pessoasNoCenario(cenario: Cenario, projeto: ProjetoVistaGeral, entrada: EntradaVistaGeral): number {
  const corte = cenario.cortes.find((c) => eDaLinha(c, projeto, entrada));
  return corte === undefined ? entrada.pessoas : Math.min(corte.ficam, entrada.pessoas);
}

/**
 * Define as pessoas que ficam numa linha.
 *
 * Fica entre zero e as do orçamento — o cenário corta, não acrescenta — e um
 * corte que repõe as pessoas todas deixa de se guardar.
 */
export function comPessoas(
  cenario: Cenario,
  projeto: ProjetoVistaGeral,
  entrada: EntradaVistaGeral,
  ficam: number,
): Cenario {
  const valor = Math.max(0, Math.min(entrada.pessoas, Math.round(Number.isFinite(ficam) ? ficam : entrada.pessoas)));
  const outros = cenario.cortes.filter((c) => !eDaLinha(c, projeto, entrada));
  return {
    ...cenario,
    cortes:
      valor === entrada.pessoas
        ? outros
        : [...outros, { projeto: projeto.nome, lote: entrada.lote, perfil: entrada.perfil, ficam: valor }],
  };
}

/** Corta todas as pessoas externas do projeto. */
export function comProjetoCortado(cenario: Cenario, projeto: ProjetoVistaGeral): Cenario {
  return projeto.entradas.reduce((c, entrada) => comPessoas(c, projeto, entrada, 0), cenario);
}

/** Repõe todas as pessoas externas do projeto. */
export function comProjetoReposto(cenario: Cenario, projeto: ProjetoVistaGeral): Cenario {
  return { ...cenario, cortes: cenario.cortes.filter((c) => c.projeto !== projeto.nome) };
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
          const ficam = pessoasNoCenario(cenario, projeto, entrada);
          const fator = entrada.pessoas === 0 ? 0 : ficam / entrada.pessoas;
          return { ...entrada, pessoas: ficam, totaisPorAno: entrada.totaisPorAno.map((v) => v * fator) };
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
          return [
            { projeto: texto(k.projeto), lote: texto(k.lote), perfil: texto(k.perfil), ficam: Math.round(ficam) },
          ];
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
