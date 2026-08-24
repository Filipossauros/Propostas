// @vitest-environment jsdom
//
// Só por causa do DOMParser, com que se confirma que o XML das folhas
// preenchidas continua bem formado.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { gerarEavaliaBlob, serieDeData } from "./eavalia";
import { LOTES_EXEMPLO } from "../core/exemplo";
import type { InformacaoEavalia, LotesJSON } from "../core/types";
import { informacaoEavaliaInicial } from "../core/types";
import modeloBase64 from "./modelos/Pedido_PPP_eavalia.xlsx?base64";

const DIA = new Date(2026, 7, 24);

function config(eavalia: InformacaoEavalia, nomeProjeto = "Modernização & Cª <2026>"): LotesJSON {
  return { ...LOTES_EXEMPLO, nomeProjeto, eavalia };
}

async function gerar(...args: Parameters<typeof gerarEavaliaBlob>) {
  const blob = await gerarEavaliaBlob(...args);
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function modelo() {
  return JSZip.loadAsync(Buffer.from(modeloBase64, "base64"));
}

/** O conteúdo de uma célula, tal como ficou escrito no XML da folha. */
async function celula(zip: JSZip, folha: string, ref: string): Promise<string> {
  const xml = await zip.file(folha)!.async("string");
  const m = new RegExp(`<c r="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`).exec(xml);
  return m === null ? "" : m[0];
}

const ALINHAMENTO = "xl/worksheets/sheet3.xml";
const DESPESA = "xl/worksheets/sheet2.xml";

describe("serieDeData", () => {
  it("converte para o número de dias que o Excel usa", () => {
    // 01/01/2020 é a série 43831, que é o limite inferior da validação do modelo.
    expect(serieDeData(new Date(2020, 0, 1))).toBe(43831);
  });

  it("não depende da hora do dia", () => {
    expect(serieDeData(new Date(2026, 7, 24, 23, 59))).toBe(serieDeData(new Date(2026, 7, 24, 0, 1)));
  });
});

describe("gerarEavaliaBlob", () => {
  it("escreve as três respostas nas medidas a que respeitam", async () => {
    const zip = await gerar(
      config({ iap: "Já cumpre", chaveMovelDigital: "Não aplicável", idiomas: "Cumpre Parcialmente" }),
      DIA,
    );

    expect(await celula(zip, ALINHAMENTO, "E6")).toContain("Já cumpre");
    expect(await celula(zip, ALINHAMENTO, "E26")).toContain("Não aplicável");
    expect(await celula(zip, ALINHAMENTO, "E44")).toContain("Cumpre Parcialmente");
  });

  it("data as respostas com o dia da geração", async () => {
    const zip = await gerar(
      config({ iap: "Já cumpre", chaveMovelDigital: "Já cumpre", idiomas: "Já cumpre" }),
      DIA,
    );

    for (const ref of ["F6", "F26", "F44"]) {
      expect(await celula(zip, ALINHAMENTO, ref)).toContain(`<v>${serieDeData(DIA)}</v>`);
    }
  });

  it("deixa em branco — como o modelo vem — a medida por responder, e sem data", async () => {
    const zip = await gerar(config({ ...informacaoEavaliaInicial(), iap: "Já cumpre" }), DIA);

    expect(await celula(zip, ALINHAMENTO, "E26")).toBe(await celula(await modelo(), ALINHAMENTO, "E26"));
    expect(await celula(zip, ALINHAMENTO, "F26")).toBe(await celula(await modelo(), ALINHAMENTO, "F26"));
  });

  it("leva o nome do projeto ao objeto da aquisição, com o XML escapado", async () => {
    const zip = await gerar(config(informacaoEavaliaInicial()), DIA);

    expect(await celula(zip, DESPESA, "B17")).toContain("Modernização &amp; Cª &lt;2026&gt;");
  });

  it("preserva o estilo das células que preenche", async () => {
    const zip = await gerar(config({ iap: "Já cumpre", chaveMovelDigital: "", idiomas: "" }), DIA);

    // s="17" na resposta e s="14" na data — é o estilo que dá formato de data.
    expect(await celula(zip, ALINHAMENTO, "E6")).toContain('s="17"');
    expect(await celula(zip, ALINHAMENTO, "F6")).toContain('s="14"');
    expect(await celula(zip, DESPESA, "B17")).toContain('s="48"');
  });
});

describe("integridade do modelo", () => {
  it("não toca em mais nada: só as duas folhas preenchidas mudam", async () => {
    const original = await modelo();
    const gerado = await gerar(
      config({ iap: "Já cumpre", chaveMovelDigital: "Não aplicável", idiomas: "Cumpre Parcialmente" }),
      DIA,
    );

    const nomes = Object.keys(original.files);
    expect(Object.keys(gerado.files)).toEqual(nomes);

    const alterados: string[] = [];
    for (const nome of nomes) {
      const antes = await original.file(nome)!.async("base64");
      const depois = await gerado.file(nome)!.async("base64");
      if (antes !== depois) alterados.push(nome);
    }

    expect(alterados).toEqual([DESPESA, ALINHAMENTO]);
  });

  it("não acrescenta cadeias partilhadas ao modelo", async () => {
    const gerado = await gerar(config({ iap: "Já cumpre", chaveMovelDigital: "", idiomas: "" }), DIA);

    expect(await gerado.file("xl/sharedStrings.xml")!.async("string")).toBe(
      await (await modelo()).file("xl/sharedStrings.xml")!.async("string"),
    );
  });

  it("o XML das folhas preenchidas continua bem formado", async () => {
    const zip = await gerar(
      config({ iap: "Já cumpre", chaveMovelDigital: "Não aplicável", idiomas: "Cumpre Parcialmente" }),
      DIA,
    );

    for (const folha of [ALINHAMENTO, DESPESA]) {
      const xml = await zip.file(folha)!.async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    }
  });
});
