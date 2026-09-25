import { beforeAll, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { inflateSync } from "node:zlib";
import JSZip from "jszip";
import { PDFArray, PDFDocument, PDFRawStream, PDFRef, type PDFPage } from "pdf-lib";
import { wordEmPdf } from "./wordEmPdf";
import { gerarManifestacaoNecessidadesBlob, gerarPedidoPlurianualBlob } from "../word/informacaoSpms";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { normalizarLotesGuardados } from "../core/lotes";
import type { LotesJSON } from "../core/types";

beforeAll(() => {
  // O conversor lê o XML com o DOMParser do browser; aqui, o do jsdom.
  globalThis.DOMParser = new JSDOM().window.DOMParser as unknown as typeof DOMParser;
});

const QUANDO = new Date("2026-08-26T10:00:00");

function exemplo(alteracoes: Partial<LotesJSON> = {}): LotesJSON {
  return normalizarLotesGuardados({ ...LOTES_EXEMPLO, numeroInformacao: "I/1234/2026", ...alteracoes });
}

/** As letras padrão do PDF escrevem em WinAnsi: os bytes 0x80–0x9F não são Latin-1. */
const WIN_ANSI: Record<number, string> = {
  0x80: "€", 0x85: "…", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
};

function decodificar(hex: string): string {
  let texto = "";
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    texto += WIN_ANSI[b] ?? String.fromCharCode(b);
  }
  return texto;
}

/** O texto de cada página, pela ordem em que foi escrito. */
async function textoDasPaginas(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const conteudo = (pagina: PDFPage): string => {
    const contents = pagina.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs
      .map((r) => {
        const stream = r instanceof PDFRef ? doc.context.lookup(r) : r;
        if (!(stream instanceof PDFRawStream)) return "";
        const bruto = Buffer.from(stream.contents);
        const texto = stream.dict.toString().includes("FlateDecode") ? inflateSync(bruto) : bruto;
        return [...texto.toString("latin1").matchAll(/<([0-9A-Fa-f]*)> Tj/g)].map((m) => decodificar(m[1])).join(" ");
      })
      .join(" ");
  };
  return doc.getPages().map(conteudo);
}

/** O texto de cada parágrafo do corpo do Word, sem espaços — é o que se compara. */
async function paragrafosDoWord(docx: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  return (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
    .map((p) => (p.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))
    .map(semEspacos)
    .filter((t) => t !== "");
}

function semEspacos(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // A caixa de escolha desenha-se, não se escreve: não conta como texto.
    .replace(/[\s\u00A0\u202F\u25A1\u2610]+/g, "");
}

/**
 * O corpo de todas as páginas, seguido: o cabeçalho e o rodapé desenham-se
 * primeiro em cada página — a morada, que acaba no fax, e depois o «n/N» —;
 * um parágrafo que passe de uma página à outra fica assim inteiro.
 */
function soCorpo(paginas: string[]): string {
  return paginas
    .map(semEspacos)
    .map((texto, i) => {
      const corpo = texto.slice(texto.indexOf("Fax:211545649") + "Fax:211545649".length);
      const numero = `${i + 1}/${paginas.length}`;
      return corpo.startsWith(numero) ? corpo.slice(numero.length) : corpo;
    })
    .join("");
}

describe("wordEmPdf", () => {
  it("leva todo o texto do pedido do triénio, pela ordem do Word", async () => {
    const docx = await gerarPedidoPlurianualBlob(exemplo(), QUANDO);
    const pdf = soCorpo(await textoDasPaginas(await wordEmPdf(docx, "Pedido")));

    let desde = 0;
    for (const paragrafo of await paragrafosDoWord(docx)) {
      const onde = pdf.indexOf(paragrafo, desde);
      expect(onde, `falta no PDF: «${paragrafo.slice(0, 80)}»`).toBeGreaterThanOrEqual(0);
      desde = onde + paragrafo.length;
    }
  });

  it("preenche o n.º da informação e a numeração das páginas", async () => {
    const docx = await gerarPedidoPlurianualBlob(exemplo(), QUANDO);
    const paginas = await textoDasPaginas(await wordEmPdf(docx));

    expect(paginas.length).toBeGreaterThan(2);
    expect(semEspacos(paginas[0])).toContain("I/1234/2026");
    // O rodapé do modelo, com a paginação «n/N» calculada.
    paginas.forEach((texto, i) => expect(semEspacos(texto)).toContain(`${i + 1}/${paginas.length}`));
    expect(semEspacos(paginas[0])).toContain("ServiçosPartilhadosdoMinistériodaSaúde");
    // E a nota vertical da lateral do cabeçalho.
    expect(semEspacos(paginas[0])).toContain("CapitalEstatutário");
  });

  it("faz o mesmo com a manifestação de necessidades", async () => {
    const config = exemplo({ encargosPlurianuais: { ativo: false, anoInicio: 2026 } });
    const docx = await gerarManifestacaoNecessidadesBlob(config, QUANDO);
    const pdf = soCorpo(await textoDasPaginas(await wordEmPdf(docx)));

    for (const paragrafo of await paragrafosDoWord(docx)) expect(pdf).toContain(paragrafo);
  });

  it("a assinatura fica na mesma página que «À consideração superior»", async () => {
    const docx = await gerarPedidoPlurianualBlob(exemplo(), QUANDO);
    const paginas = (await textoDasPaginas(await wordEmPdf(docx))).map(semEspacos);

    const fecho = paginas.findIndex((p) => p.includes("Àconsideraçãosuperior"));
    expect(fecho).toBeGreaterThanOrEqual(0);
    expect(paginas[fecho]).toContain("FilipeMealha");
    expect(paginas[fecho]).toContain("(Coordenador)");
  });

  it("não põe em maiúsculas o texto de um parágrafo cuja marca as tem", async () => {
    // O modelo marca com maiúsculas o parágrafo da direção, na assinatura; o
    // texto em si não as tem, e o Word mostra-o como está escrito.
    const docx = await gerarPedidoPlurianualBlob(exemplo(), QUANDO);
    const pdf = soCorpo(await textoDasPaginas(await wordEmPdf(docx)));
    expect(pdf).toContain("DireçãodeArquitetura,NegócioeAnálisedeDados");
  });

  it("guarda o título nas propriedades do PDF, em A4", async () => {
    const docx = await gerarPedidoPlurianualBlob(exemplo(), QUANDO);
    const doc = await PDFDocument.load(await wordEmPdf(docx, "Informação I/1234/2026"));

    expect(doc.getTitle()).toBe("Informação I/1234/2026");
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });
});
