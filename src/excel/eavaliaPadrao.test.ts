// @vitest-environment jsdom
//
// Só por causa do DOMParser, com que se confirma que o XML alterado — a folha e
// os estilos — continua bem formado.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { construirEavaliaPadrao } from "./eavaliaPadrao";
import modeloBase64 from "./modelos/Pedido_PPP_eavalia.xlsx?base64";

const ALINHAMENTO = "xl/worksheets/sheet3.xml";
const ESTILOS = "xl/styles.xml";

const modelo = () => new Uint8Array(Buffer.from(modeloBase64, "base64"));

async function padrao(): Promise<JSZip> {
  return JSZip.loadAsync(await construirEavaliaPadrao(modelo()));
}

/** Os `xf` do `cellXfs`, e quais deles deixam a célula editável. */
function estilosAbertos(estilos: string): Set<number> {
  const bloco = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(estilos)![1];
  const xfs = bloco.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [];
  return new Set(xfs.flatMap((xf, i) => (xf.includes('locked="0"') ? [i] : [])));
}

/** As células da folha que ficaram editáveis. */
function editaveis(folha: string, abertos: Set<number>): string[] {
  const celulas = [...folha.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>)/g)];
  return celulas
    .filter(([, , atributos]) => {
      const estilo = /s="(\d+)"/.exec(atributos);
      return abertos.has(estilo === null ? 0 : Number(estilo[1]));
    })
    .map(([, ref]) => ref);
}

function valorDaCelula(folha: string, ref: string): string {
  const m = new RegExp(`<c r="${ref}"[^>]*(?:/>|>([\\s\\S]*?)</c>)`).exec(folha);
  const t = m?.[1] === undefined ? null : /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[1]);
  return t === null ? "" : t[1];
}

describe("eAvalia-padrão", () => {
  it("tranca a folha do alinhamento, sem palavra-passe", async () => {
    const folha = await (await padrao()).file(ALINHAMENTO)!.async("string");

    expect(folha).toMatch(/<sheetProtection [^>]*sheet="1"/);
    // Sem palavra-passe: o que se pretende é evitar a distração, não impedir
    // quem tenha razão para alterar.
    expect(folha).not.toMatch(/<sheetProtection [^>]*(?:password|algorithmName)=/);
    // A proteção vem logo a seguir aos dados, como o esquema exige.
    expect(folha).toContain("</sheetData><sheetProtection");
  });

  it("deixa editáveis as respostas às medidas e as datas, e nada mais", async () => {
    const zip = await padrao();
    const folha = await zip.file(ALINHAMENTO)!.async("string");
    const abertas = editaveis(folha, estilosAbertos(await zip.file(ESTILOS)!.async("string")));

    // As respostas — todas menos as duas de resposta fixa — e as datas.
    expect(abertas.filter((ref) => ref.startsWith("E"))).toHaveLength(29);
    expect(abertas.filter((ref) => ref.startsWith("F"))).toHaveLength(9);
    expect(abertas.some((ref) => ref.startsWith("A") || ref.startsWith("B"))).toBe(false);
  });

  it("traz as respostas fixas escritas e trancadas", async () => {
    const zip = await padrao();
    const folha = await zip.file(ALINHAMENTO)!.async("string");
    const abertas = editaveis(folha, estilosAbertos(await zip.file(ESTILOS)!.async("string")));

    // Ponto de troca de tráfego e Quadro Nacional de Referência para a
    // Cibersegurança: decididas pela organização, não pela equipa.
    expect(valorDaCelula(folha, "E62")).toBe("Já cumpre");
    expect(valorDaCelula(folha, "E70")).toBe("Não aplicável");
    expect(abertas).not.toContain("E62");
    expect(abertas).not.toContain("E70");
  });

  it("não toca nas outras folhas nem nas listas de escolha", async () => {
    const antes = await JSZip.loadAsync(modelo());
    const depois = await padrao();

    for (const nome of ["xl/worksheets/sheet2.xml", "xl/worksheets/sheet8.xml", "xl/sharedStrings.xml"]) {
      expect(await depois.file(nome)!.async("string")).toBe(await antes.file(nome)!.async("string"));
    }
    // As listas de validação continuam a apontar à folha «Backup».
    const folha = await depois.file(ALINHAMENTO)!.async("string");
    expect(folha).toContain("Backup!$B$7:$B$11");
    expect(folha).toContain("Backup!$B$13:$B$17");
  });

  it("deixa o XML bem formado, e o cellXfs a contar certo", async () => {
    const zip = await padrao();
    const analisador = new DOMParser();

    for (const nome of [ALINHAMENTO, ESTILOS]) {
      const xml = analisador.parseFromString(await zip.file(nome)!.async("string"), "application/xml");
      expect(xml.querySelector("parsererror")).toBeNull();
    }

    const estilos = await zip.file(ESTILOS)!.async("string");
    const declarado = Number(/<cellXfs count="(\d+)"/.exec(estilos)![1]);
    const bloco = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(estilos)![1];
    expect(bloco.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)).toHaveLength(declarado);
  });

  it("mantém as entradas do arquivo, sem pastas a mais", async () => {
    const antes = Object.keys((await JSZip.loadAsync(modelo())).files).sort();
    const depois = Object.keys((await padrao()).files).sort();

    expect(depois).toEqual(antes);
  });
});
