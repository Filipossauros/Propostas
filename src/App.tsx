import { useState } from "react";
import type { JustificacaoProjeto, LotesJSON, PerfilJSON } from "./core/types";
import { SCHEMA_VERSION_ATUAL } from "./core/types";
import {
  CHAVE_DESCRICAO_PROJETO,
  CHAVE_JUSTIFICACAO_PROJETO,
  CHAVE_LOTES,
  CHAVE_NOME_PROJETO,
  CHAVE_PERFIS,
} from "./core/persistencia";
import {
  ehJustificacaoGuardada,
  justificacaoInicial,
  normalizarJustificacao,
  temJustificacao,
  validarJustificacao,
} from "./core/justificacao";
import {
  ehListaDePerfisGuardada,
  normalizarPerfisGuardados,
  validarDescricaoProjeto,
  validarNomeProjeto,
  validarPerfis,
} from "./core/perfil";
import {
  lotePorPerfilId,
  lotesIniciais,
  normalizarLotesGuardados,
  sincronizarPerfisEmLotes,
  validarCategoriasEavalia,
  validarLotes,
} from "./core/lotes";
import { useEstadoPersistente } from "./core/useEstadoPersistente";
import { ProtecaoExemplos } from "./ui/ProtecaoExemplos";
import { ModuloProjeto } from "./projeto/ModuloProjeto";
import { ModuloPerfis } from "./modulo1/ModuloPerfis";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";
import { Modulo4, type Apuramento } from "./modulo4/Modulo4";
import { VistaGeral } from "./vistaGeral/VistaGeral";
import { VistaGeralDirecao } from "./direcao/VistaGeralDirecao";

type Aba = "projeto" | "perfis" | "lotes" | "avaliacao" | "ordenacao" | "vistaGeral" | "vistaDirecao";

interface AbaDeModulo {
  chave: Aba;
  numero: string;
  titulo: string;
  descricao: string;
}

/**
 * Os cinco módulos, em dois grupos: a preparação do procedimento, feita por
 * quem o lança, e a análise das propostas, feita pelo júri. São momentos e
 * pessoas diferentes, e o menu mostra-o.
 */
const GRUPOS_DE_ABAS: Array<{ titulo: string; abas: AbaDeModulo[] }> = [
  {
    titulo: "Preparação do procedimento",
    abas: [
      { chave: "projeto", numero: "1", titulo: "Projeto", descricao: "Descrição e justificação" },
      { chave: "perfis", numero: "2", titulo: "Perfis", descricao: "Requisitos e conteúdo" },
      { chave: "lotes", numero: "3", titulo: "Lotes", descricao: "Valor e Anexo Técnico" },
    ],
  },
  {
    titulo: "Análise das propostas",
    abas: [
      { chave: "avaliacao", numero: "4", titulo: "Avaliação", descricao: "Apuramento" },
      { chave: "ordenacao", numero: "5", titulo: "Ordenação", descricao: "Preço e vencedores" },
    ],
  },
];

/** O estado de um módulo, dito no próprio separador: o que falta, ou que está completo. */
interface EstadoDaAba {
  texto: string;
  falta: boolean;
}

function estadoPorErros(n: number): EstadoDaAba {
  return n === 0
    ? { texto: "completo", falta: false }
    : { texto: n === 1 ? "1 questão por resolver" : `${n} questões por resolver`, falta: true };
}

/**
 * As vistas gerais não são o sexto passo de nada.
 *
 * Os cinco módulos são um caminho: projeto, perfis, lotes, avaliação,
 * ordenação, sempre do mesmo procedimento. Estas olham para muitos
 * procedimentos ao mesmo tempo, e por isso ficam à parte — no canto do
 * cabeçalho, fora do menu dos módulos, e com
 * cor própria, para não se lerem como o passo a seguir à ordenação.
 *
 * São duas, uma por cada altura a que a pergunta se faz: a da unidade junta os
 * procedimentos de uma unidade, a da direção junta as unidades. Cada uma leva a
 * sua cor: quem trabalha numa não está a trabalhar na outra.
 */
const ABAS_DE_VISTA: Array<{ chave: Aba; marca: string; classe: string; titulo: string; descricao: string }> = [
  {
    chave: "vistaGeral",
    marca: "Σ",
    classe: "aba-unidade",
    titulo: "Unidade",
    descricao: "Vista Geral da Unidade: orçamento e pessoas da unidade",
  },
  {
    chave: "vistaDirecao",
    marca: "ΣΣ",
    classe: "aba-direcao",
    titulo: "Direção",
    descricao: "Vista Geral da Direção: as unidades da direção lado a lado",
  },
];

function ehTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

function ehLotesGuardado(valor: unknown): valor is LotesJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Partial<LotesJSON>;
  return l.tipo === "lotes" && l.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(l.lotes);
}

function App() {
  const [aba, setAba] = useState<Aba>("projeto");

  // O apuramento entregue pelo Módulo 4 ao Módulo 5 vive aqui, em memória e
  // nunca no navegador: traz as declarações dos candidatos, que são dados
  // pessoais e desaparecem ao fechar o separador.
  const [apuramentoParaOrdenar, setApuramentoParaOrdenar] = useState<Apuramento | null>(null);

  // O catálogo de perfis e o agrupamento em lotes vivem aqui, e não dentro dos
  // respetivos módulos, porque são partilhados: o Módulo 2 define os perfis, o
  // Módulo 3 agrupa-os e também os pode carregar de ficheiro. Ter um só dono
  // para cada um é o que permite que uma alteração feita num módulo se reflita
  // no outro — ver `aplicarPerfis`.
  const [perfis, setPerfis] = useEstadoPersistente<PerfilJSON[]>(
    CHAVE_PERFIS,
    () => [],
    ehListaDePerfisGuardada,
    normalizarPerfisGuardados,
  );
  const [lotes, setLotes] = useEstadoPersistente<LotesJSON>(
    CHAVE_LOTES,
    lotesIniciais,
    ehLotesGuardado,
    normalizarLotesGuardados,
  );
  const [nomeProjeto, setNomeProjeto] = useEstadoPersistente<string>(
    CHAVE_NOME_PROJETO,
    () => "",
    ehTexto,
  );
  const [descricaoProjeto, setDescricaoProjeto] = useEstadoPersistente<string>(
    CHAVE_DESCRICAO_PROJETO,
    () => "",
    ehTexto,
  );
  const [justificacao, setJustificacao] = useEstadoPersistente<JustificacaoProjeto>(
    CHAVE_JUSTIFICACAO_PROJETO,
    justificacaoInicial,
    ehJustificacaoGuardada,
    normalizarJustificacao,
  );

  /**
   * Ponto único de alteração do catálogo.
   *
   * Depois de atualizar os perfis, repõe-nos nos lotes onde já estejam
   * atribuídos: é isto que torna a edição transversal, em vez de deixar o lote
   * com uma cópia congelada dos requisitos de quando lá foi colocado.
   */
  function aplicarPerfis(novos: PerfilJSON[]) {
    setPerfis(novos);
    setLotes((atual) => sincronizarPerfisEmLotes(atual, novos));
  }

  /** Acrescenta perfis vindos de ficheiro, substituindo os que já existam com o mesmo id. */
  function acrescentarPerfis(novos: PerfilJSON[]) {
    const porId = new Map(perfis.map((p) => [p.id, p]));
    for (const p of novos) porId.set(p.id, p);
    aplicarPerfis([...porId.values()]);
  }

  /**
   * O nome do projeto vive numa só variável, mas é gravado em cada ficheiro
   * exportado. Ao importar, um nome vindo do ficheiro só se aplica se ainda
   * não houver nenhum definido — para uma importação não apagar em silêncio o
   * nome que a pessoa acabou de escrever.
   */
  function adotarNomeProjeto(doFicheiro: string) {
    if (doFicheiro.trim() !== "" && nomeProjeto.trim() === "") setNomeProjeto(doFicheiro);
  }

  /** A descrição do projeto viaja nos mesmos ficheiros, e pela mesma regra. */
  function adotarDescricaoProjeto(doFicheiro: string) {
    if (doFicheiro.trim() !== "" && descricaoProjeto.trim() === "") setDescricaoProjeto(doFicheiro);
  }

  /** Os benefícios e os riscos também — e as duas listas juntas, como foram escritas. */
  function adotarJustificacao(doFicheiro: JustificacaoProjeto) {
    if (temJustificacao(doFicheiro) && !temJustificacao(justificacao)) setJustificacao(doFicheiro);
  }

  // O estado de cada módulo de preparação, para o separador o dizer sem ser
  // preciso abri-lo. Sem nada escrito, o separador mostra só o que lá se faz.
  const estados: Partial<Record<Aba, EstadoDaAba>> = {};
  const projetoVazio = nomeProjeto.trim() === "" && descricaoProjeto.trim() === "" && !temJustificacao(justificacao);
  if (!projetoVazio) {
    estados.projeto = estadoPorErros(
      validarNomeProjeto(nomeProjeto).length +
        validarDescricaoProjeto(descricaoProjeto).length +
        validarJustificacao(justificacao).length,
    );
  }
  if (perfis.length > 0) estados.perfis = estadoPorErros(validarPerfis(perfis).length);
  if (lotes.lotes.length > 0) {
    estados.lotes = estadoPorErros(validarLotes(lotes).length + validarCategoriasEavalia(lotes).length);
  }

  function irPara(destino: Aba) {
    setAba(destino);
    window.scrollTo({ top: 0 });
  }

  return (
    <ProtecaoExemplos>
      <div className="app">
      <header className="app-cabecalho">
        <div className="cabecalho-topo">
          <div className="marca">
            <h1>Manifestações de Necessidades</h1>
            <p>Aquisição de serviços de desenvolvimento e manutenção</p>
          </div>

          <nav className="vistas-topo" aria-label="Vistas de gestão">
            <span className="grupo-abas-titulo">Vistas de gestão</span>
            {ABAS_DE_VISTA.map((v) => (
              <button
                key={v.chave}
                type="button"
                className={aba === v.chave ? `aba ${v.classe} aba-ativa` : `aba ${v.classe}`}
                aria-current={aba === v.chave ? "page" : undefined}
                title={v.descricao}
                onClick={() => setAba(v.chave)}
              >
                <span className="aba-numero" aria-hidden="true">
                  {v.marca}
                </span>
                <span className="aba-texto">
                  <span className="aba-titulo">{v.titulo}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <nav className="menu-modulos" aria-label="Módulos">
          {GRUPOS_DE_ABAS.map((g) => (
            <div key={g.titulo} className="grupo-abas">
              <span className="grupo-abas-titulo">{g.titulo}</span>
              <div className="abas">
                {g.abas.map((a) => {
                  const estado = estados[a.chave];
                  return (
                    <button
                      key={a.chave}
                      type="button"
                      className={aba === a.chave ? "aba aba-modulo aba-ativa" : "aba aba-modulo"}
                      aria-current={aba === a.chave ? "page" : undefined}
                      onClick={() => setAba(a.chave)}
                    >
                      <span className="aba-numero">{a.numero}</span>
                      <span className="aba-texto">
                        <span className="aba-titulo">{a.titulo}</span>
                        <span className={estado?.falta ? "aba-descricao aba-estado-falta" : "aba-descricao"}>
                          {estado?.texto ?? a.descricao}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <main>
        {aba === "projeto" && (
          <ModuloProjeto
            nomeProjeto={nomeProjeto}
            onAlterarNomeProjeto={setNomeProjeto}
            descricaoProjeto={descricaoProjeto}
            onAlterarDescricaoProjeto={setDescricaoProjeto}
            justificacao={justificacao}
            onAlterarJustificacao={setJustificacao}
            onIrParaPerfis={() => irPara("perfis")}
          />
        )}
        {aba === "perfis" && (
          <ModuloPerfis
            perfis={perfis}
            onAlterarPerfis={aplicarPerfis}
            nomeProjeto={nomeProjeto}
            onAdotarNomeProjeto={adotarNomeProjeto}
            descricaoProjeto={descricaoProjeto}
            onAdotarDescricaoProjeto={adotarDescricaoProjeto}
            justificacao={justificacao}
            onAdotarJustificacao={adotarJustificacao}
            lotePorPerfilId={lotePorPerfilId(lotes)}
            onIrParaLotes={() => irPara("lotes")}
          />
        )}
        {aba === "lotes" && (
          <Modulo2
            perfis={perfis}
            config={lotes}
            onAlterarConfig={setLotes}
            nomeProjeto={nomeProjeto}
            onDefinirNomeProjeto={setNomeProjeto}
            onAdotarNomeProjeto={adotarNomeProjeto}
            descricaoProjeto={descricaoProjeto}
            onDefinirDescricaoProjeto={setDescricaoProjeto}
            onAdotarDescricaoProjeto={adotarDescricaoProjeto}
            justificacao={justificacao}
            onDefinirJustificacao={setJustificacao}
            onAdotarJustificacao={adotarJustificacao}
            onAcrescentarPerfis={acrescentarPerfis}
            onSubstituirPerfis={aplicarPerfis}
          />
        )}
        {aba === "avaliacao" && (
          <Modulo3
            onIrParaOrdenacao={(resultado, config) => {
              setApuramentoParaOrdenar({ resultado, config });
              irPara("ordenacao");
            }}
          />
        )}

        {aba === "ordenacao" && (
          <Modulo4 recebido={apuramentoParaOrdenar} onLimparRecebido={() => setApuramentoParaOrdenar(null)} />
        )}

        {aba === "vistaGeral" && <VistaGeral />}
        {aba === "vistaDirecao" && <VistaGeralDirecao />}
      </main>
      </div>
    </ProtecaoExemplos>
  );
}

export default App;
