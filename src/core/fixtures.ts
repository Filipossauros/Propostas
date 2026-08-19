// Construtores de dados para testes. Vivem fora dos ficheiros .test.ts para
// poderem ser partilhados entre as suites de core/, excel/ e pdf/.

import type {
  Bloco,
  ConfiguracaoAvaliacao,
  Declaracao,
  LinhaRequisito,
  LotesJSON,
  MesAno,
  PerfilJSON,
  Requisito,
} from "./types";
import { SCHEMA_VERSION_ATUAL } from "./types";
import { criarPerfilEmLote } from "./lotes";

export function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

export function requisito(id = "r1", mesesMinimos = 12, designacao = `Requisito ${id}`): Requisito {
  return { id, designacao, mesesMinimos };
}

export function perfil(parcial: Partial<PerfilJSON> = {}): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    procedimento: "",
    perfil: "Perfil Teste",
    nBlocos: 3,
    requisitos: [requisito()],
    ...parcial,
  };
}

export function configAvaliacao(parcial: Partial<ConfiguracaoAvaliacao> = {}): ConfiguracaoAvaliacao {
  return {
    perfil: "Perfil Teste",
    nBlocos: 1,
    requisitos: [requisito()],
    nMinimoElementos: 1,
    dataLimitePropostas: "2027-03-31",
    ...parcial,
  };
}

export function linha(parcial: Partial<LinhaRequisito> = {}): LinhaRequisito {
  return { requisitoId: "r1", declara: "SIM", inicio: null, fim: null, ...parcial };
}

export function bloco(parcial: Partial<Bloco> = {}): Bloco {
  return {
    indice: 1,
    cliente: "Cliente ACME",
    projeto: "Projeto Alfa",
    funcao: "Arquiteto de software",
    projInicio: ma(2020, 1),
    projFim: ma(2020, 12),
    emCurso: null,
    linhas: [linha()],
    ...parcial,
  };
}

export function declaracao(parcial: Partial<Declaracao> = {}): Declaracao {
  const identificacao = {
    nome: "Ana Ferreira",
    documento: "111",
    entidadeConcorrente: "ABC, Lda.",
    procedimento: "20270001",
    perfil: "Perfil Teste",
    ...parcial.identificacao,
  };
  return {
    id: parcial.id ?? `decl-${identificacao.nome}`,
    ficheiro: parcial.ficheiro ?? "teste.xlsx",
    blocos: parcial.blocos ?? [bloco()],
    alertas: parcial.alertas ?? [],
    identificacao,
  };
}

export function lotesComPerfis(entradas: Array<{ numero: string; perfis: PerfilJSON[] }>): LotesJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "lotes",
    procedimento: "20270001",
    lotes: entradas.map((e, idx) => ({
      id: `lote-${idx}`,
      numero: e.numero,
      designacao: "",
      perfis: e.perfis.map((p) => ({ ...criarPerfilEmLote(p), horas: 100, valorHora: 50, nMinimoElementos: 2 })),
    })),
  };
}
