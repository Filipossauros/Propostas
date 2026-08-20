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
import { SCHEMA_VERSION_ATUAL, TAXA_IVA_PADRAO } from "./types";
import { criarPerfilEmLote } from "./lotes";

export function ma(ano: number, mes: number): MesAno {
  return { ano, mes };
}

export function requisito(id = "r1", mesesMinimos = 12, designacao = `Requisito ${id}`): Requisito {
  return { id, designacao, mesesMinimos };
}

let proximoIdPerfil = 1;

export function perfil(parcial: Partial<PerfilJSON> = {}): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    id: `perfil-${proximoIdPerfil++}`,
    perfil: "Perfil Teste",
    nBlocos: 3,
    conteudoFuncional: "Atividade A; Atividade B",
    certificacoes: "",
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
    ...parcial,
  };
}

export function linha(parcial: Partial<LinhaRequisito> = {}): LinhaRequisito {
  return {
    requisitoId: "r1",
    declara: "SIM",
    inicio: null,
    fim: null,
    inicioIncompleto: false,
    fimIncompleto: false,
    ...parcial,
  };
}

export function bloco(parcial: Partial<Bloco> = {}): Bloco {
  return {
    indice: 1,
    cliente: "Cliente ACME",
    projeto: "Projeto Alfa",
    funcao: "Arquiteto de software",
    projInicio: ma(2020, 1),
    projFim: ma(2020, 12),
    linhas: [linha()],
    ...parcial,
  };
}

export function declaracao(parcial: Partial<Declaracao> = {}): Declaracao {
  const identificacao = {
    nome: "Ana Ferreira",
    entidadeConcorrente: "ABC, Lda.",
    procedimento: "20270001",
    lote: "1",
    loteDesignacao: "Lote Teste",
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
    nomeProjeto: "Projeto Teste",
    nomeProcedimento: "Procedimento Teste",
    taxaIva: TAXA_IVA_PADRAO,
    umLotePorConcorrente: false,
    lotes: entradas.map((e, idx) => ({
      id: `lote-${idx}`,
      numero: e.numero,
      designacao: `Lote ${e.numero}`,
      perfis: e.perfis.map((p) => ({ ...criarPerfilEmLote(p), horas: 100, valorHora: 50, nMinimoElementos: 2 })),
    })),
  };
}
