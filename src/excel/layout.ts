// Âncoras e geometria da folha "Experiência" — PLANO.md secção 5.2.
// Módulo partilhado entre o gerador (Módulo 1) e o leitor (Módulo 2): a mesma
// fonte de verdade evita que gerador e leitor divirjam sobre a estrutura.

export const NOME_FOLHA_LEIAME = "Leia-me";
export const NOME_FOLHA_LISTAS = "Listas";
/**
 * Nome da folha de experiência nos ficheiros de perfil único, gerados por
 * versões anteriores. Agora cada perfil tem folha própria, com o nome dado
 * pela sua designação — ver `nomeFolhaPerfil`.
 */
export const NOME_FOLHA_EXPERIENCIA = "Experiência";

/** Caracteres que o Excel não admite em nomes de folha, e o limite de 31 carateres. */
const PROIBIDOS_EM_NOME_DE_FOLHA = /[:\\/?*[\]]/g;
const MAX_NOME_FOLHA = 31;

/**
 * Nome da folha de um perfil, derivado da sua designação.
 *
 * `usados` garante nomes distintos quando duas designações colidem depois de
 * truncadas aos 31 carateres do Excel. A leitura não depende deste nome: o
 * Módulo 3 localiza a folha pelo subtítulo, que traz a designação por inteiro.
 */
export function nomeFolhaPerfil(designacao: string, usados: Set<string> = new Set()): string {
  const limpo = designacao.replace(PROIBIDOS_EM_NOME_DE_FOLHA, " ").trim() || NOME_FOLHA_EXPERIENCIA;
  const base = limpo.slice(0, MAX_NOME_FOLHA);

  let nome = base;
  let sufixo = 2;
  while (usados.has(nome)) {
    const marca = ` (${sufixo++})`;
    nome = `${base.slice(0, MAX_NOME_FOLHA - marca.length)}${marca}`;
  }
  usados.add(nome);
  return nome;
}

export const LINHA_TITULO = 1;
export const LINHA_SUBTITULO = 2;

export const LINHA_FAIXA_IDENTIFICACAO = 4;

/**
 * Linhas 5–9: rótulo em A, campo fundido B:H — nesta ordem exata.
 *
 * "Procedimento n.º" e "Lote n.º" ficam em branco (editáveis) quando o
 * formulário é gerado a partir do Módulo 1, e pré-preenchidos e bloqueados
 * quando gerado a partir de um lote já definido no Módulo 2. "Perfil a que
 * se candidata" é sempre pré-preenchido e bloqueado: é a entidade emitente
 * quem o define, nunca o candidato.
 */
export const CAMPOS_IDENTIFICACAO = [
  { linha: 5, rotulo: "Nome completo", campo: "nome" as const },
  { linha: 6, rotulo: "Entidade concorrente", campo: "entidadeConcorrente" as const },
  { linha: 7, rotulo: "Procedimento n.º", campo: "procedimento" as const },
  { linha: 8, rotulo: "Lote n.º", campo: "lote" as const },
  { linha: 9, rotulo: "Perfil a que se candidata", campo: "perfil" as const },
];

export const LINHA_DECLARACAO_VERACIDADE = 10;
export const TEXTO_DECLARACAO_VERACIDADE =
  "Declaro, sob compromisso de honra, que as informações prestadas neste documento são " +
  "verdadeiras e correspondem à experiência profissional efetivamente exercida.";

export const LINHA_ASSINATURA = 11;
export const ROTULO_ASSINATURA = "Assinatura digital qualificada do candidato";

export const LINHA_BRANCO_APOS_IDENTIFICACAO = 12;

export const PRIMEIRA_LINHA_BLOCO = 13;

/** Altura total (em linhas) de um bloco de projeto, dado o n.º de requisitos. */
export function alturaBloco(nRequisitos: number): number {
  return 8 + nRequisitos;
}

/** Linha inicial (1-based) do bloco `indiceBloco` (1-based), dado o n.º de requisitos. */
export function linhaInicialBloco(indiceBloco: number, nRequisitos: number): number {
  return PRIMEIRA_LINHA_BLOCO + (indiceBloco - 1) * alturaBloco(nRequisitos);
}

/** Offsets dentro de um bloco, relativos à sua linha inicial. */
export const OFFSET_FAIXA_BLOCO = 0;
export const OFFSET_CLIENTE_PROJETO = 1;
export const OFFSET_FUNCAO = 2;
export const OFFSET_CABECALHO_DATAS_PROJETO = 3;
export const OFFSET_DATAS_PROJETO = 4;
export const OFFSET_SUBCABECALHO = 5;
export const OFFSET_PRIMEIRA_LINHA_REQUISITO = 6;

export function offsetNotaBloco(nRequisitos: number): number {
  return 6 + nRequisitos;
}

export function offsetBrancoBloco(nRequisitos: number): number {
  return 7 + nRequisitos;
}

export const TEXTO_NOTA_BLOCO =
  "Os campos \"Início da experiência – mês\", \"Início da experiência – ano\", \"fim da experiência – mês\" e " +
  "\"fim da experiência – ano\" devem ser preenchidos apenas quando a experiência no requisito tiver sido " +
  "inferior ao período do projeto. Caso não sejam preenchidos, considera-se que a experiência no requisito " +
  "corresponde ao período integral do projeto.";

export const TEXTO_DISCLAIMER_PROJETO_EM_CURSO =
  "Se o projeto ainda estiver em curso à data de preenchimento deste formulário, indique como \"Fim do " +
  "projeto\" o mês e o ano em que este formulário está a ser preenchido.";

export const TEXTO_SUBCABECALHO_REQUISITO =
  "Requisito — indicar, para cada um, se declara experiência neste projeto";
export const TEXTO_SUBCABECALHO_DECLARA = "Declara experiência?";

/**
 * Cada coluna de data tem rótulo próprio, em vez de um cabeçalho "(mês / ano)"
 * fundido sobre duas colunas: assim não há dúvida sobre qual célula recebe o
 * mês e qual recebe o ano.
 */
export const TEXTO_SUBCABECALHO_INICIO_MES = "Início da experiência — Mês";
export const TEXTO_SUBCABECALHO_INICIO_ANO = "Início da experiência — Ano";
export const TEXTO_SUBCABECALHO_FIM_MES = "Fim da experiência — Mês";
export const TEXTO_SUBCABECALHO_FIM_ANO = "Fim da experiência — Ano";

export const TEXTO_ROTULO_CLIENTE = "Cliente / Entidade";
export const TEXTO_ROTULO_PROJETO = "Projeto";
export const TEXTO_ROTULO_FUNCAO = "Função desempenhada";
export const TEXTO_ROTULO_INICIO_PROJETO = "Início do projeto";
export const TEXTO_ROTULO_FIM_PROJETO = "Fim do projeto";
/**
 * Cabeçalho visível por cima de cada par de células mês/ano das datas do
 * projeto — mesmo tratamento das colunas de datas da experiência, para que
 * não haja dúvida sobre qual célula recebe o mês e qual recebe o ano.
 */
export const TEXTO_CABECALHO_MES = "Mês";
export const TEXTO_CABECALHO_ANO = "Ano";

export function tituloFaixaBloco(numeroBloco: number): string {
  return `PROJETO ${numeroBloco}`;
}

/** Folha "Listas" (oculta) — fontes das listas de validação. */
export const LISTAS_SIM_NAO_MAIUSC = { col: "C", primeiraLinha: 2, ultimaLinha: 3 } as const; // SIM/NÃO
export const LISTAS_MESES = { col: "D", primeiraLinha: 2, ultimaLinha: 13 } as const; // 1..12

export { ANO_MAXIMO, ANO_MINIMO } from "../core/types";
