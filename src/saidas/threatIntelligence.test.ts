// @vitest-environment jsdom
//
// O caso da subscrição de threat intelligence: dois pacotes de utilizadores,
// duas licenças com capacidade diária a preço global (sandbox e API, em
// unidades de volume) e um serviço associado com preço próprio — tudo num
// lote, confiado a determinada entidade.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  criarLicenca,
  fonteVazia,
  lotesEfetivos,
  pedidoLicenciamentoExemplo,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  valorEstimado,
  type Licenca,
  type PedidoLicenciamento,
} from "../core/licenciamento";
import { gerarEavaliaLicenciamentoBlob } from "../excel/eavalia";
import { gerarWorkbookMapaPrecos } from "../excel/mapaPrecos";
import { gerarManifestacaoLicenciamentoBlob } from "../word/manifestacaoLicenciamento";

const QUANDO = new Date("2026-11-12T10:00:00");

function licenca(id: string, nome: string, alteracao: Partial<Licenca>): Licenca {
  return {
    ...criarLicenca(),
    id,
    nomeComercial: nome,
    fabricante: "Recorded Future",
    fundamento: "plataformaInstalada",
    explicacaoFundamento: "A plataforma está em uso no centro de operações de segurança da SPMS.",
    objeto: "software",
    direitoUso: "temporario",
    modalidade: "renovacao",
    periodoMeses: 12,
    periodicidadePreco: "anual",
    eavalia: { tipoSolucao: "Software Proprietário sem alternativas", ambito: "Outro" },
    origemPreco: { ...fonteVazia("orcamento"), entidade: "Recorded Future", data: "2026-10-20" },
    ...alteracao,
  };
}

function pedido(): PedidoLicenciamento {
  const base = pedidoLicenciamentoExemplo(2027);
  const licencas: Licenca[] = [
    licenca("drp", "DRP Solution Package", { metrica: "utilizadorNomeado", quantidade: 2, precoUnitario: 20000 }),
    licenca("cyb", "CyberOps Solution Package", { metrica: "utilizadorNomeado", quantidade: 2, precoUnitario: 25000 }),
    licenca("sbx", "Recorded Future Sandbox enterprise cloud edition", {
      metrica: "volume",
      unidadeVolume: "análises por dia",
      quantidade: 500,
      formaPreco: "global",
      precoUnitario: 30000,
    }),
    licenca("api", "API", {
      metrica: "volume",
      unidadeVolume: "chamadas por dia",
      quantidade: 5000,
      formaPreco: "global",
      precoUnitario: 10000,
    }),
    {
      ...criarLicenca(),
      id: "srv",
      objeto: "servico",
      designacao: "Suporte para adaptar as métricas da plataforma às necessidades da SPMS",
      requisitos: [{ id: "a1", designacao: "Configuração dos indicadores e alertas" }],
      precoUnitario: 8000,
      origemPreco: { ...fonteVazia("orcamento"), entidade: "Recorded Future", data: "2026-10-20" },
    },
  ];
  return {
    ...base,
    nomeProduto: "Threat Intelligence",
    licencas,
    lotes: [{ id: "lote", numero: "1", designacao: "Threat Intelligence", licencaIds: licencas.map((l) => l.id) }],
    encargosPlurianuais: { ativo: false, anoInicio: 2027 },
  };
}

describe("threat intelligence", () => {
  it("valida sem questões e soma licenças e serviço", () => {
    const p = pedido();
    expect([...validarLicencas(p), ...validarCondicoes(p), ...validarPedido(p)]).toEqual([]);
    expect(valorEstimado(p)).toBe(40_000 + 50_000 + 30_000 + 10_000 + 8_000);
  });

  it("mapa: um lote, com a capacidade no preço global e o serviço como linha de preço global", () => {
    const p = pedido();
    const folha = gerarWorkbookMapaPrecos(p, lotesEfetivos(p)[0]).worksheets[0];
    const linhas = [7, 8, 9, 10, 11].map((r) => folha.getRow(r).values as unknown[]);
    expect(linhas.map((v) => v[2])).toEqual([
      "DRP Solution Package — Recorded Future",
      "CyberOps Solution Package — Recorded Future",
      "Recorded Future Sandbox enterprise cloud edition — Recorded Future",
      "API — Recorded Future",
      "Suporte para adaptar as métricas da plataforma às necessidades da SPMS",
    ]);
    expect(linhas[2]).toContain("Preço global — até 500 análises por dia");
    expect(linhas[4]).toContain("€ (preço global)");
  });

  it("eAvalia: quatro blocos de licença, e o serviço na instalação e configuração", async () => {
    const zip = await JSZip.loadAsync(await (await gerarEavaliaLicenciamentoBlob(pedido(), QUANDO)).arrayBuffer());
    const xml = await zip.file("xl/worksheets/sheet5.xml")!.async("string");
    const celula = (ref: string) => new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(xml)?.[0] ?? "";
    expect(celula("K5")).toContain("Software Proprietário sem alternativas");
    expect(celula("N5")).not.toContain("<is>");
    expect(celula("B42")).toContain("<v>8000</v>");
    expect(celula("B46")).toMatch(/<v>8000<\/v>/);
  });

  it("Word: serviços associados no Anexo III, e já sem entregáveis", async () => {
    const zip = await JSZip.loadAsync(await (await gerarManifestacaoLicenciamentoBlob(pedido(), QUANDO)).arrayBuffer());
    const texto = (await zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
    expect(texto).toContain("A aquisição inclui ainda os seguintes serviços associados, com preço próprio");
    expect(texto).toContain("Serviços associados");
    expect(texto).toContain("Atividades do serviço");
    expect(texto).not.toContain("Entregáveis");
    expect(texto).toContain("até 500 análises por dia");
    expect(texto).toContain("No preço global, a quantidade indica a dimensão da licença");
  });
});
