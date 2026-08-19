// Extração de texto de um PDF assinado digitalmente — PLANO.md secção 8.
// Como a assinatura é digital qualificada, o PDF é sempre um documento
// digital com texto vetorial, extraível diretamente, sem OCR.
//
// Esta aplicação NUNCA valida a assinatura digital — isso faz-se com
// ferramentas próprias (Autenticação.gov, Adobe).

import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { normalizarTexto } from "./normalizar";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Extrai e normaliza todo o texto de um PDF, concatenando todas as páginas. */
export async function extrairTextoPdfNormalizado(ficheiro: File): Promise<string> {
  const buffer = await ficheiro.arrayBuffer();
  const tarefaCarregamento = pdfjsLib.getDocument({ data: buffer });
  const documento = await tarefaCarregamento.promise;

  const partes: string[] = [];
  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina);
    const conteudo = await pagina.getTextContent();
    const textoPagina = conteudo.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    partes.push(textoPagina);
  }

  await tarefaCarregamento.destroy();
  return normalizarTexto(partes.join(" "));
}
