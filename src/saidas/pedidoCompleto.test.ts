// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { GRUPOS_DO_PACOTE, ficheirosDoPedido } from "./pedidoCompleto";
import { novoPedidoBolsa, novoPedidoLicenciamento } from "../core/biblioteca";
import { JUSTIFICACAO_EXEMPLO, LOTES_EXEMPLO, PERFIS_EXEMPLO } from "../core/exemplo";
import { normalizarLotesGuardados } from "../core/lotes";
import { pedidoLicenciamentoExemplo } from "../core/licenciamento";

const QUANDO = new Date("2026-11-13T10:00:00");

describe("Descarregar tudo", () => {
  it("bolsa de horas: as peças do Módulo 3 e o pedido inteiro, cada ficheiro num grupo", async () => {
    const lotes = normalizarLotesGuardados(structuredClone(LOTES_EXEMPLO));
    const p = novoPedidoBolsa({
      nomeProjeto: lotes.nomeProjeto,
      descricaoProjeto: lotes.descricaoProjeto,
      justificacao: JUSTIFICACAO_EXEMPLO,
      perfis: PERFIS_EXEMPLO,
      lotes,
    });
    const nomes = (await ficheirosDoPedido(p, QUANDO)).map((f) => f.nome);
    expect(nomes.some((n) => n.endsWith("_Pedido_Bolsa_de_Horas.json"))).toBe(true);
    expect(nomes.some((n) => n.endsWith("_Manifestacao_de_Necessidades.docx"))).toBe(true);
    for (const n of nomes) expect(GRUPOS_DO_PACOTE.bolsa.filter((g) => g.pertence(n)).map((g) => g.id)).toHaveLength(1);
  });

  it("licenciamento: as peças do L3, cada ficheiro num grupo", async () => {
    const p = novoPedidoLicenciamento(pedidoLicenciamentoExemplo(2027));
    const nomes = (await ficheirosDoPedido(p, QUANDO)).map((f) => f.nome);
    expect(nomes.some((n) => n.startsWith("Mapas de quantidades e precos/"))).toBe(true);
    for (const n of nomes)
      expect(GRUPOS_DO_PACOTE.licenciamento.filter((g) => g.pertence(n)).map((g) => g.id)).toHaveLength(1);
  });
});
