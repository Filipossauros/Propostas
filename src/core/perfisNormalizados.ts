// Catálogo de perfis normalizados.
//
// São os perfis-base da entidade: conteúdo funcional e requisitos mínimos
// transversais, iguais em todos os procedimentos, aos quais depois se
// acrescentam os requisitos tecnológicos específicos de cada projeto.
//
// Não trazem preço: o preço/hora é decisão de cada procedimento e escreve-se à
// mão no Módulo 2, ao colocar o perfil no lote.
//
// GERADO a partir de Perfis_Base_Requisitos_Transversais_REVISTO_v2.xlsx — o
// texto é transcrição, não reescrita. Alterações à redação fazem-se no ficheiro
// de origem e voltam a passar por aqui.

import type { PerfilJSON } from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";

/** N.º de blocos de projeto do formulário de declaração, igual em todos os perfis. */
const N_BLOCOS = 15;

interface Base {
  /** Número do perfil no Anexo Técnico. Não há perfil 9. */
  numero: number;
  nome: string;
  atividades: string[];
  /** Cada requisito com a experiência mínima em meses. */
  requisitos: Array<[string, number]>;
}

const BASE: Base[] = [
  {
    numero: 1,
    nome: "Arquiteto de Sistemas",
    atividades: [
      "Conceção da arquitetura de soluções aplicacionais, incluindo a definição de componentes, interfaces e fluxos de dados",
      "Conceção de soluções de integração entre sistemas de informação",
      "Modelação de dados e definição das estruturas de armazenamento",
      "Elaboração de padrões, normas e guias técnicos aplicáveis ao desenvolvimento das soluções",
      "Definição e acompanhamento dos mecanismos de observabilidade e de monitorização das soluções",
      "Elaboração de documentação técnica de arquitetura",
      "Apoio técnico às equipas de desenvolvimento",
      "Realização de ações de formação sobre as soluções desenvolvidas",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Conceção de arquitetura de soluções em projetos de desenvolvimento de software", 72],
      ["Conceção de soluções de integração", 24],
      ["Elaboração de padrões, normas ou guias técnicos de desenvolvimento de software", 24],
    ],
  },
  {
    numero: 2,
    nome: "Fullstack",
    atividades: [
      "Desenvolvimento de aplicações web, na camada de interface (frontend) e na camada de serviços (backend)",
      "Desenvolvimento e integração de componentes aplicacionais",
      "Modelação de dados e implementação dos acessos a bases de dados",
      "Conceção, implementação e execução de testes automatizados",
      "Elaboração de documentação técnica",
      "Apoio técnico às equipas de desenvolvimento",
      "Realização de ações de formação sobre as soluções desenvolvidas",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Desenvolvimento de software com intervenção na camada de interface (frontend)", 36],
      ["Desenvolvimento de software com intervenção na camada de serviços (backend)", 36],
      ["Implementação de testes automatizados de software", 24],
      ["Modelação de dados", 24],
    ],
  },
  {
    numero: 3,
    nome: "Backend / Integração de Sistemas",
    atividades: [
      "Desenvolvimento de serviços aplicacionais (backend) expostos através de interfaces programáticas (API)",
      "Desenvolvimento de soluções de integração entre sistemas de informação",
      "Modelação de dados e implementação dos acessos a bases de dados",
      "Conceção, implementação e execução de testes automatizados",
      "Implementação de mecanismos de segurança aplicacional",
      "Configuração e manutenção de processos de integração e entrega contínuas (CI/CD)",
      "Elaboração de documentação técnica",
      "Apoio técnico às equipas de desenvolvimento",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Desenvolvimento de serviços aplicacionais (backend)", 24],
      ["Desenvolvimento de soluções de integração", 24],
      ["Implementação de testes automatizados unitários", 24],
      ["Implementação de testes automatizados de integração", 24],
      ["Implementação de mecanismos de segurança aplicacional, designadamente de autenticação, de autorização ou de cifra de dados", 24],
      ["Configuração de processos de integração e entrega contínuas (CI/CD)", 24],
    ],
  },
  {
    numero: 4,
    nome: "Frontend",
    atividades: [
      "Desenvolvimento e manutenção de interfaces de utilizador de aplicações web",
      "Desenvolvimento de componentes de interface reutilizáveis",
      "Integração das interfaces de utilizador com serviços aplicacionais (backend) e com sistemas de gestão de conteúdos",
      "Definição, com as equipas de conteúdo, dos modelos de dados e das estruturas de conteúdo",
      "Desenvolvimento de interfaces em conformidade com os requisitos de acessibilidade digital aplicáveis",
      "Conceção, implementação e execução de testes automatizados de interface",
      "Elaboração de documentação técnica",
      "Realização de ações de formação sobre as soluções desenvolvidas",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Desenvolvimento de interfaces de utilizador de aplicações web (frontend)", 24],
      ["Desenvolvimento de interfaces com base em sistemas de design (design systems), incluindo a criação ou a utilização de bibliotecas de componentes reutilizáveis", 24],
      ["Integração de interfaces de utilizador com serviços aplicacionais (backend)", 24],
      ["Desenvolvimento de interfaces em conformidade com a norma EN 301 549, com as WCAG 2.1 no nível AA, ou com norma equivalente", 24],
    ],
  },
  {
    numero: 5,
    nome: "Consultor de Administração de Sistemas",
    atividades: [
      "Monitorização do funcionamento e do desempenho das soluções",
      "Desenvolvimento e manutenção de painéis e de relatórios de monitorização",
      "Implementação e automatização de mecanismos de recolha de métricas e de alertas",
      "Elaboração de documentação técnica",
      "Realização de ações de formação sobre as soluções administradas",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Monitorização do funcionamento ou do desempenho de soluções aplicacionais", 24],
      ["Implementação de mecanismos automáticos de recolha de métricas, de alertas ou de painéis de monitorização", 24],
    ],
  },
  {
    numero: 6,
    nome: "Tester",
    atividades: [
      "Planeamento dos testes e análise dos requisitos para efeitos de teste",
      "Conceção, desenvolvimento e execução de planos e de casos de teste",
      "Automatização de testes e respetiva integração em processos de integração contínua (CI/CD)",
      "Execução de testes funcionais, de regressão, de integração e ponta a ponta (end-to-end)",
      "Execução de testes de desempenho e de carga",
      "Execução de testes de segurança sobre fluxos de autenticação e de autorização",
      "Configuração e manutenção de ambientes de teste",
      "Elaboração de documentação de testes, designadamente casos de teste, relatórios de execução e autos de aceitação",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Conceção e execução de testes de software", 36],
      ["Automatização de testes e respetiva integração em processos de integração contínua (CI/CD)", 24],
      ["Elaboração de documentação de testes, designadamente casos de teste, relatórios de execução ou autos de aceitação", 24],
    ],
  },
  {
    numero: 7,
    nome: "Analista Funcional",
    atividades: [
      "Levantamento e análise de requisitos de negócio, funcionais e não funcionais",
      "Elaboração de especificações funcionais",
      "Definição de regras de negócio e modelação dos fluxos de processos",
      "Definição de modelos de dados",
      "Elaboração de casos de uso ou de histórias de utilizador e dos respetivos critérios de aceitação",
      "Apoio às equipas de desenvolvimento e de teste na interpretação dos requisitos",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Análise funcional de sistemas de informação, incluindo o levantamento de requisitos", 36],
      ["Modelação de processos de negócio, designadamente em notação BPMN ou equivalente", 24],
      ["Elaboração de casos de uso ou de histórias de utilizador (user stories)", 24],
      ["Definição de modelos de dados", 24],
    ],
  },
  {
    numero: 8,
    nome: "Gestor de Projeto",
    atividades: [
      "Planeamento do projeto e elaboração do respetivo plano",
      "Controlo e monitorização da execução do projeto, quanto a âmbito, prazos e recursos",
      "Coordenação da equipa afeta ao projeto",
      "Identificação, avaliação e mitigação de riscos",
      "Gestão da comunicação com as partes interessadas e reporte à entidade adjudicante",
      "Criação e priorização do backlog do produto",
      "Definição e melhoria dos processos de qualidade do projeto",
      "Elaboração da documentação de gestão do projeto",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Gestão de projetos de sistemas de informação", 60],
      ["Coordenação de equipas afetas a projetos de sistemas de informação, compostas por três ou mais elementos", 24],
      ["Gestão de projetos de sistemas de informação no setor da saúde", 12],
    ],
  },
  {
    numero: 10,
    nome: "UX Designer",
    atividades: [
      "Conceção da experiência de utilização (UX) e da interface (UI) das soluções",
      "Elaboração de protótipos de alta fidelidade",
      "Conceção de soluções em conformidade com os requisitos de acessibilidade digital aplicáveis",
      "Realização de testes de usabilidade e incorporação dos respetivos resultados",
      "Elaboração e manutenção de sistemas de design (design systems) e de bibliotecas de componentes",
      "Elaboração de documentação de suporte ao desenvolvimento das interfaces",
      "Outras atividades de natureza análoga às descritas, compreendidas no objeto do contrato e no âmbito funcional do perfil",
    ],
    requisitos: [
      ["Conceção de soluções de experiência de utilização (UX) e de interface (UI)", 24],
      ["Conceção de soluções em conformidade com a norma EN 301 549, com as WCAG 2.1 no nível AA, ou com norma equivalente", 24],
      ["Elaboração de protótipos de alta fidelidade", 24],
      ["Realização de testes de usabilidade com utilizadores", 12],
    ],
  },
];

/**
 * Os perfis normalizados, prontos a entrar no catálogo do Módulo 1.
 *
 * Os identificadores são estáveis e derivados do número do perfil: voltar a
 * carregar o catálogo atualiza os perfis que já estejam atribuídos a um lote,
 * em vez de criar cópias ao lado.
 */
export const PERFIS_NORMALIZADOS: PerfilJSON[] = BASE.map((base) => {
  const id = `pn${base.numero}`;
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    id,
    perfil: base.nome,
    nBlocos: N_BLOCOS,
    conteudoFuncional: base.atividades.map((designacao, i) => ({ id: `${id}-a${i + 1}`, designacao })),
    // Nenhum dos perfis-base exige certificação: é matéria de cada procedimento.
    certificacoes: [],
    requisitos: base.requisitos.map(([designacao, mesesMinimos], i) => ({
      id: `${id}-r${i + 1}`,
      designacao,
      mesesMinimos,
    })),
  };
});
