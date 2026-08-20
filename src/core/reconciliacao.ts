// Reconciliação de concorrentes — PLANO.md 7.1, passo 4.
// Variações de escrita do nome da entidade concorrente ("ABC" / "ABC, S.A.")
// partem a agregação por concorrente silenciosamente. Este módulo propõe
// agrupamentos por semelhança; a decisão final é sempre confirmada pelo
// utilizador (princípio 4 — a aplicação sinaliza, não decide).

// Padrões de forma societária a remover, tolerando pontos e espaços entre
// letras (ex.: "S.A.", "S. A.", "SA" devem ser equivalentes).
const PADROES_FORMA_SOCIETARIA = [
  /\bSOCIEDADE\s+AN[OÓ]NIMA\b/g,
  /\bSOCIEDADE\s+UNIPESSOAL\b/g,
  /\bUNIPESSOAL\b/g,
  /\bLIMITADA\b/g,
  /\bLDA\.?\b/g,
  /\bS\.?\s?A\.?\b/g,
  /\bCOOPERATIVA\b/g,
  /\bC\.?R\.?L\.?\b/g,
  /\bA\.?C\.?E\.?\b/g,
];

/** Normaliza um nome de entidade para comparação: maiúsculas, sem acentos, sem pontuação/formas societárias. */
export function normalizarNomeEntidade(nome: string): string {
  const semAcentos = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  let semFormas = semAcentos;
  for (const padrao of PADROES_FORMA_SOCIETARIA) {
    semFormas = semFormas.replace(padrao, " ");
  }

  const semPontuacao = semFormas.replace(/[^A-Z0-9 ]/g, " ");
  const palavras = semPontuacao
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  if (palavras.length > 0) return palavras.join(" ");

  // Nome composto inteiramente por uma forma societária: usar o original sem formas removidas.
  const semPontuacaoOriginal = semAcentos.replace(/[^A-Z0-9 ]/g, " ");
  return semPontuacaoOriginal.split(/\s+/).filter((p) => p !== "").join(" ");
}

export interface GrupoConcorrentes {
  /** Identificador estável do grupo, para uso como chave na interface. */
  id: string;
  /** Nome canónico proposto (o mais longo entre os nomes originais do grupo). */
  nomeCanonico: string;
  /** Nomes originais (tal como aparecem nas declarações) agrupados. */
  nomesOriginais: string[];
}

/** Propõe agrupamentos de nomes de entidade por semelhança normalizada (7.1, passo 4). */
export function proporAgrupamentos(nomes: string[]): GrupoConcorrentes[] {
  const porChave = new Map<string, string[]>();

  for (const nome of nomes) {
    const chave = normalizarNomeEntidade(nome);
    const lista = porChave.get(chave) ?? [];
    if (!lista.includes(nome)) lista.push(nome);
    porChave.set(chave, lista);
  }

  return [...porChave.entries()].map(([chave, nomesOriginais]) => ({
    id: chave,
    nomeCanonico: escolherNomeCanonico(nomesOriginais),
    nomesOriginais,
  }));
}

/** O nome mais completo do grupo; em caso de empate, o primeiro por ordem alfabética. */
export function escolherNomeCanonico(nomes: string[]): string {
  return nomes
    .slice()
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "pt"))[0];
}

/** Mapa nome-original -> nome-canónico, para aplicar a decisão confirmada pelo utilizador. */
export function construirMapaReconciliacao(grupos: GrupoConcorrentes[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const grupo of grupos) {
    for (const nome of grupo.nomesOriginais) {
      mapa.set(nome, grupo.nomeCanonico);
    }
  }
  return mapa;
}
