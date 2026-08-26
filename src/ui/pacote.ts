// Saídas em pacote: um ZIP por módulo, em vez de um descarregamento por ficheiro.
//
// Os ficheiros de um procedimento andam sempre juntos — seguem para a mesma
// pasta partilhada, e são anexados ao mesmo processo. Descarregá-los um a um
// obrigava o navegador a pedir autorização para vários descarregamentos
// seguidos, e deixava a quem recebe o trabalho de os voltar a juntar.

import JSZip from "jszip";
import { descarregarBlob, nomeSeguro } from "./descarregar";

/** Um ficheiro dentro do pacote: o nome com que lá fica, e o seu conteúdo. */
export interface FicheiroDoPacote {
  nome: string;
  conteudo: Blob | string;
}

/**
 * A data de geração, no fim do nome do ficheiro: DDMMAAAA.
 *
 * Sem separadores, e sempre com oito dígitos — é o que faz os pacotes de um
 * mesmo procedimento ordenarem-se pela data em qualquer explorador de ficheiros.
 */
export function carimboDeData(quando = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(quando.getDate())}${dois(quando.getMonth() + 1)}${quando.getFullYear()}`;
}

/**
 * O nome de um pacote: quem é, do que trata, e de quando é.
 *
 * `assunto` já vem com as palavras separadas por `_`; o nome do projeto ou da
 * unidade passa por `nomeSeguro`, que lhe tira acentos e pontuação.
 */
export function nomeDoPacote(dono: string, assunto: string, quando = new Date(), alternativa = "Projeto"): string {
  return `${nomeSeguro(dono, alternativa)}_${assunto}_${carimboDeData(quando)}.zip`;
}

/**
 * Junta os ficheiros num ZIP e entrega-o.
 *
 * Sem compressão a sério: o que vai lá dentro são .docx e .xlsx, que já são
 * ZIP comprimidos, e voltar a comprimi-los só custa tempo. O JSON encolhe, e é
 * a menor parte do pacote.
 */
export async function descarregarPacote(
  nome: string,
  ficheiros: FicheiroDoPacote[],
  pasta?: string,
): Promise<void> {
  const zip = new JSZip();
  const destino = pasta === undefined ? zip : (zip.folder(pasta) ?? zip);
  for (const ficheiro of ficheiros) destino.file(ficheiro.nome, await conteudoBinario(ficheiro.conteudo));

  descarregarBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), nome);
}

/**
 * O conteúdo em bytes, seja ele texto ou `Blob`.
 *
 * O JSZip aceita `Blob` no navegador, mas não fora dele: converter aqui é o que
 * faz o empacotamento correr igual na aplicação e nos testes.
 */
async function conteudoBinario(conteudo: Blob | string): Promise<ArrayBuffer | string> {
  return typeof conteudo === "string" ? conteudo : conteudo.arrayBuffer();
}

/** Acrescenta ficheiros dentro de uma pasta do pacote. */
export function emPasta(pasta: string, ficheiros: FicheiroDoPacote[]): FicheiroDoPacote[] {
  return ficheiros.map((f) => ({ ...f, nome: `${pasta}/${f.nome}` }));
}
