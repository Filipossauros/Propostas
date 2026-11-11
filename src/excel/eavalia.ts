// Preenchimento do pedido de parecer prévio eAvalia.
//
// Ao contrário do formulário de declaração e do relatório de avaliação, este
// ficheiro não é gerado: é um modelo fornecido pela entidade que o recebe, e
// aqui apenas se escrevem valores nas células a preencher — as medidas do
// alinhamento, o objeto da despesa e os custos dos serviços —, e se mostra a
// folha destes, que o modelo traz oculta. Tudo o resto — as outras folhas
// ocultas, listas de validação, formatação condicional, fórmulas, XML
// personalizado, definições de impressão — tem de sair exatamente como entrou.
//
// Daí não se usar o exceljs, que reescreveria o livro inteiro a partir da sua
// própria leitura e perderia pelo caminho o que não sabe representar. Abre-se o
// ZIP, substituem-se as células nos XML que as contêm, e volta a fechar-se com
// as restantes entradas intactas.

import JSZip from "jszip";
import type { InformacaoEavalia, LotesJSON } from "../core/types";
import type { PedidoLicenciamento } from "../core/licenciamento";
import modeloBase64 from "./modelos/Pedido_PPP_eavalia.xlsx?base64";
import {
  CELULA_OBJETO,
  celulaDeNumero,
  celulaDeTexto,
  ErroModeloEavalia,
  escreverCelula,
  FOLHA_ALINHAMENTO,
  FOLHA_CUSTOS_SERVICOS,
  FOLHA_DESPESA,
  lerCadeiasPartilhadas,
  MEDIDAS,
  RESPOSTAS_COM_DATA,
  serieDeData,
  textoDaMedida,
  type RespostaDoFormulario,
} from "./eavaliaModelo";
import { comFolhaVisivel, preencherCustosServicos, recursosDoProcedimento } from "./custosServicos";
import { FOLHA_CUSTOS_LICENCIAMENTO, preencherCustosLicenciamento } from "./custosLicenciamento";

export { ErroModeloEavalia, serieDeData };

// --------------------------------------------------------------------------
// Geração
// --------------------------------------------------------------------------

function decodificarBase64(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** O modelo eAvalia aberto, com as folhas que se preenchem sempre. */
async function abrirModelo() {
  const zip = await JSZip.loadAsync(decodificarBase64(modeloBase64));
  const folhaAlinhamento = zip.file(FOLHA_ALINHAMENTO);
  const folhaDespesa = zip.file(FOLHA_DESPESA);
  const livro = zip.file("xl/workbook.xml");
  const cadeias = zip.file("xl/sharedStrings.xml");
  if (folhaAlinhamento === null || folhaDespesa === null || livro === null || cadeias === null) {
    throw new ErroModeloEavalia("O modelo eAvalia não tem a estrutura esperada.");
  }
  const partilhadas = lerCadeiasPartilhadas(await cadeias.async("string"));
  return { zip, partilhadas };
}

/**
 * As medidas do alinhamento tecnológico e o objeto da despesa — o que é comum
 * ao pedido de serviços e ao de licenciamento.
 */
async function preencherAlinhamentoEDespesa(
  zip: JSZip,
  partilhadas: string[],
  eavalia: InformacaoEavalia,
  objeto: string,
  hoje: Date,
): Promise<void> {
  let alinhamento = await zip.file(FOLHA_ALINHAMENTO)!.async("string");
  const serie = serieDeData(hoje);

  for (const medida of MEDIDAS) {
    const texto = textoDaMedida(alinhamento, medida.linha, partilhadas);
    if (!texto.startsWith(medida.inicioDoTexto)) {
      throw new ErroModeloEavalia(
        `A linha ${medida.linha} do modelo eAvalia já não é a medida esperada ` +
          `("${medida.inicioDoTexto}…"). O ficheiro-modelo terá sido substituído por outra versão.`,
      );
    }

    const resposta: RespostaDoFormulario = "fixa" in medida ? medida.fixa : eavalia[medida.campo];
    if (resposta === "") continue;

    alinhamento = escreverCelula(
      alinhamento,
      `E${medida.linha}`,
      (attrs) => celulaDeTexto(`E${medida.linha}`, attrs, resposta),
      // Escreve-se por cima do que o modelo traga: metade destas células já vem
      // com "Não aplicável" de origem, que é um valor por omissão do formulário
      // e não a resposta de ninguém. A linha já foi confirmada pelo seu texto.
      true,
    );
    if (RESPOSTAS_COM_DATA.includes(resposta)) {
      alinhamento = escreverCelula(alinhamento, `F${medida.linha}`, (attrs) =>
        celulaDeNumero(`F${medida.linha}`, attrs, serie),
      );
    }
  }
  zip.file(FOLHA_ALINHAMENTO, alinhamento);

  const despesa = escreverCelula(await zip.file(FOLHA_DESPESA)!.async("string"), CELULA_OBJETO, (attrs) =>
    celulaDeTexto(CELULA_OBJETO, attrs, objeto),
  );
  zip.file(FOLHA_DESPESA, despesa);
}

async function fechar(zip: JSZip): Promise<Blob> {
  // O `loadAsync` cria entradas de pasta ao interpretar os caminhos; o modelo
  // não as tem, e o arquivo há de sair com as mesmas entradas com que entrou.
  for (const nome of Object.keys(zip.files)) {
    if (zip.files[nome].dir) delete zip.files[nome];
  }

  const dados = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return new Blob([dados], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Preenche o modelo eAvalia com o nome do projeto, as respostas do Módulo 3,
 * as respostas fixas e, na folha «Custos - Serviços», os perfis dos lotes.
 *
 * Uma medida por responder fica em branco, que é como o modelo já vem — e a
 * formatação condicional do próprio formulário assinala-a. A data só acompanha
 * as respostas que assumem um compromisso futuro (ver `RESPOSTAS_COM_DATA`).
 */
export async function gerarEavaliaBlob(
  config: LotesJSON,
  /** Recebida, e não lida do relógio, para o resultado ser reproduzível. */
  hoje: Date = new Date(),
): Promise<Blob> {
  const { zip, partilhadas } = await abrirModelo();
  const folhaCustos = zip.file(FOLHA_CUSTOS_SERVICOS);
  if (folhaCustos === null) throw new ErroModeloEavalia("O modelo eAvalia não tem a estrutura esperada.");
  await preencherAlinhamentoEDespesa(zip, partilhadas, config.eavalia, config.nomeProjeto, hoje);

  // Os custos dos serviços: um bloco por perfil em cada lote. A folha vem
  // oculta no modelo e passa a ver-se — é o que se pede preenchido.
  zip.file(
    FOLHA_CUSTOS_SERVICOS,
    preencherCustosServicos(await folhaCustos.async("string"), recursosDoProcedimento(config), partilhadas),
  );
  zip.file("xl/workbook.xml", comFolhaVisivel(await zip.file("xl/workbook.xml")!.async("string")));
  return fechar(zip);
}

/**
 * O eAvalia de um pedido de licenciamento: o alinhamento e o objeto como no
 * pedido de serviços, e a folha «Custos - Licenciamento» preenchida com os
 * produtos (ver `custosLicenciamento.ts`). A folha «Custos - Serviços» fica
 * como o modelo a traz — oculta e por preencher.
 */
export async function gerarEavaliaLicenciamentoBlob(
  pedido: PedidoLicenciamento,
  hoje: Date = new Date(),
): Promise<Blob> {
  const { zip, partilhadas } = await abrirModelo();
  const folha = zip.file(FOLHA_CUSTOS_LICENCIAMENTO);
  if (folha === null) throw new ErroModeloEavalia("O modelo eAvalia não tem a folha «Custos - Licenciamento».");
  await preencherAlinhamentoEDespesa(zip, partilhadas, pedido.eavalia, pedido.nomeProjeto, hoje);
  zip.file(FOLHA_CUSTOS_LICENCIAMENTO, preencherCustosLicenciamento(await folha.async("string"), pedido, partilhadas));
  return fechar(zip);
}
