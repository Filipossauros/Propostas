// Preenchimento do pedido de parecer prévio eAvalia.
//
// Ao contrário do formulário de declaração e do relatório de avaliação, este
// ficheiro não é gerado: é um modelo fornecido pela entidade que o recebe, e
// aqui apenas se escrevem valores em sete células. Tudo o resto — folhas
// ocultas, listas de validação, formatação condicional, fórmulas, XML
// personalizado, definições de impressão — tem de sair exatamente como entrou.
//
// Daí não se usar o exceljs, que reescreveria o livro inteiro a partir da sua
// própria leitura e perderia pelo caminho o que não sabe representar. Abre-se o
// ZIP, substituem-se as células nos dois XML que as contêm, e volta a fechar-se
// com as restantes entradas intactas.

import JSZip from "jszip";
import type { InformacaoEavalia, LotesJSON, RespostaEavalia } from "../core/types";
import modeloBase64 from "./modelos/Pedido_PPP_eavalia.xlsx?base64";

/**
 * Uma medida do formulário que esta aplicação preenche.
 *
 * `inicioDoTexto` é a guarda contra o modelo mudar debaixo dos pés: se um dia
 * o formulário for substituído por outra versão em que as linhas tenham
 * mudado de sítio, escrever às cegas em E6 poria a resposta na medida errada.
 * Confirma-se antes que a linha ainda é aquela.
 */
interface Medida {
  campo: keyof InformacaoEavalia;
  linha: number;
  inicioDoTexto: string;
}

/** Folha "Alinhamento Tecnológico" — a terceira do livro. */
const FOLHA_ALINHAMENTO = "xl/worksheets/sheet3.xml";
/** Folha "Informação Base da despesa" — a segunda. */
const FOLHA_DESPESA = "xl/worksheets/sheet2.xml";

/** Célula do objeto da aquisição, fundida de B17 a F17. */
const CELULA_OBJETO = "B17";

const MEDIDAS: Medida[] = [
  {
    campo: "iap",
    linha: 6,
    inicioDoTexto: "Reutilização de dados disponíveis por outros serviços ou entidades",
  },
  {
    campo: "chaveMovelDigital",
    linha: 26,
    inicioDoTexto: "Implementação de mecanismos de autenticação e assinatura disponibilizados pelo Estado",
  },
  {
    campo: "idiomas",
    linha: 44,
    inicioDoTexto: "Disponibilização dos serviços e conteúdos pelo menos nos idiomas português e inglês",
  },
];

export class ErroModeloEavalia extends Error {}

/**
 * Respostas que levam data: as que assumem um compromisso para o futuro.
 *
 * A regra é do próprio formulário, e está lá escrita na formatação condicional
 * da célula da data: "Cumpre Totalmente" e "Cumpre Parcialmente" tratam-na de
 * uma maneira, "Já cumpre", "Não cumpre" e "Não aplicável" de outra. Quem já
 * cumpre não tem data por que se comprometer, e a quem não se aplica não há
 * data nenhuma a pedir.
 */
const RESPOSTAS_COM_DATA: RespostaEavalia[] = ["Cumpre Totalmente", "Cumpre Parcialmente"];

// --------------------------------------------------------------------------
// Manipulação do XML das folhas
// --------------------------------------------------------------------------

function escaparXml(texto: string): string {
  return (
    texto
      // Caracteres de controlo não são admitidos em XML 1.0, e o nome do
      // projeto vem escrito à mão: uma tabulação colada de outro sítio bastava
      // para o ficheiro deixar de abrir.
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  );
}

/**
 * Substitui uma célula vazia pelo seu conteúdo, preservando os atributos —
 * designadamente `s`, que é o estilo, e é o que dá à data o formato de data.
 *
 * Exige que a célula exista e esteja vazia (`<c r="E6" s="17"/>`): se já
 * tivesse valor, ou não existisse, o modelo não seria o que se espera e
 * escrever nele às cegas seria pior do que não escrever.
 */
function escreverCelula(xml: string, ref: string, conteudo: (atributos: string) => string): string {
  const vazia = new RegExp(`<c r="${ref}"([^>]*?)/>`);
  const encontrada = vazia.exec(xml);
  if (encontrada === null) {
    throw new ErroModeloEavalia(
      `O modelo eAvalia não tem a célula ${ref} por preencher. ` +
        "O ficheiro-modelo terá sido substituído por outra versão.",
    );
  }
  // Substituição por função: o nome do projeto é texto livre, e um "$&" ou um
  // "$1" lá dentro seria interpretado como padrão se fosse passado como cadeia.
  const substituto = conteudo(encontrada[1]);
  return xml.replace(vazia, () => substituto);
}

function celulaDeTexto(ref: string, atributos: string, valor: string): string {
  // Texto em linha, e não uma entrada na tabela de cadeias partilhadas: assim
  // o sharedStrings.xml do modelo fica byte a byte igual ao original.
  return `<c r="${ref}"${atributos} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function celulaDeNumero(ref: string, atributos: string, valor: number): string {
  return `<c r="${ref}"${atributos}><v>${valor}</v></c>`;
}

/**
 * Data no formato interno do Excel: dias desde 30/12/1899. Conta-se em UTC
 * sobre a data civil, para o resultado não depender do fuso do posto.
 */
export function serieDeData(data: Date): number {
  const dia = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  return Math.round((dia - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// --------------------------------------------------------------------------
// Confirmação de que o modelo é o esperado
// --------------------------------------------------------------------------

/** Textos da tabela de cadeias partilhadas, por índice. */
function lerCadeiasPartilhadas(xml: string): string[] {
  const cadeias: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []) {
    const partes = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    cadeias.push(
      partes
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join("")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    );
  }
  return cadeias;
}

/** O texto da medida na coluna A de uma linha, tal como está no modelo. */
function textoDaMedida(xml: string, linha: number, cadeias: string[]): string {
  const celula = new RegExp(`<c r="A${linha}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`).exec(xml);
  if (celula === null) return "";
  return cadeias[Number(celula[1])] ?? "";
}

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
 * Preenche o modelo eAvalia com o nome do projeto e as três respostas.
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

    const resposta: RespostaEavalia = config.eavalia[medida.campo];
    if (resposta === "") continue;

    alinhamento = escreverCelula(alinhamento, `E${medida.linha}`, (attrs) =>
      celulaDeTexto(`E${medida.linha}`, attrs, resposta),
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
