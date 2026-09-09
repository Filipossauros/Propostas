// @vitest-environment jsdom
//
// Só por causa do DOMParser, com que se confirma que o XML alterado — a folha e
// os estilos — continua bem formado.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { construirEavaliaPadrao } from "./eavaliaPadrao";
import { medidasPerguntadas } from "./eavaliaModelo";
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

/** Os `xf` que pintam a célula de amarelo. */
function estilosRealcados(estilos: string): Set<number> {
  const fills = /<fills count="\d+">([\s\S]*?)<\/fills>/.exec(estilos)![1];
  const amarelo = (fills.match(/<fill>|<fill\/>/g) ?? []).length - 1;
  const bloco = /<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/.exec(estilos)![1];
  const xfs = bloco.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [];
  return new Set(xfs.flatMap((xf, i) => (xf.includes(`fillId="${amarelo}"`) ? [i] : [])));
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

  it("deixa selecionar e formatar as células, que é como se preenche", async () => {
    const folha = await (await padrao()).file(ALINHAMENTO)!.async("string");
    const protecao = /<sheetProtection [^>]*>/.exec(folha)![0];

    // Ao contrário do que as caixas do Excel dão a entender, aqui `1` é «não
    // deixa»: com estes dois atributos a folha não se conseguia sequer clicar.
    expect(protecao).not.toContain("selectLockedCells");
    expect(protecao).not.toContain("selectUnlockedCells");
    expect(protecao).toContain('formatCells="0"');
    // E o que se veda é mexer na estrutura do formulário.
    expect(protecao).toContain('insertRows="1"');
    expect(protecao).toContain('deleteRows="1"');
  });

  it("deixa editáveis as medidas que a aplicação pergunta, e nada mais", async () => {
    const zip = await padrao();
    const folha = await zip.file(ALINHAMENTO)!.async("string");
    const abertas = editaveis(folha, estilosAbertos(await zip.file(ESTILOS)!.async("string")));

    // Uma célula por medida perguntada, e a data da única que admite
    // comprometer-se com um prazo. O que a aplicação não pergunta fica
    // trancado, como as respostas fixas.
    expect(abertas.sort()).toEqual(["E10", "E26", "E42", "E44", "E6", "E8", "F44"].sort());
  });

  it("pinta de amarelo o que se preenche, e só isso", async () => {
    const zip = await padrao();
    const folha = await zip.file(ALINHAMENTO)!.async("string");
    const estilos = await zip.file(ESTILOS)!.async("string");

    const abertas = editaveis(folha, estilosAbertos(estilos));
    const amarelas = editaveis(folha, estilosRealcados(estilos));

    expect(amarelas.sort()).toEqual(abertas.sort());

    // O amarelo é um fundo novo, e o `fills` há de contá-lo.
    const fills = /<fills count="(\d+)">([\s\S]*?)<\/fills>/.exec(estilos)!;
    expect((fills[2].match(/<fill>|<fill\/>/g) ?? []).length).toBe(Number(fills[1]));
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

  it("não toca nas outras folhas", async () => {
    const antes = await JSZip.loadAsync(modelo());
    const depois = await padrao();

    for (const nome of ["xl/worksheets/sheet2.xml", "xl/worksheets/sheet8.xml", "xl/sharedStrings.xml"]) {
      expect(await depois.file(nome)!.async("string")).toBe(await antes.file(nome)!.async("string"));
    }
  });

  it("oferece em cada medida as opções que a aplicação oferece, e só essas", async () => {
    const folha = await (await padrao()).file(ALINHAMENTO)!.async("string");

    for (const medida of medidasPerguntadas()) {
      const lista = new RegExp(
        `<dataValidation type="list"[^>]*sqref="([^"]*\\bE${medida.linha}\\b[^"]*)"[^>]*>` +
          `<formula1>"([^"]*)"</formula1>`,
      ).exec(folha);

      expect(lista?.[2].split(",")).toEqual(medida.opcoes);
    }

    // As medidas que a aplicação não pergunta ficam com a lista do modelo, que
    // aponta à folha «Backup» — trancadas, mas intactas.
    expect(folha).toContain("Backup!$B$7:$B$11");
    // A da usabilidade deixou de ser a do modelo: passou a ter a sua.
    expect(folha).not.toContain("Backup!$B$13:$B$17");
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
