// Preenchimento do pedido de parecer prévio eAvalia.
//
// Ao contrário do formulário de declaração e do relatório de avaliação, este
// ficheiro não é gerado: é um modelo fornecido pela entidade que o recebe, e
// aqui apenas se escrevem valores em oito células. Tudo o resto — folhas
// ocultas, listas de validação, formatação condicional, fórmulas, XML
// personalizado, definições de impressão — tem de sair exatamente como entrou.
//
// Daí não se usar o exceljs, que reescreveria o livro inteiro a partir da sua
// própria leitura e perderia pelo caminho o que não sabe representar. Abre-se o
// ZIP, substituem-se as células nos dois XML que as contêm, e volta a fechar-se
// com as restantes entradas intactas.

import JSZip from "jszip";
import type { LotesJSON, RespostaEavalia } from "../core/types";
import modeloBase64 from "./modelos/Pedido_PPP_eavalia.xlsx?base64";
import {
  CELULA_OBJETO,
  celulaDeNumero,
  celulaDeTexto,
  ErroModeloEavalia,
  escreverCelula,
  FOLHA_ALINHAMENTO,
  FOLHA_DESPESA,
  lerCadeiasPartilhadas,
  MEDIDAS,
  RESPOSTAS_COM_DATA,
  serieDeData,
  textoDaMedida,
} from "./eavaliaModelo";

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

/**
 * Preenche o modelo eAvalia com o nome do projeto, as três respostas do Módulo
 * 2 e a resposta fixa da medida de cibersegurança.
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
  const zip = await JSZip.loadAsync(decodificarBase64(modeloBase64));

  const folhaAlinhamento = zip.file(FOLHA_ALINHAMENTO);
  const folhaDespesa = zip.file(FOLHA_DESPESA);
  const cadeias = zip.file("xl/sharedStrings.xml");
  if (folhaAlinhamento === null || folhaDespesa === null || cadeias === null) {
    throw new ErroModeloEavalia("O modelo eAvalia não tem a estrutura esperada.");
  }

  const partilhadas = lerCadeiasPartilhadas(await cadeias.async("string"));
  let alinhamento = await folhaAlinhamento.async("string");
  const serie = serieDeData(hoje);

  for (const medida of MEDIDAS) {
    const texto = textoDaMedida(alinhamento, medida.linha, partilhadas);
    if (!texto.startsWith(medida.inicioDoTexto)) {
      throw new ErroModeloEavalia(
        `A linha ${medida.linha} do modelo eAvalia já não é a medida esperada ` +
          `("${medida.inicioDoTexto}…"). O ficheiro-modelo terá sido substituído por outra versão.`,
      );
    }

    const resposta: RespostaEavalia = "fixa" in medida ? medida.fixa : config.eavalia[medida.campo];
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

  const despesa = escreverCelula(await folhaDespesa.async("string"), CELULA_OBJETO, (attrs) =>
    celulaDeTexto(CELULA_OBJETO, attrs, config.nomeProjeto),
  );
  zip.file(FOLHA_DESPESA, despesa);

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
