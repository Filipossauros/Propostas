// Dados de exemplo para experimentar a aplicação sem ter de preencher tudo à mão.
//
// Esta é a fonte única: o ficheiro exemplos/lotes-exemplo.json no repositório é
// gerado a partir daqui (`npm run exemplos`), e os botões "exemplo" da interface
// leem esta constante diretamente — sem qualquer pedido de rede.

import type { LotesJSON, PerfilJSON, Requisito } from "./types";
import { SCHEMA_VERSION_ATUAL, TAXA_IVA_PADRAO } from "./types";

function req(id: string, designacao: string, mesesMinimos: number): Requisito {
  return { id, designacao, mesesMinimos };
}

function perfil(id: string, nome: string, requisitos: Requisito[]): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    perfil: nome,
    nBlocos: 15,
    requisitos: requisitos.map((r) => ({ ...r, id: `${id}-${r.id}` })),
  };
}

export const PERFIL_EXEMPLO: PerfilJSON = perfil("p1", "Programador Sénior — Java", [
  req("r1", "Desenvolvimento de software (geral)", 120),
  req("r2", "Java (versão 8 ou superior)", 60),
  req("r3", "Desenvolvimento de APIs REST", 36),
]);

const PERFIL_FRONTEND = perfil("p2", "Programador Front-end", [
  req("r1", "Desenvolvimento de software (geral)", 60),
  req("r2", "React", 36),
  req("r3", "Acessibilidade web (WCAG)", 24),
]);

const PERFIL_INTEGRACAO = perfil("p3", "Arquiteto de Integração", [
  req("r1", "Desenvolvimento de software (geral)", 120),
  req("r2", "Integração de sistemas de informação", 60),
  req("r3", "Normas de interoperabilidade em saúde (HL7 / FHIR)", 36),
]);

const PERFIL_DADOS = perfil("p4", "Engenheiro de Dados", [
  req("r1", "Modelação e exploração de bases de dados relacionais", 60),
  req("r2", "Processos de extração, transformação e carregamento (ETL)", 36),
]);

export const LOTES_EXEMPLO: LotesJSON = {
  schemaVersion: SCHEMA_VERSION_ATUAL,
  tipo: "lotes",
  taxaIva: TAXA_IVA_PADRAO,
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
