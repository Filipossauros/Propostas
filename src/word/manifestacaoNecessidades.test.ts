// @vitest-environment jsdom
//
// O jsdom só por causa do DOMParser, com que se confirma que o XML gerado
// continua bem formado.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { BENEFICIARIOS, gerarManifestacaoBlob } from "./manifestacaoNecessidades";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { formatarMoeda, normalizarLotesGuardados, totalProcedimento } from "../core/lotes";
import { comMargemPrudencial, justificacaoComMargem, JUSTIFICACAO_SEM_MARGEM } from "../core/margem";
import type { LotesJSON } from "../core/types";
import { BENEFICIO_FIXO } from "../core/types";

const QUANDO = new Date("2026-10-07T10:00:00");

function exemplo(alteracoes: Partial<LotesJSON> = {}): LotesJSON {
  return normalizarLotesGuardados({
    ...LOTES_EXEMPLO,
    numeroInformacao: "I/1234/2026",
    encargosPlurianuais: { ativo: true, anoInicio: 2027 },
    ...alteracoes,
  });
}

async function zipDe(config: LotesJSON): Promise<JSZip> {
  return JSZip.loadAsync(await (await gerarManifestacaoBlob(config, QUANDO)).arrayBuffer());
}

async function xmlDe(config: LotesJSON): Promise<string> {
  return (await zipDe(config)).file("word/document.xml")!.async("string");
}

/** O texto do documento, sem marcação nem espaços duros, para procurar sem coordenadas. */
async function textoDe(config: LotesJSON): Promise<string> {
  return (await xmlDe(config))
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[  ]/g, " ");
}

const euros = (valor: number) => formatarMoeda(valor).replace(/[  ]/g, " ");

describe("gerarManifestacaoBlob — estrutura do modelo", () => {
  it("leva as dez secções do modelo, por esta ordem", async () => {
    const texto = await textoDe(exemplo());
    const seccoes = [
      "I. ENQUADRAMENTO",
      "II. IDENTIFICAÇÃO CLARA, OBJETIVA E FUNCIONAL DA NECESSIDADE",
      "III. VALOR ESTIMADO E MEMÓRIA DE CÁLCULO",
      "IV. AVALIAÇÃO CUSTO-BENEFÍCIO",
      "V. SUSTENTABILIDADE E CONTRATAÇÃO ESTRATÉGICA",
      "VI. DIVISÃO EM LOTES",
      "VII. GESTÃO, MONITORIZAÇÃO E CONTROLO",
      "VIII. RISCOS DA NÃO CONTRATAÇÃO",
      "IX. JÚRI TÉCNICO",
      "X. CONCLUSÃO",
    ];
    const posicoes = seccoes.map((s) => texto.indexOf(s));
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("fecha com os anexos: memória de cálculo, especificações técnicas e as folhas do eAvalia", async () => {
    const texto = await textoDe(exemplo());
    for (const anexo of [
      "Anexo I – Memória descritiva e de cálculo do dimensionamento financeiro dos serviços",
      "ANEXO III À INFORMAÇÃO N.º I/1234/2026 DE 07/10/2026",
      "Anexo IV – Modelos de apresentação da experiência profissional (Resumos Curriculares)",
      "Anexo V – Alinhamento Tecnológico (eAvalia)",
      "Anexo VI – Custos - Serviços (eAvalia)",
    ]) {
      expect(texto, anexo).toContain(anexo);
    }
    // O Anexo II só existe acima dos 5 M€.
    expect(texto).not.toContain("Anexo II –");
  });

  it("identifica a informação: n.º, data, n.º de orçamento a preencher e o assunto em maiúsculas", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("I/1234/2026");
    expect(texto).toContain("7 de outubro de 2026");
    expect(texto).toContain("[n.º de orçamento]");
    expect(texto).toContain(
      "MANIFESTAÇÃO DE NECESSIDADES PARA A AQUISIÇÃO DE SERVIÇOS DE DESENVOLVIMENTO E MANUTENÇÃO APLICACIONAL DO PROJETO",
    );
  });

  it("mantém o modelo: estilos, numeração e imagens; o cabeçalho sem a marca da versão", async () => {
    const zip = await zipDe(exemplo());
    for (const parte of ["word/styles.xml", "word/header1.xml", "word/footer1.xml", "word/media/image1.png"]) {
      expect(zip.file(parte), parte).not.toBeNull();
    }
    const cabecalho = await zip.file("word/header1.xml")!.async("string");
    expect(cabecalho).not.toContain("Template DAG");
    expect(cabecalho).not.toContain("Setembro de");
    const rodape = await zip.file("word/footer1.xml")!.async("string");
    expect(rodape).not.toMatch(/_{10,}/);
  });

  it("a secção do corpo leva o cabeçalho e o rodapé do modelo", async () => {
    const xml = await xmlDe(exemplo());
    const final = xml.slice(xml.lastIndexOf("<w:sectPr"));
    expect(final).toContain("<w:headerReference");
    expect(final).toContain("<w:footerReference");
  });

  it("deixa o XML bem formado", async () => {
    const zip = await zipDe(exemplo());
    for (const parte of ["word/document.xml", "word/header1.xml", "word/footer1.xml", "word/_rels/document.xml.rels"]) {
      const doc = new DOMParser().parseFromString(await zip.file(parte)!.async("string"), "application/xml");
      expect(doc.querySelector("parsererror"), parte).toBeNull();
    }
  });
});

describe("gerarManifestacaoBlob — conteúdo", () => {
  it("o enquadramento enumera os objetivos da aquisição, e sem eles deixa o marcador", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("que possibilitará atingir os seguintes objetivos:");
    expect(texto).toContain("a. Assegurar a continuidade do desenvolvimento");

    const sem = exemplo({ justificacao: { ...LOTES_EXEMPLO.justificacao, objetivos: [] } });
    expect(await textoDe(sem)).toContain("[objetivos da aquisição]");
  });

  it("a necessidade é a do procedimento, durante os meses dos anos económicos, em Bolsa de Horas", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain(
      "consiste em assegurar, durante 36 meses, a prestação de serviços de Desenvolvimento e Manutenção Aplicacional",
    );
    expect(texto).toContain("na modalidade de Bolsa de Horas");
  });

  it("os benefícios saem nos dois sítios do modelo: na necessidade e nos benefícios operacionais", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("A presente aquisição comporta os seguintes benefícios:");
    expect(texto).toContain(`d. ${BENEFICIO_FIXO}`);
    expect(texto).toMatch(/c\) Benefícios operacionais: redução do tempo de registo clínico[^]*?; suprir a insuficiência/);
  });

  it("os beneficiários são o texto fixo, igual em todas", async () => {
    expect(await textoDe(exemplo())).toContain(`a) Beneficiários: ${BENEFICIARIOS}`);
  });

  it("a gestão do contrato não leva SLA nem penalizações, e remete para os relatórios de atividade", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain(
      "Atenta a natureza da prestação de serviços, executada na modalidade de Bolsa de Horas em que o prestador " +
        "disponibiliza recursos com os perfis e a experiência fixados, sob a orientação técnica da entidade " +
        "adjudicante, não são aplicáveis níveis de serviço (SLA) nem penalizações associadas a resultados.",
    );
  });

  it("a divisão em lotes leva só a frase de abertura e o quadro dos lotes", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("O procedimento é configurado por lotes, nos seguintes termos:");
    expect(texto).not.toContain("O Lote 1 corresponde a");
    expect(texto).not.toContain("A determinação dos lotes");
  });

  it("com um só lote, justifica a não divisão", async () => {
    const config = exemplo();
    const umLote = { ...config, lotes: [config.lotes[0]] };
    const texto = await textoDe(umLote);
    expect(texto).toContain("a necessidade não se mostra adequada à divisão em lotes");
    expect(texto).not.toContain("configurado por lotes");
  });

  it("o júri leva os nomes indicados, e o coordenador assina com a sua unidade", async () => {
    const config = exemplo({
      juri: { diretor: "Ana Diretora", coordenador: "Rui Coordenador", unidade: "Unidade de Teste", gestorProjeto: "Eva Gestora" },
    });
    const texto = await textoDe(config);
    expect(texto).toContain("a) Ana Diretora – Diretor da Direção de Arquitetura, Negócio e Análise de Dados");
    expect(texto).toContain("b) Rui Coordenador – Coordenador da Unidade de Teste");
    expect(texto).toContain("c) Eva Gestora – Gestor do Projeto Modernização dos Sistemas de Informação");
    // A assinatura: a direção, a unidade por baixo, e o coordenador por cima de «(Coordenador)».
    const assinatura = texto.slice(texto.indexOf("À consideração superior"));
    expect(assinatura).toMatch(/Direção de Arquitetura, Negócio e Análise de Dados\s*Unidade de Teste[^]*Rui Coordenador\(Coordenador\)/);
    expect(assinatura).not.toContain("Filipe Mealha");
  });

  it("sem júri, deixa os nomes a vermelho", async () => {
    const texto = await textoDe(exemplo({ juri: { diretor: "", coordenador: "", unidade: "", gestorProjeto: "" } }));
    expect(texto).toContain("[nome do diretor]");
    expect(texto).toContain("[nome do coordenador]");
    expect(texto).toContain("[unidade]");
  });

  it("a conclusão propõe a deliberação, com o período e a repartição de cada ano", async () => {
    const texto = await textoDe(exemplo());
    expect(texto).toContain("no período de 1 de janeiro de 2027 a 31 de dezembro de 2029");
    expect(texto).toMatch(/com a repartição anual máxima de [\d  ,]+€ em 2027, [\d  ,]+€ em 2028 e [\d  ,]+€ em 2029, sem IVA/);
  });

  it("o Anexo I leva os parágrafos e o quadro dos anos da informação anterior", async () => {
    const texto = await textoDe(exemplo());
    const anexo = texto.slice(texto.indexOf("Anexo I – Memória descritiva"));
    expect(anexo).toContain("A execução do contrato em período superior a 12 meses assegura a estabilidade");
    expect(anexo).toContain("respeitam ao ano económico do início do contrato, 2027");
    expect(anexo).toContain("Total € c/ IVA 2027");
    expect(anexo).not.toContain("Volume de horas de referência");
  });

  it("o Anexo III segue os pontos do modelo, com as regras da aplicação a fechar", async () => {
    const anexo = (await textoDe(exemplo())).split("Especificações Técnicas")[1];
    const pontos = [
      "1. Descrição",
      "2. Prazo de execução",
      "3. Prazo de entrega",
      "4. Local e modo de prestação de serviços",
      "5. Equipa",
      "6. Requisitos técnicos obrigatórios por perfil",
      "7. Descrição dos serviços a prestar",
      "8. Entregáveis",
      "9. SLA’s e níveis de serviço",
      "12. Modelo de reporte",
      "13. Regras de adjudicação dos lotes",
      "14. Regras de apuramento da experiência",
    ];
    const posicoes = pontos.map((p) => anexo.indexOf(p));
    expect(posicoes.every((p) => p >= 0), JSON.stringify(posicoes)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("sem encargos plurianuais, o contrato cabe num ano: 12 meses e o quadro do preço base", async () => {
    const texto = await textoDe(exemplo({ encargosPlurianuais: { ativo: false, anoInicio: 2027 } }));
    expect(texto).toContain("durante 12 meses");
    expect(texto).toContain("no período de 1 de janeiro de 2027 a 31 de dezembro de 2027");
    expect(texto).toContain("Preço base total do procedimento");
  });
});

describe("gerarManifestacaoBlob — margem prudencial", () => {
  it("a 0 %, o valor estimado é o preço base, e o fundamento diz por que não há margem", async () => {
    const config = exemplo();
    const texto = await textoDe(config);
    expect(texto).toContain(`o valor estimado do contrato corresponde a ${euros(totalProcedimento(config).semIva)}`);
    expect(texto).toContain(JUSTIFICACAO_SEM_MARGEM);
    expect(texto).toContain("0 % (incorporada nos valores unitários)");
  });

  it("acima de 0 %, todos os valores a levam: o estimado, os lotes, os anos e o eAvalia", async () => {
    const config = exemplo({ margemPrudencial: 10, justificacaoMargem: justificacaoComMargem(10) });
    const comMargem = totalProcedimento(comMargemPrudencial(config)).semIva;
    const texto = await textoDe(config);

    expect(comMargem).toBeCloseTo(totalProcedimento(config).semIva * 1.1, 2);
    expect(texto).toContain(`o valor estimado do contrato corresponde a ${euros(comMargem)}`);
    expect(texto).toContain("acrescido de uma margem prudencial de 10 %");
    expect(texto).toContain(justificacaoComMargem(10));
    // O quadro dos lotes, com o total do procedimento já com a margem, e a legenda a dizê-lo.
    const lotes = texto.slice(texto.indexOf("VI. DIVISÃO EM LOTES"), texto.indexOf("VII. GESTÃO"));
    expect(lotes).toContain(euros(comMargem));
    expect(lotes).toContain("O preço base inclui a margem prudencial de 10 %.");
    // E o quadro dos valores hora antes e depois.
    expect(texto).toContain("Valor hora de cada perfil, antes e depois da margem prudencial.");
    expect(texto).toContain("46,20 €/h");
  });

  it("um fundamento escrito à mão sai tal e qual", async () => {
    const texto = await textoDe(exemplo({ justificacaoMargem: "Fundamento próprio da margem." }));
    expect(texto).toContain("Fundamento próprio da margem.");
    expect(texto).not.toContain(JUSTIFICACAO_SEM_MARGEM);
  });
});
