// A organização da aplicação: a biblioteca de pedidos (a página inicial), os
// módulos de cada pedido, a análise de propostas e o orçamento.
//
// Um pedido é de bolsa de horas (Projeto, Perfis, Lotes) ou de licenciamento
// (Produto, L1, L2, L3), e abre-se a partir da biblioteca. A análise de
// propostas (Módulos 4 e 5) é outro momento, com entrada própria na barra
// superior: não faz parte do pedido. O orçamento junta os pedidos.
//
// No pedido de licenciamento, o Módulo 1 é o Produto, com dados próprios: o
// que se adquire é um produto (um software, uma terminologia…), e não um
// projeto.

export type Pagina =
  | "inicio"
  | "projeto"
  | "produto"
  | "perfis"
  | "lotes"
  | "licencas"
  | "condicoes"
  | "pedidoLicenciamento"
  | "avaliacao"
  | "ordenacao"
  | "vistaGeral";

export type ChaveGrupo = "bolsa" | "licenciamento" | "analise" | "orcamento";

export interface ModuloDoGrupo {
  pagina: Exclude<Pagina, "inicio">;
  /** O número ou a marca do módulo: «1», «L», «Σ». */
  marca: string;
  titulo: string;
  descricao: string;
}

export interface Grupo {
  chave: ChaveGrupo;
  titulo: string;
  /** Quem trabalha neste grupo, ou em que fase. */
  etiqueta: string;
  descricao: string;
  modulos: ModuloDoGrupo[];
}

const PROJETO: ModuloDoGrupo = {
  pagina: "projeto",
  marca: "1",
  titulo: "Projeto",
  descricao: "Caracterização e justificação",
};

export const GRUPOS: Grupo[] = [
  {
    chave: "bolsa",
    titulo: "Pedido de serviços de bolsa de horas",
    etiqueta: "Preparação do procedimento",
    descricao:
      "Aquisição de serviços na modalidade bolsa de horas: do projeto ao Anexo Técnico (manifestação de " +
      "necessidades, eAvalia e formulários de declaração).",
    modulos: [
      PROJETO,
      { pagina: "perfis", marca: "2", titulo: "Perfis", descricao: "Requisitos e conteúdo funcional" },
      { pagina: "lotes", marca: "3", titulo: "Lotes", descricao: "Valor estimado e Anexo Técnico" },
    ],
  },
  {
    chave: "licenciamento",
    titulo: "Pedido de licenciamento",
    etiqueta: "Preparação do procedimento",
    descricao:
      "Aquisição de licenciamento de software, com o preço como único critério: do projeto ao Anexo Técnico " +
      "(manifestação de necessidades, eAvalia e mapas de quantidades e preços).",
    modulos: [
      { pagina: "produto", marca: "1", titulo: "Produto", descricao: "Caracterização e justificação" },
      { pagina: "licencas", marca: "L1", titulo: "Licenças", descricao: "Produtos, métrica e preço de referência" },
      { pagina: "condicoes", marca: "L2", titulo: "Condições", descricao: "Âmbito, manutenção, SLA e penalizações" },
      {
        pagina: "pedidoLicenciamento",
        marca: "L3",
        titulo: "Pedido",
        descricao: "Lotes, valor estimado e Anexo Técnico",
      },
    ],
  },
  {
    chave: "analise",
    titulo: "Análise de propostas",
    etiqueta: "Júri",
    descricao: "Depois de recebidas as propostas: verificar os requisitos e ordenar pelo preço.",
    modulos: [
      { pagina: "avaliacao", marca: "4", titulo: "Análise", descricao: "Apuramento das declarações" },
      { pagina: "ordenacao", marca: "5", titulo: "Ordenação", descricao: "Preço e vencedores" },
    ],
  },
  {
    chave: "orcamento",
    titulo: "Orçamento",
    etiqueta: "Gestão",
    descricao: "Os procedimentos da unidade lado a lado, com cenários de corte.",
    modulos: [
      {
        pagina: "vistaGeral",
        marca: "Σ",
        titulo: "Orçamento da unidade",
        descricao: "Orçamento, pessoas e cenários de corte",
      },
    ],
  },
];

export function grupoPorChave(chave: ChaveGrupo): Grupo {
  return GRUPOS.find((g) => g.chave === chave)!;
}

/**
 * O grupo em que uma página se mostra. Só o Projeto está em dois; para ele
 * conta o grupo de onde se veio, e sem essa indicação, o primeiro.
 */
export function grupoDaPagina(pagina: Exclude<Pagina, "inicio">, preferido?: ChaveGrupo): Grupo {
  const candidatos = GRUPOS.filter((g) => g.modulos.some((m) => m.pagina === pagina));
  return candidatos.find((g) => g.chave === preferido) ?? candidatos[0];
}

export interface Localizacao {
  pagina: Pagina;
  grupo: ChaveGrupo | null;
}

/**
 * A localização no endereço da página (`#bolsa/perfis`): é o que faz o botão
 * «retroceder» do navegador voltar ao módulo anterior, ou à página inicial.
 */
export function localizacaoDoEndereco(hash: string): Localizacao {
  const [grupo, pagina] = hash.replace(/^#\/?/, "").split("/");
  const g = GRUPOS.find((x) => x.chave === grupo);
  const m = g?.modulos.find((x) => x.pagina === pagina);
  return g && m ? { pagina: m.pagina, grupo: g.chave } : { pagina: "inicio", grupo: null };
}

export function enderecoDe(localizacao: Localizacao): string {
  return localizacao.pagina === "inicio" || localizacao.grupo === null
    ? "#"
    : `#${localizacao.grupo}/${localizacao.pagina}`;
}

/** Os grupos que são um pedido: os seus módulos só se abrem com um pedido desse tipo aberto. */
export const GRUPOS_DE_PEDIDO: ReadonlyArray<ChaveGrupo> = ["bolsa", "licenciamento"];

export function ehGrupoDePedido(chave: ChaveGrupo | null): chave is "bolsa" | "licenciamento" {
  return chave === "bolsa" || chave === "licenciamento";
}
