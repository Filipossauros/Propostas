/** Entrega um ficheiro ao utilizador. Tudo local — nada sai do posto de trabalho. */
export function descarregarBlob(blob: Blob, nomeFicheiro: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Nome de ficheiro prefixado pelo projeto: todos os documentos que saem da
 * aplicação seguem para pastas partilhadas, e o prefixo é o que os mantém
 * agrupados e distinguíveis entre procedimentos.
 */
export function nomeComProjeto(nomeProjeto: string, resto: string): string {
  return `${nomeSeguro(nomeProjeto, "Projeto")}_${resto}`;
}

/** Torna um texto seguro para nome de ficheiro, sem acentos nem pontuação problemática. */
export function nomeSeguro(texto: string, alternativa: string): string {
  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return limpo === "" ? alternativa : limpo;
}
