// Comparação PDF <-> Excel — PLANO.md secção 8.
// O PDF prevalece juridicamente; esta comparação só deteta divergências e
// gera alertas — nunca decide qual documento prevalece, e nunca valida a
// assinatura digital (isso faz-se com ferramentas próprias).

import type { Alerta } from "../core/types";
import { normalizarTexto } from "./normalizar";
import type { ValoresDeclarados } from "./extrairValores";

const TOKEN_SIM_NAO = /\bSIM\b|\bNAO\b/g;

function extrairSequenciaPdf(textoNormalizado: string): string[] {
  return textoNormalizado.match(TOKEN_SIM_NAO) ?? [];
}

/**
 * Compara os valores declarados (extraídos do Excel) com o texto do PDF já
 * normalizado. Devolve um alerta por cada divergência encontrada.
 */
export function compararComPdf(
  valores: ValoresDeclarados,
  textoPdfNormalizado: string,
  requisitosPorId: Map<string, string>,
): Alerta[] {
  const alertas: Alerta[] = [];

  // (a) sequência ordenada de SIM/NÃO — verificação por subsequência, para
  // tolerar conteúdo adicional no PDF (cabeçalhos, notas, paginação).
  const tokensPdf = extrairSequenciaPdf(textoPdfNormalizado);
  let ponteiro = 0;
  for (const resposta of valores.sequenciaDeclara) {
    const posicao = tokensPdf.indexOf(resposta.valor, ponteiro);
    if (posicao === -1) {
      const designacao = requisitosPorId.get(resposta.requisitoId) ?? resposta.requisitoId;
      alertas.push({
        tipo: "divergenciaPdf",
        mensagem: `Bloco ${resposta.blocoIndice}, requisito "${designacao}": o PDF não confirma a resposta "${resposta.valor === "SIM" ? "SIM" : "NÃO"}" declarada no Excel, na mesma posição relativa.`,
        blocoIndice: resposta.blocoIndice,
        requisitoId: resposta.requisitoId,
      });
    } else {
      ponteiro = posicao + 1;
    }
  }

  // (b) conjunto de datas declaradas — qualquer variante textual aceite (com/sem zero à esquerda).
  for (const data of valores.datas) {
    const encontrada = data.variantes.some((variante) => textoPdfNormalizado.includes(variante));
    if (!encontrada) {
      alertas.push({
        tipo: "divergenciaPdf",
        mensagem: `A data "${data.chave}" declarada no Excel não foi encontrada no texto do PDF.`,
      });
    }
  }

  // (c) conjunto de textos livres (cliente, projeto, função, identificação).
  for (const texto of valores.textos) {
    if (!textoPdfNormalizado.includes(texto)) {
      alertas.push({
        tipo: "divergenciaPdf",
        mensagem: `O texto "${texto}" declarado no Excel não foi encontrado no PDF.`,
      });
    }
  }

  return alertas;
}

export { normalizarTexto };
