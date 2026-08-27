import { describe, expect, it } from "vitest";
import {
  LIMIAR_VALOR_SEM_IVA,
  anosAcimaDoLimiar,
  comHorasDoAno,
  comHorasTotais,
  criarLote,
  criarPerfilEmLote,
  horasPorAnoDe,
  precoBaseEntrada,
  importarLotesJSON,
  linhasTabelaValores,
  lotesIniciais,
  lotesParaJSON,
  nomeProcedimentoDe,
  normalizarLotesGuardados,
  perfisComCertificacao,
  totaisPorAnoPlurianual,
  totaisPorAnoSemIva,
  validarEavalia,
  validarPostoTrabalho,
  totalLote,
  totalProcedimento,
  validarLotes,
} from "./lotes";
import { ErroImportacao } from "./perfil";
import {
  REQUISITOS_EQUIPAMENTO_PADRAO,
  TAXA_IVA_PADRAO,
  informacaoEavaliaInicial,
  postoTrabalhoInicial,
} from "./types";
import { certificacoes, lotesComPerfis, perfil } from "./fixtures";
import type { LotesJSON, PerfilEmLote } from "./types";

function lotesExemplo(): LotesJSON {
  return lotesComPerfis([
    { numero: "1", perfis: [perfil({ perfil: "Programador Sénior" })] },
    { numero: "2", perfis: [perfil({ perfil: "Analista" })] },
  ]);
}

describe("validarLotes", () => {
  it("aceita um agrupamento completo", () => {
    expect(validarLotes(lotesExemplo())).toHaveLength(0);
  });

  it("exige pelo menos um lote", () => {
    expect(validarLotes(lotesIniciais()).some((e) => e.campo === "lotes")).toBe(true);
  });

  it("rejeita números de lote repetidos", () => {
    const config = lotesExemplo();
    config.lotes[1].numero = config.lotes[0].numero;
    expect(validarLotes(config).some((e) => e.mensagem.includes("repetido"))).toBe(true);
  });

  it("exige a designação do lote — dá nome ao ficheiro de formulários", () => {
    const config = lotesExemplo();
    config.lotes[0].designacao = "   ";
    expect(validarLotes(config).some((e) => e.campo === "lotes[0].designacao")).toBe(true);
  });

  it("exige horas e valor/hora positivos", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].horas = 0;
    config.lotes[0].perfis[0].valorHora = -5;

    const erros = validarLotes(config);
    expect(erros.some((e) => e.campo.includes("horas"))).toBe(true);
    expect(erros.some((e) => e.campo.includes("valorHora"))).toBe(true);
  });

  it("exige um lote com pelo menos um perfil", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis = [];
    expect(validarLotes(config).some((e) => e.campo.includes("perfis"))).toBe(true);
  });
});

describe("preço base", () => {
  it("calcula o valor de cada perfil como n.º mínimo de elementos × horas × valor/hora", () => {
    const linhas = linhasTabelaValores(lotesExemplo());
    expect(linhas).toHaveLength(2);
    expect(linhas[0].valores.semIva).toBe(2 * 100 * 50);
  });

  it("o n.º mínimo de elementos multiplica o preço base", () => {
    const config = lotesExemplo();
    config.lotes[0].perfis[0].nMinimoElementos = 7;
    expect(linhasTabelaValores(config)[0].valores.semIva).toBe(7 * 100 * 50);
  });

  it("soma por lote e por procedimento", () => {
    const config = lotesExemplo();
    expect(totalLote(config.lotes[0], 23).semIva).toBe(10000);
    expect(totalProcedimento(config).semIva).toBe(20000);
  });
});

describe("importação/exportação de lotes", () => {
  it("repõe o estado completo (ida e volta)", () => {
    const original = lotesExemplo();
    expect(importarLotesJSON(lotesParaJSON(original))).toEqual(original);
  });

  it("rejeita um ficheiro de perfil carregado como lotes", () => {
    expect(() => importarLotesJSON(JSON.stringify(perfil()))).toThrow(/não um agrupamento/i);
  });

  it("rejeita schemaVersion desconhecida", () => {
    const antigo = JSON.stringify({ ...lotesExemplo(), schemaVersion: "1.0" });
    expect(() => importarLotesJSON(antigo)).toThrow(ErroImportacao);
  });
});

describe("IVA", () => {
  it("aplica a taxa configurada sobre a base tributável", () => {
    const config = lotesExemplo();
    config.taxaIva = 23;

    const linha = linhasTabelaValores(config)[0];
    expect(linha.valores.semIva).toBe(10000);
    expect(linha.valores.iva).toBeCloseTo(2300, 6);
    expect(linha.valores.comIva).toBeCloseTo(12300, 6);
  });

  it("uma taxa de zero deixa o valor com IVA igual ao valor sem IVA", () => {
    const config = lotesExemplo();
    config.taxaIva = 0;
    expect(totalProcedimento(config).comIva).toBe(totalProcedimento(config).semIva);
  });

  it("assume a taxa por omissão em ficheiros anteriores, que não a tinham", () => {
    const semTaxa = { ...lotesExemplo() } as Record<string, unknown>;
    delete semTaxa.taxaIva;

    const importado = importarLotesJSON(JSON.stringify(semTaxa));
    expect(importado.taxaIva).toBe(TAXA_IVA_PADRAO);
  });
});

describe("perfisComCertificacao", () => {
  it("assinala só os perfis que exigem certificação, com o lote onde estão", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ perfil: "Programador", certificacoes: certificacoes("Certificação A", "Certificação B") })] },
      { numero: "2", perfis: [perfil({ perfil: "Analista" })] },
    ]);

    expect(perfisComCertificacao(config)).toEqual([
      {
        loteNumero: "1",
        loteDesignacao: "Lote 1",
        perfil: "Programador",
        certificacoes: ["Certificação A", "Certificação B"],
      },
    ]);
  });

  it("o agrupamento exportado leva as certificações, para o Módulo 3 poder avisar", () => {
    const config = lotesComPerfis([
      { numero: "1", perfis: [perfil({ certificacoes: certificacoes("Certificação A") })] },
    ]);

    expect(perfisComCertificacao(importarLotesJSON(lotesParaJSON(config)))).toHaveLength(1);
  });
});

describe("nomeProcedimentoDe", () => {
  it("é o nome do projeto precedido da fórmula da entidade", () => {
    expect(nomeProcedimentoDe("Portal do Utente")).toBe(
      "Aquisição de Serviços de Desenvolvimento e Manutenção do projeto Portal do Utente",
    );
  });

  it("sem projeto não há procedimento: meio nome numa peça é pior do que nenhum", () => {
    expect(nomeProcedimentoDe("")).toBe("");
    expect(nomeProcedimentoDe("   ")).toBe("");
  });

  it("não deixa passar espaço a mais de quem escreveu o nome do projeto", () => {
    expect(nomeProcedimentoDe("  Portal do Utente  ")).toBe(
      "Aquisição de Serviços de Desenvolvimento e Manutenção do projeto Portal do Utente",
    );
  });
});

describe("normalizarLotesGuardados", () => {
  it("põe em dia o texto de partida antigo que ninguém chegou a tocar", () => {
    const antigo = [
      "Computador com mínimo:",
      "Arquitetura x86-64, com pelo menos 10 núcleos físicos (Cores) e 12 threads.",
      "Frequência de relógio base de 1.30 GHz ou superior, com capacidade de Turbo Boost até 4.60 GHz.",
      "32 GB de memória RAM",
      "Unidade de disco rígido de estado sólido (SSD) com capacidade mínima de 500 GB.",
      "Wi-Fi 6",
    ].join("\n");
    const base = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);

    const posto = normalizarLotesGuardados({
      ...base,
      postoTrabalho: { ...base.postoTrabalho, requisitosEquipamento: antigo },
    }).postoTrabalho;

    expect(posto.requisitosEquipamento).toBe(REQUISITOS_EQUIPAMENTO_PADRAO);
    expect(posto.requisitosEquipamento).toContain("Placa de vídeo dedicada com 12 GB");
  });

  it("mas não mexe no texto que alguém ajustou", () => {
    const meu = "Computador com mínimo:\nO que a equipa já tem.";
    const base = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);

    expect(
      normalizarLotesGuardados({
        ...base,
        postoTrabalho: { ...base.postoTrabalho, requisitosEquipamento: meu },
      }).postoTrabalho.requisitosEquipamento,
    ).toBe(meu);
  });

  it("e trata o resto do posto de trabalho e do eAvalia", () => {
    const base = lotesComPerfis([{ numero: "1", perfis: [perfil()] }]);
    const guardado = {
      ...base,
      // Como ficaria gravado por uma versão anterior: listas, e um regime que
      // deixou de existir.
      postoTrabalho: { regimes: ["Teletrabalho"], equipamentos: ["Equipamentos da SPMS"] },
      eavalia: { iap: "Inventada" },
    } as unknown as LotesJSON;

    const posto = normalizarLotesGuardados(guardado);

    expect(posto.postoTrabalho.regime).toBe("Híbrido");
    expect(posto.postoTrabalho.equipamento).toBe("Equipamentos da SPMS");
    expect(posto.eavalia.iap).toBe("");
  });
});

describe("validarPostoTrabalho", () => {
  function posto(alteracoes: Partial<ReturnType<typeof postoTrabalhoInicial>> = {}) {
    return { ...postoTrabalhoInicial(), ...alteracoes };
  }

  it("aceita o posto de trabalho de partida", () => {
    expect(validarPostoTrabalho(posto())).toHaveLength(0);
  });

  it("exige o local quando o regime tem local", () => {
    expect(validarPostoTrabalho(posto({ regime: "Presencial", locais: [] }))).toHaveLength(1);
    expect(validarPostoTrabalho(posto({ regime: "Híbrido", locais: [] }))).toHaveLength(1);
  });

  it("não pede local em regime remoto — não há sítio a indicar", () => {
    expect(validarPostoTrabalho(posto({ regime: "Remoto", locais: [] }))).toHaveLength(0);
  });

  it("exige saber qual é o outro local", () => {
    const erros = validarPostoTrabalho(posto({ locais: ["Outro"], outroLocal: "  " }));

    expect(erros.map((e) => e.campo)).toEqual(["postoTrabalho.outroLocal"]);
  });

  it("exige os requisitos quando o equipamento é do prestador", () => {
    const erros = validarPostoTrabalho(posto({ requisitosEquipamento: "" }));

    expect(erros.map((e) => e.campo)).toEqual(["postoTrabalho.requisitosEquipamento"]);
  });

  it("não os pede quando o equipamento é da SPMS — não é a ela que se exigem", () => {
    const semRequisitos = posto({ equipamento: "Equipamentos da SPMS", requisitosEquipamento: "" });

    expect(validarPostoTrabalho(semRequisitos)).toHaveLength(0);
  });
});

describe("validarEavalia", () => {
  it("exige as três respostas", () => {
    expect(validarEavalia(informacaoEavaliaInicial())).toHaveLength(3);
  });

  it("aponta a medida que ficou por responder", () => {
    const erros = validarEavalia({ iap: "Já cumpre", chaveMovelDigital: "", idiomas: "Não aplicável" });

    expect(erros.map((e) => e.campo)).toEqual(["eavalia.chaveMovelDigital"]);
  });

  it("aceita quando todas estão respondidas", () => {
    const respondido = { iap: "Já cumpre", chaveMovelDigital: "Não aplicável", idiomas: "Cumpre Parcialmente" } as const;

    expect(validarEavalia(respondido)).toHaveLength(0);
  });
});

describe("o agrupamento só está completo com o posto de trabalho e o eAvalia", () => {
  it("as duas secções travam a exportação enquanto estiverem por preencher", () => {
    const config = lotesExemplo();
    const incompleto = {
      ...config,
      postoTrabalho: { ...config.postoTrabalho, locais: [] },
      eavalia: informacaoEavaliaInicial(),
    };

    expect(validarLotes(config)).toHaveLength(0);
    // Pela ordem por que os painéis aparecem no Módulo 2.
    expect(validarLotes(incompleto).map((e) => e.campo)).toEqual([
      "postoTrabalho.locais",
      "eavalia.iap",
      "eavalia.chaveMovelDigital",
      "eavalia.idiomas",
    ]);
  });
});

describe("horas e repartição por anos", () => {
  function entrada(alteracoes: Partial<PerfilEmLote> = {}): PerfilEmLote {
    return { ...criarPerfilEmLote(perfil()), nMinimoElementos: 2, valorHora: 42, ...alteracoes };
  }

  it("escrever as horas de um ano refaz o total", () => {
    let e = entrada();
    e = { ...e, ...comHorasDoAno(e, 0, 1000) };
    e = { ...e, ...comHorasDoAno(e, 1, 500) };
    e = { ...e, ...comHorasDoAno(e, 2, 250) };

    expect(e.horasPorAno).toEqual([1000, 500, 250]);
    expect(e.horas).toBe(1750);
  });

  it("escrever o total reparte-o pelos anos, em vez de deixar lá a repartição antiga", () => {
    // Sem isto, desligar o pedido plurianual, corrigir o total e voltar a
    // ligá-lo repunha os anos antigos por cima do número acabado de escrever —
    // e as peças saíam com o preço base feito de um e a tabela dos anos do outro.
    let e = entrada();
    e = { ...e, ...comHorasDoAno(e, 0, 1000) };
    e = { ...e, ...comHorasDoAno(e, 1, 500) };
    e = { ...e, ...comHorasDoAno(e, 2, 250) };

    const depois = { ...e, ...comHorasTotais(800) };
    expect(depois.horas).toBe(800);
    expect(depois.horasPorAno!.reduce((soma, h) => soma + h, 0)).toBe(800);
    expect(horasPorAnoDe(depois).reduce((soma, h) => soma + h, 0)).toBe(800);
  });

  it("o total e a repartição nunca discordam, seja qual for a ordem das edições", () => {
    const passos: Array<(e: PerfilEmLote) => PerfilEmLote> = [
      (e) => ({ ...e, ...comHorasTotais(1840) }),
      (e) => ({ ...e, ...comHorasDoAno(e, 1, 600) }),
      (e) => ({ ...e, ...comHorasTotais(900) }),
      (e) => ({ ...e, ...comHorasDoAno(e, 2, 0) }),
      (e) => ({ ...e, ...comHorasTotais(0) }),
    ];

    let e = entrada();
    for (const passo of passos) {
      e = passo(e);
      expect(horasPorAnoDe(e).reduce((soma, h) => soma + h, 0)).toBe(e.horas);
      // E o preço base é sempre o do total que está no campo.
      expect(precoBaseEntrada(e)).toBe(2 * e.horas * 42);
    }
  });

  it("zero horas não deixa resto nenhum espalhado pelos anos", () => {
    expect(comHorasTotais(0).horasPorAno).toEqual([0, 0, 0]);
  });
});

describe("limiar de valor", () => {
  function comValores(valorHora: number, horasPorAno: number[]): LotesJSON {
    const config = lotesIniciais();
    const lote = criarLote("1");
    const entrada = criarPerfilEmLote(perfil());
    lote.perfis = [
      {
        ...entrada,
        nMinimoElementos: 1,
        valorHora,
        horasPorAno,
        horas: horasPorAno.reduce((soma, h) => soma + h, 0),
      },
    ];
    config.lotes = [lote];
    return config;
  }

  it("sem o pedido plurianual, não aponta anos nenhuns", () => {
    const config = comValores(100, [6000, 6000, 6000]);
    expect(config.encargosPlurianuais.ativo).toBe(false);
    expect(anosAcimaDoLimiar(config)).toEqual([]);
  });

  it("com o pedido ativo, aponta só os anos que excedem o limiar", () => {
    const config = comValores(100, [6000, 4000, 5000]);
    config.encargosPlurianuais = { ativo: true, anoInicio: 2027 };

    // 600 000 € | 400 000 € | 500 000 €, sem IVA.
    expect(anosAcimaDoLimiar(config)).toEqual([
      { ano: 2027, semIva: 600_000 },
      { ano: 2029, semIva: 500_000 },
    ]);
  });

  it("o limiar é excedido, e não apenas atingido", () => {
    const config = comValores(1, [LIMIAR_VALOR_SEM_IVA, 0, 0]);
    config.encargosPlurianuais = { ativo: true, anoInicio: 2027 };
    expect(anosAcimaDoLimiar(config)).toEqual([]);

    const acima = comValores(1, [LIMIAR_VALOR_SEM_IVA + 1, 0, 0]);
    acima.encargosPlurianuais = { ativo: true, anoInicio: 2027 };
    expect(anosAcimaDoLimiar(acima).map((a) => a.ano)).toEqual([2027]);
  });

  it("o n.º mínimo de elementos multiplica o valor do ano", () => {
    const config = comValores(100, [3000, 0, 0]);
    config.encargosPlurianuais = { ativo: true, anoInicio: 2027 };
    expect(anosAcimaDoLimiar(config)).toEqual([]);

    config.lotes[0].perfis[0].nMinimoElementos = 2;
    expect(anosAcimaDoLimiar(config)).toEqual([{ ano: 2027, semIva: 600_000 }]);
  });

  it("o acumulado do procedimento não conta: só o valor de cada ano", () => {
    // 1,2 M€ no total, concentrados: 600 mil no primeiro ano, acima do limiar.
    const concentrado = comValores(100, [6000, 3000, 3000]);
    concentrado.encargosPlurianuais = { ativo: true, anoInicio: 2027 };
    expect(totalProcedimento(concentrado).semIva).toBe(1_200_000);
    expect(anosAcimaDoLimiar(concentrado).map((a) => a.ano)).toEqual([2027]);

    // O mesmo 1,2 M€, repartido por igual: 400 mil por ano, e nenhum excede.
    const repartido = comValores(100, [4000, 4000, 4000]);
    repartido.encargosPlurianuais = { ativo: true, anoInicio: 2027 };
    expect(totalProcedimento(repartido).semIva).toBe(1_200_000);
    expect(anosAcimaDoLimiar(repartido)).toEqual([]);
  });

  it("sem o pedido plurianual não há alerta nenhum, por alto que seja o preço base", () => {
    // O limiar é o da competência para assumir encargos futuros: sem pedido,
    // a despesa cabe num ano e não há compromisso futuro a autorizar.
    const config = comValores(100, [6000, 6000, 6000]);
    expect(config.encargosPlurianuais.ativo).toBe(false);
    expect(totalProcedimento(config).semIva).toBe(1_800_000);
    expect(anosAcimaDoLimiar(config)).toEqual([]);
  });

  it("os totais por ano sem IVA não trazem IVA nenhum", () => {
    const config = comValores(100, [1000, 0, 0]);
    config.taxaIva = 23;
    expect(totaisPorAnoSemIva(config)).toEqual([100_000, 0, 0]);
    expect(totaisPorAnoPlurianual(config)[0]).toBeCloseTo(123_000, 5);
  });
});
