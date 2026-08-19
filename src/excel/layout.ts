// Âncoras e geometria da folha "Experiência" — PLANO.md secção 5.2.
// Módulo partilhado entre o gerador (Módulo 1) e o leitor (Módulo 2): a mesma
// fonte de verdade evita que gerador e leitor divirjam sobre a estrutura.

export const NOME_FOLHA_LEIAME = "Leia-me";
export const NOME_FOLHA_LISTAS = "Listas";
export const NOME_FOLHA_EXPERIENCIA = "Experiência";

export const LINHA_TITULO = 1;
export const LINHA_SUBTITULO = 2;

export const LINHA_FAIXA_IDENTIFICACAO = 4;

/** Linhas 5–10: rótulo em A, campo fundido B:H — nesta ordem exata. */
export const CAMPOS_IDENTIFICACAO = [
  { linha: 5, rotulo: "Nome completo", campo: "nome" as const },
  { linha: 6, rotulo: "N.º de documento de identificação", campo: "documento" as const },
  { linha: 7, rotulo: "Entidade concorrente", campo: "entidadeConcorrente" as const },
  { linha: 8, rotulo: "Procedimento n.º", campo: "procedimento" as const },
  { linha: 9, rotulo: "Lote", campo: "lote" as const },
  { linha: 10, rotulo: "Perfil a que se candidata", campo: "perfil" as const },
];

export const LINHA_DECLARACAO_VERACIDADE = 11;
export const TEXTO_DECLARACAO_VERACIDADE =
  "Declaro, sob compromisso de honra, que as informações prestadas neste documento são " +
  "verdadeiras e correspondem à experiência profissional efetivamente exercida, estando ciente " +
  "de que a prestação de falsas declarações constitui contraordenação e/ou crime, nos termos da lei.";

export const LINHA_ASSINATURA = 12;
export const ROTULO_ASSINATURA = "Assinatura digital qualificada do candidato";

export const LINHA_BRANCO_APOS_IDENTIFICACAO = 13;

export const PRIMEIRA_LINHA_BLOCO = 14;

/** Altura total (em linhas) de um bloco de projeto, dado o n.º de requisitos. */
export function alturaBloco(nRequisitos: number): number {
  return 7 + nRequisitos;
}

/** Linha inicial (1-based) do bloco `indiceBloco` (1-based), dado o n.º de requisitos. */
export function linhaInicialBloco(indiceBloco: number, nRequisitos: number): number {
  return PRIMEIRA_LINHA_BLOCO + (indiceBloco - 1) * alturaBloco(nRequisitos);
}

/** Offsets dentro de um bloco, relativos à sua linha inicial. */
export const OFFSET_FAIXA_BLOCO = 0;
export const OFFSET_CLIENTE_PROJETO = 1;
export const OFFSET_FUNCAO = 2;
export const OFFSET_DATAS_PROJETO = 3;
export const OFFSET_SUBCABECALHO = 4;
export const OFFSET_PRIMEIRA_LINHA_REQUISITO = 5;

export function offsetNotaBloco(nRequisitos: number): number {
  return 5 + nRequisitos;
}

export function offsetBrancoBloco(nRequisitos: number): number {
  return 6 + nRequisitos;
}

export const TEXTO_NOTA_BLOCO =
  "Datas da experiência: preencher apenas quando a experiência no requisito tiver sido inferior " +
  "ao período do projeto. Em branco = experiência durante todo o período do projeto.";

export const TEXTO_SUBCABECALHO_REQUISITO =
  "Requisito — indicar, para cada um, se declara experiência neste projeto";
export const TEXTO_SUBCABECALHO_DECLARA = "Declara experiência?";
export const TEXTO_SUBCABECALHO_INICIO = "Início da experiência (mês / ano)";
export const TEXTO_SUBCABECALHO_FIM = "Fim da experiência (mês / ano)";

export const TEXTO_ROTULO_CLIENTE = "Cliente / Entidade";
export const TEXTO_ROTULO_PROJETO = "Projeto";
export const TEXTO_ROTULO_FUNCAO = "Função desempenhada";
export const TEXTO_ROTULO_INICIO_PROJETO = "Início do projeto (mês / ano)";
export const TEXTO_ROTULO_FIM_PROJETO = "Fim do projeto (mês / ano)";
export const TEXTO_ROTULO_EM_CURSO = "Em curso?";

export function tituloFaixaBloco(numeroBloco: number): string {
  return `PROJETO ${numeroBloco}`;
}

/** Folha "Listas" (oculta) — fontes das listas de validação. */
export const LISTAS_SIM_NAO = { col: "B", primeiraLinha: 2, ultimaLinha: 3 } as const; // Sim/Não
export const LISTAS_SIM_NAO_MAIUSC = { col: "C", primeiraLinha: 2, ultimaLinha: 3 } as const; // SIM/NÃO
export const LISTAS_MESES = { col: "D", primeiraLinha: 2, ultimaLinha: 13 } as const; // 1..12

export const ANO_MINIMO = 1910;
export const ANO_MAXIMO = 2035;
