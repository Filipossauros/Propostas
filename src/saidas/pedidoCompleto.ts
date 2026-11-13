// «Descarregar tudo»: as peças de um pedido da biblioteca, num só pacote.
//
// São as mesmas que cada módulo descarrega — o Anexo Técnico da bolsa de horas
// (Módulo 3) ou o do licenciamento (L3) —, mais o pedido inteiro em JSON, para
// o voltar a importar. Agrupam-se para se poder deixar algum grupo de fora.

import { nomeDoPedido, pedidoParaJSON, type PedidoNaBiblioteca } from "../core/biblioteca";
import { ficheirosDasPecas, ficheirosDoPedidoLicenciamento } from "./pacotes";
import { nomeSeguro } from "../ui/descarregar";
import type { FicheiroDoPacote } from "../ui/pacote";

/** Um grupo de ficheiros do pacote, que se pode deixar de fora. */
export interface GrupoDoPacote {
  id: string;
  rotulo: string;
  pertence: (nome: string) => boolean;
}

const MANIFESTACAO: GrupoDoPacote = {
  id: "manifestacao",
  rotulo: "Manifestação de necessidades (Word e, com o n.º da informação e o de orçamento, PDF)",
  pertence: (n) => /Manifestacao_de_Necessidades.*\.(docx|pdf)$/.test(n),
};
const EAVALIA: GrupoDoPacote = {
  id: "eavalia",
  rotulo: "Pedido de parecer eAvalia (Excel)",
  pertence: (n) => n.startsWith("Pedido_PPP_eavalia"),
};
const JSON_DO_PEDIDO: GrupoDoPacote = {
  id: "json",
  rotulo: "Ficheiros do pedido (JSON), para voltar a importar",
  pertence: (n) => !n.includes("/") && n.endsWith(".json"),
};

export const GRUPOS_DO_PACOTE: Record<PedidoNaBiblioteca["tipo"], GrupoDoPacote[]> = {
  bolsa: [
    MANIFESTACAO,
    EAVALIA,
    {
      id: "formularios",
      rotulo: "Formulários de declaração dos concorrentes, um por lote",
      pertence: (n) => n.startsWith("Resumos Curriculares/"),
    },
    { id: "perfis", rotulo: "Perfis (Excel e JSON)", pertence: (n) => n.startsWith("Perfis/") },
    JSON_DO_PEDIDO,
  ],
  licenciamento: [
    MANIFESTACAO,
    EAVALIA,
    {
      id: "mapas",
      rotulo: "Mapas de quantidades e preços, um por lote",
      pertence: (n) => n.startsWith("Mapas de quantidades e precos/"),
    },
    JSON_DO_PEDIDO,
  ],
};

/** Todas as peças do pedido, como saem módulo a módulo, mais o pedido inteiro em JSON. */
export async function ficheirosDoPedido(p: PedidoNaBiblioteca, quando = new Date()): Promise<FicheiroDoPacote[]> {
  if (p.tipo === "licenciamento") return ficheirosDoPedidoLicenciamento(p.dados, quando);
  const pecas = await ficheirosDasPecas(p.dados.lotes, p.dados.perfis, p.dados.nomeProjeto, quando);
  return [
    ...pecas,
    {
      nome: `${nomeSeguro(nomeDoPedido(p), "Projeto")}_Pedido_Bolsa_de_Horas.json`,
      conteudo: new Blob([pedidoParaJSON(p)], { type: "application/json" }),
    },
  ];
}

