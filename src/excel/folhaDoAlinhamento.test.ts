import { describe, expect, it } from "vitest";
import { gerarEavaliaBlob } from "./eavalia";
import { lerFolhaDoAlinhamento, type CelulaDaFolha, type FolhaDesenhavel } from "./folhaDoAlinhamento";
import { LOTES_EXEMPLO } from "../core/exemplo";
import { informacaoEavaliaInicial, type LotesJSON } from "../core/types";

async function folhaDe(config: LotesJSON = LOTES_EXEMPLO): Promise<FolhaDesenhavel> {
  const blob = await gerarEavaliaBlob(config, new Date("2026-08-26T10:00:00"));
  return lerFolhaDoAlinhamento(new Uint8Array(await blob.arrayBuffer()));
}

function celula(folha: FolhaDesenhavel, ref: string): CelulaDaFolha {
  const coluna = ref.charCodeAt(0) - 65;
  const linha = Number(ref.slice(1)) - 1;
  const encontrada = folha.celulas.find((c) => c.linha === linha && c.coluna === coluna);
  if (encontrada === undefined) throw new Error(`sem célula ${ref}`);
  return encontrada;
}

describe("lerFolhaDoAlinhamento", () => {
  it("lê as seis colunas e as setenta e cinco linhas do formulário", async () => {
    const folha = await folhaDe();

    expect(folha.larguras).toHaveLength(6);
    expect(folha.alturas).toHaveLength(75);
    // A coluna das perguntas (D) é a mais larga; a das datas (F) das mais estreitas.
    expect(Math.max(...folha.larguras)).toBe(folha.larguras[3]);
  });

  it("junta cada fusão numa célula só, com o texto no canto", async () => {
    const folha = await folhaDe();
    const titulo = celula(folha, "A1");

    expect(titulo.texto).toBe("Alinhamento Tecnológico");
    expect([titulo.ateLinha, titulo.ateColuna]).toEqual([0, 5]);
    // As células cobertas pela fusão não se desenham à parte.
    expect(folha.celulas.some((c) => c.linha === 0 && c.coluna === 3)).toBe(false);
    expect(celula(folha, "A6").texto).toMatch(/^Reutilização de dados/);
    expect(celula(folha, "A6").ateColuna).toBe(3);
  });

  it("traz as respostas escritas pela aplicação, e as fixas", async () => {
    const folha = await folhaDe();

    expect(celula(folha, "E6").texto).toBe(LOTES_EXEMPLO.eavalia.iap);
    expect(celula(folha, "E42").texto).toBe("Selo Prata");
    expect(celula(folha, "E62").texto).toBe("Já cumpre");
    expect(celula(folha, "E70").texto).toBe("Não aplicável");
  });

  it("escreve as datas como se leem cá", async () => {
    // O exemplo responde «Cumpre Parcialmente» nos idiomas: leva a data do compromisso.
    const folha = await folhaDe();
    expect(celula(folha, "F44").texto).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("reproduz os estilos do modelo: título azul e grande, perguntas a negrito", async () => {
    const folha = await folhaDe();

    expect(celula(folha, "A1").estilo).toMatchObject({ cor: "#0070C0", negrito: true, tamanho: 16, horizontal: "center" });
    expect(celula(folha, "A6").estilo).toMatchObject({ negrito: true, quebra: true, vertical: "middle" });
    expect(celula(folha, "E6").estilo.bordas.esquerda).toEqual({ cor: "#000000", espessura: 1 });
  });

  it("aplica a formatação condicional do formulário", async () => {
    const respondida = await folhaDe();
    // Uma resposta que não é compromisso: a data fica pontilhada, como «não se aplica».
    expect(celula(respondida, "F62").estilo.pontilhado).toBe(true);
    // Um compromisso: a data fica a pedir preenchimento, com o contorno azul.
    expect(celula(respondida, "F44").estilo.bordas.esquerda?.cor).toBe("#0070C0");

    // Sem resposta, a célula acende-se a cinzento claro com contorno azul.
    const porResponder = await folhaDe({ ...LOTES_EXEMPLO, eavalia: informacaoEavaliaInicial() });
    // (A regra da E6 é a única do modelo sem contorno — só o fundo.)
    expect(celula(porResponder, "E6").estilo.fundo).toBe("#F2F2F2");
    expect(celula(porResponder, "E44").estilo.fundo).toBe("#F2F2F2");
    expect(celula(porResponder, "E44").estilo.bordas.cima?.cor).toBe("#0070C0");
    // A E8 vem do modelo com «Não aplicável» por omissão: não está vazia, e não se acende.
    expect(celula(porResponder, "E8").estilo.fundo).toBeUndefined();
  });
});
