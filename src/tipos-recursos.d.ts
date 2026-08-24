/** Ficheiros .xlsx embutidos no pacote como base64 — ver `xlsxEmBase64` no vite.config.ts. */
declare module "*.xlsx?base64" {
  const conteudo: string;
  export default conteudo;
}
