import { describe, expect, it } from "vitest";
import {
  anosDaDirecao,
  aplicarFiltros,
  comUnidade,
  externosDaDirecao,
  filtrosIniciais,
  haFiltros,
  importarVistaDirecaoJSON,
  internosDaDirecao,
  jaTemUnidade,
  nomeDaUnidade,
  percentagemNaDirecao,
  percentagemNaSuaUnidade,
  perfisDaVista,
  pessoasDaDirecao,
  projetosDaVista,
  rateVariavel,
  ratesPorPerfil,
  semUnidade,
  totaisPorAnoDaDirecao,
  totaisPorAnoDaDirecaoSemIva,
  unidadesDaVista,
  valorDaDirecao,
  vistaDirecaoInicial,
  vistaDirecaoParaJSON,
  type VistaDirecao,
} from "./vistaGeralDirecao";
import { comInterno, orcamentoInicial, type OrcamentoUnidade } from "./vistaGeral";
import { gerarId } from "./id";

/** Uma unidade de teste, escrita à mão: a vista só lê valores já apurados. */
function unidade(
  nome: string,
  projetos: Array<{
    nome: string;
    anoInicio: number;
    internos?: string[];
    entradas: Array<{ lote: string; perfil: string; pessoas: number; rate: number; totais: number[] }>;
  }>,
): OrcamentoUnidade {
  return {
    ...orcamentoInicial(),
    unidade: nome,
    projetos: projetos.map((p) => ({
      id: gerarId(),
      nome: p.nome,
      anoInicio: p.anoInicio,
      entradas: p.entradas.map((e) => ({
        id: gerarId(),
        lote: e.lote,
        perfil: e.perfil,
        pessoas: e.pessoas,
        valorHoraSemIva: e.rate,
        valorHoraComIva: e.rate * 1.23,
        totaisPorAno: e.totais,
      })),
      internos: (p.internos ?? []).map((n) => ({ id: gerarId(), nome: n })),
    })),
  };
}

const DSI = unidade("DSI", [
  {
    nome: "Modernização",
    anoInicio: 2026,
    internos: ["Ana", "Rui"],
    entradas: [
      { lote: "1", perfil: "Programador", pessoas: 2, rate: 40, totais: [1000, 500, 0] },
      { lote: "2", perfil: "Arquiteto", pessoas: 1, rate: 50, totais: [800, 400, 0] },
    ],
  },
  {
    nome: "Portal",
    anoInicio: 2027,
    entradas: [{ lote: "1", perfil: "Programador", pessoas: 1, rate: 45, totais: [600, 300, 0] }],
  },
]);

const DIT = unidade("DIT", [
  {
    nome: "Datacenter",
    anoInicio: 2026,
    internos: ["Carlos"],
    entradas: [{ lote: "1", perfil: "Arquiteto", pessoas: 3, rate: 60, totais: [2000, 0, 0] }],
  },
]);

const VISTA: VistaDirecao = comUnidade(comUnidade(vistaDirecaoInicial(), DSI), DIT);

describe("unidades da direção", () => {
  it("acrescenta cada unidade uma vez, e atualiza-a ao recarregar", () => {
    expect(unidadesDaVista(VISTA)).toEqual(["DSI", "DIT"]);
    expect(jaTemUnidade(VISTA, "DSI")).toBe(true);

    const corrigida = unidade("DSI", [
      { nome: "Modernização", anoInicio: 2026, entradas: [{ lote: "1", perfil: "Programador", pessoas: 9, rate: 40, totais: [1, 0, 0] }] },
    ]);
    const depois = comUnidade(VISTA, corrigida);

    expect(unidadesDaVista(depois)).toEqual(["DSI", "DIT"]);
    expect(externosDaDirecao(depois)).toBe(9 + 3);
  });

  it("uma unidade sem nome fica com um, para a linha não ficar órfã", () => {
    expect(nomeDaUnidade({ ...orcamentoInicial(), unidade: "   " })).toBe("(unidade sem nome)");
  });

  it("remove pelo nome", () => {
    expect(unidadesDaVista(semUnidade(VISTA, "DIT"))).toEqual(["DSI"]);
  });
});

describe("apuramento da direção", () => {
  it("soma as pessoas das unidades, externas e internas", () => {
    expect(externosDaDirecao(VISTA)).toBe(2 + 1 + 1 + 3);
    expect(internosDaDirecao(VISTA)).toBe(3);
    expect(pessoasDaDirecao(VISTA)).toBe(10);
  });

  it("a percentagem de uma unidade é a sua fatia das pessoas da direção", () => {
    // DSI tem 4 externos + 2 internos = 6 das 10 pessoas.
    expect(percentagemNaDirecao(VISTA, DSI)).toBeCloseTo(60);
    expect(percentagemNaDirecao(VISTA, DIT)).toBeCloseTo(40);
  });

  it("dentro de uma unidade, a percentagem é a fatia dessa unidade", () => {
    // «Modernização» tem 3 externos + 2 internos = 5 das 6 pessoas da DSI.
    expect(percentagemNaSuaUnidade(DSI, DSI.projetos[0])).toBeCloseTo((5 / 6) * 100);
  });

  it("cobre os anos de todas as unidades, do mais cedo ao mais tarde", () => {
    expect(anosDaDirecao(VISTA)).toEqual([2026, 2027, 2028, 2029]);
  });

  it("soma os valores ano a ano, e sabe desfazer o IVA", () => {
    const anos = anosDaDirecao(VISTA);
    expect(totaisPorAnoDaDirecao(VISTA, anos)).toEqual([1000 + 800 + 2000, 500 + 400 + 600, 300, 0]);

    const semIva = totaisPorAnoDaDirecaoSemIva(VISTA, anos);
    expect(semIva[0]).toBeCloseTo((1000 + 800 + 2000) / 1.23);
    expect(valorDaDirecao(VISTA, anos)).toBe(5600);
  });
});

describe("filtros", () => {
  it("de início não filtram nada", () => {
    expect(haFiltros(filtrosIniciais())).toBe(false);
    expect(aplicarFiltros(VISTA, filtrosIniciais()).unidades).toHaveLength(2);
  });

  it("por unidade, deixam só essa", () => {
    const so = aplicarFiltros(VISTA, { ...filtrosIniciais(), unidade: "DIT" });
    expect(unidadesDaVista(so)).toEqual(["DIT"]);
    expect(pessoasDaDirecao(so)).toBe(4);
  });

  it("por projeto, deixam só os projetos com esse nome", () => {
    const so = aplicarFiltros(VISTA, { ...filtrosIniciais(), projeto: "Portal" });
    expect(unidadesDaVista(so)).toEqual(["DSI"]);
    expect(so.unidades[0].projetos.map((p) => p.nome)).toEqual(["Portal"]);
  });

  it("por perfil, deixam as linhas desse perfil — e nenhum interno", () => {
    const so = aplicarFiltros(VISTA, { ...filtrosIniciais(), perfil: "Arquiteto" });
    expect(so.unidades.flatMap((u) => u.projetos.flatMap((p) => p.entradas.map((e) => e.perfil)))).toEqual([
      "Arquiteto",
      "Arquiteto",
    ]);
    // Um interno não foi contratado em perfil nenhum: com um perfil escolhido,
    // a pergunta deixou de ser sobre ele.
    expect(internosDaDirecao(so)).toBe(0);
  });

  it("por anos, deixam os projetos que existem em algum deles", () => {
    const so2029 = aplicarFiltros(VISTA, { ...filtrosIniciais(), anos: [2029] });
    expect(so2029.unidades.flatMap((u) => u.projetos.map((p) => p.nome))).toEqual(["Portal"]);

    const so2026 = aplicarFiltros(VISTA, { ...filtrosIniciais(), anos: [2026] });
    expect(so2026.unidades.flatMap((u) => u.projetos.map((p) => p.nome))).toEqual(["Modernização", "Datacenter"]);
  });

  it("as listas de escolha saem da vista por filtrar", () => {
    expect(projetosDaVista(VISTA)).toEqual(["Datacenter", "Modernização", "Portal"]);
    expect(perfisDaVista(VISTA)).toEqual(["Arquiteto", "Programador"]);
  });
});

describe("rates por perfil", () => {
  const anos = anosDaDirecao(VISTA);
  const perfis = ratesPorPerfil(VISTA, anos);

  it("junta as contratações do mesmo perfil, venham de que unidade vierem", () => {
    expect(perfis.map((p) => p.perfil)).toEqual(["Arquiteto", "Programador"]);

    const arquiteto = perfis[0];
    expect(arquiteto.usos.map((u) => `${u.unidade}/${u.projeto}`)).toEqual(["DSI/Modernização", "DIT/Datacenter"]);
    expect(arquiteto.unidades).toBe(2);
    expect(arquiteto.pessoas).toBe(4);
  });

  it("dá o intervalo das rates, e assinala quando não foi sempre a mesma", () => {
    const [arquiteto, programador] = perfis;

    expect(arquiteto.minimoSemIva).toBe(50);
    expect(arquiteto.maximoSemIva).toBe(60);
    expect(arquiteto.minimoComIva).toBeCloseTo(50 * 1.23);
    expect(rateVariavel(arquiteto)).toBe(true);
    expect(rateVariavel(programador)).toBe(true);
  });

  it("a média é ponderada pelas pessoas", () => {
    // Arquiteto: um a 50 € e três a 60 € → (50 + 180) / 4.
    expect(perfis[0].mediaSemIva).toBeCloseTo((50 * 1 + 60 * 3) / 4);
  });

  it("um perfil contratado sempre à mesma rate não tem intervalo", () => {
    const so = aplicarFiltros(VISTA, { ...filtrosIniciais(), unidade: "DIT" });
    expect(rateVariavel(ratesPorPerfil(so, anos)[0])).toBe(false);
  });
});

describe("(des)serialização", () => {
  it("dá a volta completa", () => {
    const texto = vistaDirecaoParaJSON({ ...VISTA, direcao: "DSI/DIT" });
    const lida = importarVistaDirecaoJSON(texto);

    expect(lida.direcao).toBe("DSI/DIT");
    expect(unidadesDaVista(lida)).toEqual(["DSI", "DIT"]);
    expect(pessoasDaDirecao(lida)).toBe(pessoasDaDirecao(VISTA));
  });

  it("recusa um ficheiro que não seja uma vista de direção", () => {
    expect(() => importarVistaDirecaoJSON("{}")).toThrow(/esquema desconhecida/i);
    expect(() => importarVistaDirecaoJSON("não é json")).toThrow(/JSON válido/i);
  });

  it("guarda os elementos internos que as unidades registaram", () => {
    const comNome = comUnidade(vistaDirecaoInicial(), comInterno(DSI, DSI.projetos[1].id, "Marta"));
    const lida = importarVistaDirecaoJSON(vistaDirecaoParaJSON(comNome));

    expect(lida.unidades[0].projetos[1].internos.map((i) => i.nome)).toEqual(["Marta"]);
  });
});
