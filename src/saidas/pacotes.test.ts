import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  ficheirosDaAvaliacao,
  ficheirosDaOrdenacao,
  ficheirosDaVistaGeral,
  ficheirosDasPecas,
  ficheirosDosPerfis,
  nomeDoPacoteDaVistaGeral,
  nomeDoPacoteDeAvaliacao,
  nomeDoPacoteDeOrdenacao,
  nomeDoPacoteDePecas,
  nomeDoPacoteDePerfis,
} from "./pacotes";
import { carimboDeData, emPasta, nomeDoPacote } from "../ui/pacote";
import { DESCRICAO_PROJETO_EXEMPLO, LOTES_EXEMPLO, NOME_PROJETO_EXEMPLO, PERFIS_EXEMPLO } from "../core/exemplo";
import { normalizarLotesGuardados } from "../core/lotes";
import { avaliarProcedimento } from "../core/avaliacaoProcedimento";
import { ordenarPropostas } from "../core/ordenacao";
import {
  comInterno,
  comProjeto,
  orcamentoInicial,
  projetoDeAgrupamento,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import type { LotesJSON } from "../core/types";

const QUANDO = new Date("2026-08-26T10:00:00");

function config(alteracoes: Partial<LotesJSON> = {}): LotesJSON {
  return normalizarLotesGuardados({ ...LOTES_EXEMPLO, ...alteracoes });
}

function nomes(ficheiros: { nome: string }[]): string[] {
  return ficheiros.map((f) => f.nome);
}

describe("carimboDeData", () => {
  it("é DDMMAAAA, sempre com oito dígitos", () => {
    expect(carimboDeData(new Date("2026-08-26T10:00:00"))).toBe("26082026");
    expect(carimboDeData(new Date("2027-01-02T10:00:00"))).toBe("02012027");
  });
});

describe("nomeDoPacote", () => {
  it("junta o dono, o assunto e a data, e limpa o nome", () => {
    expect(nomeDoPacote("Modernização dos SI", "Perfis", QUANDO)).toBe("Modernizacao_dos_SI_Perfis_26082026.zip");
  });

  it("sem nome, usa a alternativa em vez de deixar o nome a começar por _", () => {
    expect(nomeDoPacote("   ", "Perfis", QUANDO)).toBe("Projeto_Perfis_26082026.zip");
    expect(nomeDoPacote("", "Vista_Geral", QUANDO, "Unidade")).toBe("Unidade_Vista_Geral_26082026.zip");
  });
});

describe("nomes dos pacotes de cada módulo", () => {
  it("cada módulo tem o seu assunto", () => {
    expect(nomeDoPacoteDePerfis("SClínico", QUANDO)).toBe("SClinico_Perfis_26082026.zip");
    expect(nomeDoPacoteDePecas("SClínico", QUANDO)).toBe("SClinico_Pecas_do_Procedimento_26082026.zip");
    expect(nomeDoPacoteDeAvaliacao("SClínico", QUANDO)).toBe("SClinico_Analise_de_Propostas_26082026.zip");
    expect(nomeDoPacoteDeOrdenacao("SClínico", QUANDO)).toBe("SClinico_Ordenacao_de_Propostas_26082026.zip");
  });
});

describe("pacote dos perfis", () => {
  it("leva o Excel e o JSON", async () => {
    const ficheiros = await ficheirosDosPerfis(PERFIS_EXEMPLO, NOME_PROJETO_EXEMPLO, DESCRICAO_PROJETO_EXEMPLO);
    expect(nomes(ficheiros)).toEqual([
      "Modernizacao_dos_Sistemas_de_Informacao_Perfis.xlsx",
      "Modernizacao_dos_Sistemas_de_Informacao_Perfis.json",
    ]);
  });
});

describe("pacote das peças do procedimento", () => {
  it("leva os dois Word, o eAvalia, o JSON dos lotes, um formulário por lote e os perfis", async () => {
    const ficheiros = await ficheirosDasPecas(config(), PERFIS_EXEMPLO, NOME_PROJETO_EXEMPLO, QUANDO);
    const lista = nomes(ficheiros);

    expect(lista.filter((n) => n.endsWith(".docx"))).toHaveLength(2);
    expect(lista.some((n) => n.includes("Requisitos_e_regras.docx"))).toBe(true);
    // O exemplo tem encargos plurianuais: a informação que sai é o pedido.
    expect(lista.some((n) => n.includes("Pedido_Trienio.docx"))).toBe(true);
    expect(lista.some((n) => n.startsWith("Pedido_PPP_eavalia_"))).toBe(true);
    expect(lista.some((n) => n.endsWith("_Lotes.json"))).toBe(true);

    // Um formulário por lote com perfis: o exemplo tem dois.
    expect(lista.filter((n) => n.startsWith("Resumos Curriculares/"))).toHaveLength(2);
    // E os ficheiros do Módulo 1, numa pasta à parte.
    expect(lista.filter((n) => n.startsWith("Perfis/"))).toHaveLength(2);
  });

  it("sem encargos plurianuais sai a manifestação de necessidades, e não o pedido", async () => {
    const semPlurianual = config();
    semPlurianual.encargosPlurianuais = { ativo: false, anoInicio: 2026 };

    const lista = nomes(await ficheirosDasPecas(semPlurianual, PERFIS_EXEMPLO, NOME_PROJETO_EXEMPLO, QUANDO));

    expect(lista.filter((n) => n.endsWith(".docx"))).toHaveLength(2);
    expect(lista.some((n) => n.includes("Manifestacao_de_Necessidades.docx"))).toBe(true);
    expect(lista.some((n) => n.includes("Pedido_Trienio.docx"))).toBe(false);
  });

  it("um lote sem perfis não dá formulário nenhum", async () => {
    const semPerfis = config();
    semPerfis.lotes = semPerfis.lotes.map((lote) => ({ ...lote, perfis: [] }));

    const lista = nomes(await ficheirosDasPecas(semPerfis, PERFIS_EXEMPLO, NOME_PROJETO_EXEMPLO, QUANDO));
    expect(lista.filter((n) => n.startsWith("Resumos Curriculares/"))).toEqual([]);
  });
});

describe("pacotes da avaliação e da ordenação", () => {
  function apuramento() {
    const c = config();
    return { config: c, resultado: avaliarProcedimento(c, [], []) };
  }

  it("a avaliação leva o relatório e o JSON", async () => {
    const { config: c, resultado } = apuramento();
    const lista = nomes(await ficheirosDaAvaliacao(resultado, c));

    expect(lista.some((n) => n.endsWith("_Resultados_Avaliacao.xlsx"))).toBe(true);
    expect(lista.some((n) => n.endsWith("_Resultados_Avaliacao.json"))).toBe(true);
    expect(lista).toHaveLength(2);
  });

  it("a ordenação leva os mesmos, mais o relatório com a ordenação", async () => {
    const { config: c, resultado } = apuramento();
    const ordenacao = ordenarPropostas(resultado, {});
    const lista = nomes(await ficheirosDaOrdenacao(resultado, c, ordenacao));

    expect(lista).toHaveLength(3);
    expect(lista.some((n) => n.endsWith("_Resultados_e_Ordenacao.xlsx"))).toBe(true);
    // O pacote maior não pode divergir do menor.
    for (const n of nomes(await ficheirosDaAvaliacao(resultado, c))) expect(lista).toContain(n);
  });
});

describe("pacote da Vista Geral", () => {
  function comProjetos(anos: number[]): OrcamentoUnidade {
    let orcamento = orcamentoInicial();
    for (const ano of anos) {
      const c = config({ nomeProjeto: `Projeto ${ano}` });
      c.encargosPlurianuais = { ativo: true, anoInicio: ano };
      orcamento = comProjeto(orcamento, projetoDeAgrupamento(c));
    }
    return { ...orcamento, unidade: "PACE" };
  }

  it("o nome leva os anos de início, em dois dígitos", () => {
    expect(nomeDoPacoteDaVistaGeral(comProjetos([2026, 2027, 2028]), QUANDO)).toBe(
      "PACE_Vista_Geral_26_27_28_26082026.zip",
    );
  });

  it("anos de início repetidos contam uma vez, e saem por ordem", () => {
    expect(nomeDoPacoteDaVistaGeral(comProjetos([2028, 2026, 2028]), QUANDO)).toBe(
      "PACE_Vista_Geral_26_28_26082026.zip",
    );
  });

  it("sem projetos, o nome não fica com anos a mais nem a menos", () => {
    expect(nomeDoPacoteDaVistaGeral({ ...orcamentoInicial(), unidade: "PACE" }, QUANDO)).toBe(
      "PACE_Vista_Geral_26082026.zip",
    );
  });

  it("leva o Excel e o JSON, e o JSON traz os elementos internos", async () => {
    let orcamento = comProjetos([2027]);
    orcamento = comInterno(orcamento, orcamento.projetos[0].id, "Ana Silva");
    const ficheiros = await ficheirosDaVistaGeral(orcamento);

    expect(nomes(ficheiros)).toEqual(["PACE_Vista_Geral.xlsx", "PACE_Vista_Geral.json"]);
    expect(await (ficheiros[1].conteudo as Blob).text()).toContain("Ana Silva");
  });
});

describe("empacotamento", () => {
  it("emPasta prefixa os nomes sem lhes tocar no conteúdo", () => {
    const dentro = emPasta("Perfis", [{ nome: "a.json", conteudo: "x" }]);
    expect(dentro).toEqual([{ nome: "Perfis/a.json", conteudo: "x" }]);
  });

  it("o ZIP fica legível, com as pastas que lhe foram dadas", async () => {
    const zip = new JSZip();
    for (const f of await ficheirosDasPecas(config(), PERFIS_EXEMPLO, NOME_PROJETO_EXEMPLO, QUANDO)) {
      zip.file(f.nome, typeof f.conteudo === "string" ? f.conteudo : await f.conteudo.arrayBuffer());
    }
    const relido = await JSZip.loadAsync(await zip.generateAsync({ type: "arraybuffer" }));
    const dentro = Object.keys(relido.files).filter((n) => !relido.files[n].dir);

    expect(dentro.some((n) => n.startsWith("Perfis/"))).toBe(true);
    expect(dentro.some((n) => n.startsWith("Resumos Curriculares/"))).toBe(true);
    // Os .docx e .xlsx continuam a ser ZIP válidos depois de aninhados.
    const word = dentro.find((n) => n.endsWith("Requisitos_e_regras.docx"))!;
    const interior = await JSZip.loadAsync(await relido.file(word)!.async("arraybuffer"));
    expect(Object.keys(interior.files)).toContain("word/document.xml");
  });
});
