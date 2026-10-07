import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { gerarEavaliaBlob } from "./eavalia";
import { numeroRomano, recursosDoProcedimento } from "./custosServicos";
import { FOLHA_CUSTOS_SERVICOS } from "./eavaliaModelo";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { DESIGNACOES_PERFIL, TIPOS_SERVICO, type LotesJSON, type PerfilEmLote } from "../core/types";
import { perfil } from "../core/fixtures";

const QUANDO = new Date("2026-08-26T10:00:00");

async function bytesDe(config: LotesJSON): Promise<Uint8Array> {
  return new Uint8Array(await (await gerarEavaliaBlob(config, QUANDO)).arrayBuffer());
}

// O livro tem folhas de quase um megabyte: lê-se uma vez por agrupamento.
const lidos = new Map<LotesJSON, Promise<ExcelJS.Workbook>>();

function livroDe(config: LotesJSON): Promise<ExcelJS.Workbook> {
  if (!lidos.has(config)) {
    lidos.set(
      config,
      bytesDe(config).then(async (bytes) => {
        const livro = new ExcelJS.Workbook();
        await livro.xlsx.load(bytes.buffer as ArrayBuffer);
        return livro;
      }),
    );
  }
  return lidos.get(config)!;
}

async function folhaDosCustos(config: LotesJSON): Promise<ExcelJS.Worksheet> {
  return (await livroDe(config)).getWorksheet("Custos - Serviços")!;
}

/** Um agrupamento com `n` perfis distintos, num lote só. */
function comPerfis(n: number): LotesJSON {
  const perfis: PerfilEmLote[] = Array.from({ length: n }, (_v, i) => ({
    id: `e${i + 1}`,
    perfil: perfil({ id: `p${i + 1}`, perfil: `Perfil ${i + 1}` }),
    horas: 100 + i,
    horasPorAno: [100 + i, 0, 0],
    valorHora: 30,
    nMinimoElementos: 1,
  }));
  return {
    ...LOTES_EXEMPLO,
    encargosPlurianuais: { ativo: false, anoInicio: 2026 },
    lotes: [{ id: "l1", numero: "1", designacao: "Lote único", perfis }],
  };
}

describe("recursosDoProcedimento", () => {
  it("dá um recurso por perfil em cada lote, com as horas de todos os elementos e de todos os anos", () => {
    const recursos = recursosDoProcedimento(LOTES_EXEMPLO);

    expect(recursos).toHaveLength(4);
    expect(recursos[0]).toEqual({
      tipo: "Desenvolvimento de SW",
      perfil: "Programador",
      descricao: "Programador Sénior — Java",
      valorHora: 42,
      // 2 elementos × (1760 + 880 + 880) horas.
      horas: 2 * 3520,
    });
    expect(recursos[2]).toMatchObject({ perfil: "Arquiteto", tipo: "Trabalhos especializados - SW", horas: 1760 });
  });

  it("sem pedido plurianual, as horas são as do contrato de um ano", () => {
    const anual = { ...LOTES_EXEMPLO, encargosPlurianuais: { ativo: false, anoInicio: 2026 } };
    expect(recursosDoProcedimento(anual)[0].horas).toBe(2 * 1760);
  });

  it("um perfil em dois lotes dá dois recursos, cada um com o seu lote na descrição", () => {
    const [lote1, lote2] = LOTES_EXEMPLO.lotes;
    const repetido = { ...lote2, perfis: [...lote2.perfis, { ...lote1.perfis[0], id: "l2-p1", valorHora: 40 }] };
    const recursos = recursosDoProcedimento({ ...LOTES_EXEMPLO, lotes: [lote1, repetido] });

    expect(recursos.map((r) => r.descricao)).toEqual([
      "Programador Sénior — Java (Lote 1)",
      "Programador Front-end",
      "Arquiteto de Integração",
      "Engenheiro de Dados",
      "Programador Sénior — Java (Lote 2)",
    ]);
  });
});

describe("numeroRomano", () => {
  it("numera como o modelo", () => {
    expect([1, 4, 5, 9, 11, 14, 40].map(numeroRomano)).toEqual(["I", "IV", "V", "IX", "XI", "XIV", "XL"]);
  });
});

describe("folha «Custos - Serviços» do eAvalia", () => {
  it("passa a ver-se; as outras folhas ocultas continuam ocultas", async () => {
    const livro = await livroDe(LOTES_EXEMPLO);
    const estado = (nome: string) => livro.getWorksheet(nome)!.state;

    expect(estado("Custos - Serviços")).toBe("visible");
    expect(estado("Custos - Bens")).toBe("hidden");
    expect(estado("Custos - Lic_Hist")).toBe("hidden");
    expect(estado("Backup")).toBe("hidden");
  });

  it("preenche um bloco por perfil, com a fórmula do custo total já calculada", async () => {
    const folha = await folhaDosCustos(LOTES_EXEMPLO);

    expect(folha.getCell("B7").value).toBe("Desenvolvimento de SW");
    expect(folha.getCell("D7").value).toBe("Programador");
    expect(folha.getCell("F7").value).toBe("Programador Sénior — Java");
    expect(folha.getCell("B9").value).toBe(42);
    expect(folha.getCell("D9").value).toBe(7040);
    expect(folha.getCell("F9").value).toEqual({ formula: 'IF(OR(B9="",D9=""),"",B9*D9)', result: 42 * 7040 });

    // O quarto perfil, no quarto bloco.
    expect(folha.getCell("D22").value).toBe("Especialistas de sistemas (redes, base de dados e ambientes)");
    // O quinto bloco fica por usar, com a fórmula do modelo intacta.
    expect(folha.getCell("B27").value).toBeNull();
    expect(folha.getCell("F29").value).toMatchObject({ formula: 'IF(OR(B29="",D29=""),"",B29*D29)' });
  });

  it("a soma dos custos totais é o preço base sem IVA", async () => {
    const folha = await folhaDosCustos(LOTES_EXEMPLO);
    const custos = [9, 14, 19, 24].map((l) => (folha.getCell(`F${l}`).value as { result: number }).result);
    // 42×7040 + 38×1760 + 55×1760 + 45×2×1760
    expect(custos.reduce((a, b) => a + b, 0)).toBe(42 * 7040 + 38 * 1760 + 55 * 1760 + 45 * 3520);
  });

  it("numera os blocos I a XI, sem o «Recurso II» repetido do modelo", async () => {
    const folha = await folhaDosCustos(LOTES_EXEMPLO);
    const cabecalhos = Array.from({ length: 11 }, (_v, i) => folha.getCell(`A${6 + 5 * i}`).value);
    expect(cabecalhos).toEqual(Array.from({ length: 11 }, (_v, i) => `Recurso ${numeroRomano(i + 1)}`));
  });

  it("um perfil sem as listas do eAvalia escolhidas deixa essas células por preencher", async () => {
    const config = comPerfis(1);
    config.lotes[0].perfis[0].perfil = { ...config.lotes[0].perfis[0].perfil, designacao: "", tipoServico: "" };
    const folha = await folhaDosCustos(config);

    expect(folha.getCell("B7").value).toBeNull();
    expect(folha.getCell("D7").value).toBeNull();
    expect(folha.getCell("F7").value).toBe("Perfil 1");
  });

  it("acrescenta blocos quando há mais perfis do que os onze do modelo", async () => {
    const folha = await folhaDosCustos(comPerfis(13));

    expect(folha.getCell("A61").value).toBe("Recurso XII");
    expect(folha.getCell("A66").value).toBe("Recurso XIII");
    expect(folha.getCell("F62").value).toBe("Perfil 12");
    expect(folha.getCell("D69").value).toBe(112);
    expect(folha.getCell("F69").value).toEqual({ formula: 'IF(OR(B69="",D69=""),"",B69*D69)', result: 30 * 112 });
    // A nota do fim desce com os blocos novos.
    expect(String(folha.getCell("A71").value)).toMatch(/^\*Caso necessário/);
    expect(folha.getCell("A61").isMerged).toBe(true);
    expect(folha.getCell("A71").isMerged).toBe(true);
  });

  it("os blocos novos levam as listas, a formatação condicional e a fórmula do modelo", async () => {
    const zip = await JSZip.loadAsync(await bytesDe(comPerfis(12)));
    const xml = await zip.file(FOLHA_CUSTOS_SERVICOS)!.async("string");

    expect(xml).toContain('<dimension ref="A1:F67"/>');
    expect(xml).toMatch(/<xm:sqref>D7 [^<]* D57 D62<\/xm:sqref>/);
    expect(xml).toMatch(/<xm:sqref>B7 [^<]* B57 B62<\/xm:sqref>/);
    expect(xml).toMatch(/sqref="E7 [^"]* E57 E62"/);
    expect(xml).toContain('<conditionalFormatting sqref="D64">');
    expect(xml).toContain('<mergeCell ref="A61:F61"/>');
    expect(xml).toContain('<mergeCell ref="A66:F66"/>');
    // Prioridades da formatação condicional sem repetições.
    const prioridades = [...xml.matchAll(/priority="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(prioridades).size).toBe(prioridades.length);
  });

  it("as listas do modelo são as da aplicação, letra a letra", async () => {
    const backup = (await livroDe(LOTES_EXEMPLO)).getWorksheet("Backup")!;
    const coluna = (de: number, ate: number) =>
      Array.from({ length: ate - de + 1 }, (_v, i) => backup.getCell(`B${de + i}`).value);

    expect(coluna(19, 24)).toEqual([...TIPOS_SERVICO]);
    expect(coluna(26, 34)).toEqual([...DESIGNACOES_PERFIL]);
  });
});
