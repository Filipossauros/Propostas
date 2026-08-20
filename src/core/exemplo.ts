// Dados de exemplo para experimentar a aplicação sem ter de preencher tudo à mão.
//
// Esta é a fonte única: o ficheiro exemplos/lotes-exemplo.json no repositório é
// gerado a partir daqui (`npm run exemplos`), e os botões "exemplo" da interface
// leem esta constante diretamente — sem qualquer pedido de rede.

import type { Bloco, Declaracao, LotesJSON, MesAno, PerfilEmLote, PerfilJSON, Requisito } from "./types";
import { SCHEMA_VERSION_ATUAL, TAXA_IVA_PADRAO } from "./types";
import type { DeclaracaoAtribuida } from "./avaliacaoProcedimento";

function req(id: string, designacao: string, mesesMinimos: number): Requisito {
  return { id, designacao, mesesMinimos };
}

function perfil(
  id: string,
  nome: string,
  conteudoFuncional: string,
  requisitos: Requisito[],
  /** Campo opcional: só dois dos perfis do exemplo exigem certificação. */
  certificacoes: string[] = [],
): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    id,
    perfil: nome,
    nBlocos: 15,
    conteudoFuncional,
    certificacoes: certificacoes.map((designacao, i) => ({ id: `${id}-c${i + 1}`, designacao })),
    requisitos: requisitos.map((r) => ({ ...r, id: `${id}-${r.id}` })),
  };
}

export const PERFIL_EXEMPLO: PerfilJSON = perfil("p1", "Programador Sénior — Java", "Desenho e implementação de componentes aplicacionais em Java; Definição de APIs REST e respetiva documentação; Revisão de código e apoio técnico à equipa; Diagnóstico e correção de incidentes em produção.", [
  req("r1", "Desenvolvimento de software (geral)", 120),
  req("r2", "Java (versão 8 ou superior)", 60),
  req("r3", "Desenvolvimento de APIs REST", 36),
], ["Oracle Certified Professional, Java SE Programmer"]);

const PERFIL_FRONTEND = perfil("p2", "Programador Front-end", "Implementação de interfaces web a partir de especificações de desenho; Garantia de conformidade com as normas de acessibilidade; Escrita de testes de interface; Articulação com as equipas de back-end.", [
  req("r1", "Desenvolvimento de software (geral)", 60),
  req("r2", "React", 36),
  req("r3", "Acessibilidade web (WCAG)", 24),
]);

const PERFIL_INTEGRACAO = perfil("p3", "Arquiteto de Integração", "Análise e levantamento de requisitos funcionais, não funcionais e de negócio; Caracterização de fluxos de informação e processos; Elaboração de casos de uso e documentação funcional de projeto; Realização de formações na ótica do utilizador.", [
  req("r1", "Desenvolvimento de software (geral)", 120),
  req("r2", "Integração de sistemas de informação", 60),
  req("r3", "Normas de interoperabilidade em saúde (HL7 / FHIR)", 36),
], ["HL7 FHIR Foundation (HL7 International)", "TOGAF Enterprise Architecture Foundation"]);

const PERFIL_DADOS = perfil("p4", "Engenheiro de Dados", "Modelação de dados e otimização de consultas; Construção e manutenção de processos de extração, transformação e carregamento; Monitorização da qualidade dos dados; Preparação de conjuntos de dados para análise.", [
  req("r1", "Modelação e exploração de bases de dados relacionais", 60),
  req("r2", "Processos de extração, transformação e carregamento (ETL)", 36),
]);

export const NOME_PROJETO_EXEMPLO = "Modernização dos Sistemas de Informação";

export const LOTES_EXEMPLO: LotesJSON = {
  schemaVersion: SCHEMA_VERSION_ATUAL,
  tipo: "lotes",
  nomeProjeto: NOME_PROJETO_EXEMPLO,
  nomeProcedimento: "Aquisição de Serviços de Desenvolvimento e Manutenção Aplicacional",
  taxaIva: TAXA_IVA_PADRAO,
  umLotePorConcorrente: true,
  lotes: [
    {
      id: "lote-1",
      numero: "1",
      designacao: "Desenvolvimento aplicacional",
      perfis: [
        { id: "l1-p1", perfil: PERFIL_EXEMPLO, horas: 3520, valorHora: 42, nMinimoElementos: 2 },
        { id: "l1-p2", perfil: PERFIL_FRONTEND, horas: 1760, valorHora: 38, nMinimoElementos: 1 },
      ],
    },
    {
      id: "lote-2",
      numero: "2",
      designacao: "Integração e dados",
      perfis: [
        { id: "l2-p3", perfil: PERFIL_INTEGRACAO, horas: 1760, valorHora: 55, nMinimoElementos: 1 },
        { id: "l2-p4", perfil: PERFIL_DADOS, horas: 1760, valorHora: 45, nMinimoElementos: 2 },
      ],
    },
  ],
};

/** Os perfis do exemplo, soltos — para experimentar o passo de atribuição do Módulo 2. */
export const PERFIS_EXEMPLO: PerfilJSON[] = [
  PERFIL_EXEMPLO,
  PERFIL_FRONTEND,
  PERFIL_INTEGRACAO,
  PERFIL_DADOS,
];


// --------------------------------------------------------------------------
// Declarações de exemplo — Módulo 3
// --------------------------------------------------------------------------

/**
 * Propostas fictícias que exercitam o apuramento de ponta a ponta.
 *
 * Estão construídas para o resultado ser verificável de cabeça: a Alfa cumpre
 * os dois lotes e a Beta só o segundo, de modo que, com a limitação de um lote
 * por concorrente ativa, a Alfa fica com o lote 1 e é a Beta — e não a Alfa —
 * que fica com o lote 2. Sem a limitação, a Alfa ficaria com ambos.
 *
 * As datas são passadas e fixas: nenhuma pode ultrapassar o mês corrente.
 */
const LONGO = { inicio: { ano: 2010, mes: 1 }, fim: { ano: 2023, mes: 12 } };
const CURTO = { inicio: { ano: 2020, mes: 1 }, fim: { ano: 2023, mes: 12 } };

function blocoDeclarado(indice: number, periodo: { inicio: MesAno; fim: MesAno }, requisitos: Requisito[]): Bloco {
  return {
    indice,
    cliente: "Cliente Exemplo",
    projeto: `Projeto ${indice}`,
    funcao: "Equipa de desenvolvimento",
    projInicio: periodo.inicio,
    projFim: periodo.fim,
    linhas: requisitos.map((r) => ({
      requisitoId: r.id,
      declara: "SIM" as const,
      inicio: null,
      fim: null,
      inicioIncompleto: false,
      fimIncompleto: false,
    })),
  };
}

function declaracaoExemplo(
  id: string,
  nome: string,
  entidade: string,
  lote: { numero: string; designacao: string },
  entrada: PerfilEmLote,
  periodo: { inicio: MesAno; fim: MesAno },
): Declaracao {
  return {
    id,
    ficheiro: `${nome.replace(/ /g, "_")}.xlsx`,
    identificacao: {
      nome,
      entidadeConcorrente: entidade,
      procedimento: "2027/001",
      lote: lote.numero,
      loteDesignacao: lote.designacao,
      perfil: entrada.perfil.perfil,
    },
    blocos: [blocoDeclarado(1, periodo, entrada.perfil.requisitos)],
    alertas: [],
  };
}

/** Uma proposta completa de uma entidade a um lote: o n.º mínimo de elementos de cada perfil. */
function propostaAoLote(
  entidade: string,
  prefixo: string,
  lote: LotesJSON["lotes"][number],
  periodoPorPerfil: (entrada: PerfilEmLote) => { inicio: MesAno; fim: MesAno },
): DeclaracaoAtribuida[] {
  return lote.perfis.flatMap((entrada) =>
    Array.from({ length: entrada.nMinimoElementos }, (_, i) => ({
      declaracao: declaracaoExemplo(
        `${prefixo}-${entrada.id}-${i + 1}`,
        `${entidade.split(" ")[0]} — elemento ${i + 1} (${entrada.perfil.perfil})`,
        entidade,
        lote,
        entrada,
        periodoPorPerfil(entrada),
      ),
      loteId: lote.id,
      perfilEmLoteId: entrada.id,
    })),
  );
}

export const ENTIDADES_EXEMPLO = ["Alfa Sistemas, S.A.", "Beta Consultores, Lda."] as const;

export function declaracoesExemplo(config: LotesJSON = LOTES_EXEMPLO): DeclaracaoAtribuida[] {
  const [lote1, lote2] = config.lotes;
  const [alfa, beta] = ENTIDADES_EXEMPLO;

  return [
    ...propostaAoLote(alfa, "alfa-l1", lote1, () => LONGO),
    ...propostaAoLote(alfa, "alfa-l2", lote2, () => LONGO),
    // A Beta fica aquém no primeiro perfil do lote 1: experiência curta demais.
    ...propostaAoLote(beta, "beta-l1", lote1, (entrada) =>
      entrada.id === lote1.perfis[0].id ? CURTO : LONGO,
    ),
    ...propostaAoLote(beta, "beta-l2", lote2, () => LONGO),
  ];
}
