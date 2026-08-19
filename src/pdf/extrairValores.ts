// Extração dos valores declarados numa Declaracao (já lida do Excel) para
// comparação com o texto do PDF assinado — PLANO.md secção 8.
//
// Deliberadamente NÃO reconstrói a grelha célula a célula: extrai apenas
// (a) a sequência ordenada de respostas SIM/NÃO, (b) o conjunto de datas
// declaradas e (c) o conjunto de textos livres (cliente/projeto/função/
// identificação), para comparação como conjuntos/sequência de valores.

import type { Declaracao, MesAno } from "../core/types";
import { normalizarTexto } from "./normalizar";

export interface RespostaDeclara {
  blocoIndice: number;
  requisitoId: string;
  valor: "SIM" | "NAO";
}

/** Uma data declarada, com as variantes textuais aceites como equivalentes (com/sem zero à esquerda no mês). */
export interface DataDeclarada {
  chave: string;
  variantes: string[];
}

export interface ValoresDeclarados {
  sequenciaDeclara: RespostaDeclara[];
  datas: DataDeclarada[];
  textos: Set<string>;
}

function formatosData({ mes, ano }: MesAno): DataDeclarada {
  const mesPadded = String(mes).padStart(2, "0");
  const chave = `${mesPadded}/${ano}`;
  const variantes = mes < 10 ? [chave, `${mes}/${ano}`] : [chave];
  return { chave, variantes };
}

export function extrairValoresDeclarados(declaracao: Declaracao): ValoresDeclarados {
  const sequenciaDeclara: RespostaDeclara[] = [];
  const datasPorChave = new Map<string, DataDeclarada>();
  const textos = new Set<string>();

  const adicionarTexto = (texto: string) => {
    const normalizado = normalizarTexto(texto);
    if (normalizado !== "") textos.add(normalizado);
  };
  const adicionarData = (data: MesAno | null) => {
    if (data === null) return;
    const formatada = formatosData(data);
    datasPorChave.set(formatada.chave, formatada);
  };

  adicionarTexto(declaracao.identificacao.nome);
  adicionarTexto(declaracao.identificacao.entidadeConcorrente);

  for (const bloco of declaracao.blocos) {
    adicionarTexto(bloco.cliente);
    adicionarTexto(bloco.projeto);
    adicionarTexto(bloco.funcao);
    adicionarData(bloco.projInicio);
    adicionarData(bloco.projFim);

    for (const linha of bloco.linhas) {
      if (linha.declara === "SIM" || linha.declara === "NÃO") {
        sequenciaDeclara.push({
          blocoIndice: bloco.indice,
          requisitoId: linha.requisitoId,
          valor: linha.declara === "SIM" ? "SIM" : "NAO",
        });
      }
      adicionarData(linha.inicio);
      adicionarData(linha.fim);
    }
  }

  return { sequenciaDeclara, datas: [...datasPorChave.values()], textos };
}
