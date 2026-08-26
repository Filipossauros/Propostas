/** Modelos .xlsx e .docx embutidos no pacote como base64 — ver `modeloEmBase64` no vite.config.ts. */
declare module "*.xlsx?base64" {
  const conteudo: string;
  export default conteudo;
}

declare module "*.docx?base64" {
  const conteudo: string;
  export default conteudo;
}
