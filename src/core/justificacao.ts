// Benefícios do projeto e riscos da não contratação.
//
// Escrevem-se no Módulo 1, com o nome e a descrição do projeto, e entram no
// «Enquadramento» das informações da SPMS. Aqui vive o que as duas listas têm
// de comum aos ficheiros e aos ecrãs: o estado inicial, a leitura do que vem
// gravado e a validação.

import type { ItemPerfil, JustificacaoProjeto } from "./types";
import { normalizarItens, type ErroValidacao } from "./perfil";

export function justificacaoInicial(): JustificacaoProjeto {
  return { beneficios: [], riscos: [] };
}

/**
 * Lê a justificação de um ficheiro ou do navegador.
 *
 * Ficheiros anteriores a estes campos não a trazem: ficam as duas listas
 * vazias, que é o estado de quem ainda não as escreveu.
 */
export function normalizarJustificacao(bruto: unknown): JustificacaoProjeto {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return justificacaoInicial();
  const j = bruto as Partial<Record<keyof JustificacaoProjeto, unknown>>;
  return { beneficios: normalizarItens(j.beneficios), riscos: normalizarItens(j.riscos) };
}

/** O que vem do navegador tem, pelo menos, a forma de um objeto — o resto põe-no em dia a normalização. */
export function ehJustificacaoGuardada(valor: unknown): valor is JustificacaoProjeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Se há alguma coisa escrita — o que decide se uma importação a pode adotar. */
export function temJustificacao(justificacao: JustificacaoProjeto): boolean {
  return [...justificacao.beneficios, ...justificacao.riscos].some((item) => item.designacao.trim() !== "");
}

function validarLista(itens: ItemPerfil[], campo: string, nome: string, falta: string): ErroValidacao[] {
  if (itens.length === 0) return [{ campo, mensagem: falta }];

  const erros: ErroValidacao[] = [];
  const vistas = new Set<string>();
  itens.forEach((item, idx) => {
    const designacao = item.designacao.trim();
    if (designacao === "") {
      erros.push({
        campo: `${campo}[${idx}].designacao`,
        mensagem: `A descrição do ${nome} ${idx + 1} não pode ficar vazia. Remova a linha se não for necessária.`,
      });
    } else if (vistas.has(designacao)) {
      erros.push({
        campo: `${campo}[${idx}].designacao`,
        mensagem: `${nome[0].toUpperCase()}${nome.slice(1)} repetido: "${designacao}".`,
      });
    } else {
      vistas.add(designacao);
    }
  });
  return erros;
}

/**
 * As duas listas são obrigatórias, e cada uma com pelo menos uma entrada: vão
 * para o enquadramento das informações, e uma lista vazia deixava lá a frase
 * que a anuncia sem nada a seguir.
 */
export function validarJustificacao(justificacao: JustificacaoProjeto): ErroValidacao[] {
  return [
    ...validarLista(
      justificacao.beneficios,
      "justificacao.beneficios",
      "benefício",
      "Indique pelo menos um benefício do projeto.",
    ),
    ...validarLista(
      justificacao.riscos,
      "justificacao.riscos",
      "risco",
      "Indique pelo menos um risco da não contratação.",
    ),
  ];
}

/** Uma alínea do documento: a letra e o texto, já com a pontuação de lista. */
export interface Alinea {
  marca: string;
  texto: string;
}

/** a), b), c)… — e o número, passado o z, que é mais do que alguma lista terá. */
function letra(indice: number): string {
  return indice < 26 ? `${String.fromCharCode(97 + indice)})` : `${indice + 1})`;
}

/**
 * As entradas escritas, como alíneas de uma enumeração: a), b), … n).
 *
 * Cada uma acaba em ponto e vírgula e a última em ponto final, que é como se
 * fecha uma enumeração a seguir a dois pontos. A pontuação que a pessoa tenha
 * posto no fim é trocada por esta, para a lista não sair com «;.» ou com umas
 * alíneas pontuadas e outras não. As maiúsculas ficam como foram escritas: a
 * primeira palavra pode ser um nome próprio ou uma sigla.
 */
export function alineasDe(itens: ItemPerfil[]): Alinea[] {
  const textos = itens
    .map((item) => item.designacao.trim().replace(/[\s;:,.]+$/u, ""))
    .filter((texto) => texto !== "");
  return textos.map((texto, i) => ({ marca: letra(i), texto: `${texto}${i === textos.length - 1 ? "." : ";"}` }));
}
