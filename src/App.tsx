import { useState } from "react";
import type { LotesJSON, PerfilJSON } from "./core/types";
import { SCHEMA_VERSION_ATUAL } from "./core/types";
import { CHAVE_DESCRICAO_PROJETO, CHAVE_LOTES, CHAVE_NOME_PROJETO, CHAVE_PERFIS } from "./core/persistencia";
import { ehListaDePerfisGuardada } from "./core/perfil";
import { lotePorPerfilId, lotesIniciais, normalizarLotesGuardados, sincronizarPerfisEmLotes } from "./core/lotes";
import { useEstadoPersistente } from "./core/useEstadoPersistente";
import { ProtecaoExemplos } from "./ui/ProtecaoExemplos";
import { Modulo1 } from "./modulo1/Modulo1";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";
import { Modulo4, type Apuramento } from "./modulo4/Modulo4";
import { VistaGeral } from "./vistaGeral/VistaGeral";
import { VistaGeralDirecao } from "./direcao/VistaGeralDirecao";

type Aba = "modulo1" | "modulo2" | "modulo3" | "modulo4" | "vistaGeral" | "vistaDirecao";

const ABAS: Array<{ chave: Aba; numero: string; titulo: string; descricao: string }> = [
  { chave: "modulo1", numero: "1", titulo: "Perfis", descricao: "Requisitos e formulário" },
  { chave: "modulo2", numero: "2", titulo: "Lotes", descricao: "Agrupamento e preço base" },
  { chave: "modulo3", numero: "3", titulo: "Avaliação", descricao: "Apuramento das declarações" },
  { chave: "modulo4", numero: "4", titulo: "Ordenação", descricao: "Preço e classificação" },
];

/**
 * As vistas gerais não são o quinto passo de nada.
 *
 * Os quatro módulos são um caminho: perfis, lotes, avaliação, ordenação, sempre
 * do mesmo procedimento. Estas olham para muitos procedimentos ao mesmo tempo,
 * e por isso ficam à parte — numa linha própria, por baixo dos quatro, e com
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
    titulo: "Vista Geral da Unidade",
    descricao: "Orçamento e pessoas da unidade",
  },
  {
    chave: "vistaDirecao",
    marca: "ΣΣ",
    classe: "aba-direcao",
    titulo: "Vista Geral da Direção",
    descricao: "As unidades da direção lado a lado",
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
  const [aba, setAba] = useState<Aba>("modulo1");

  // O apuramento entregue pelo Módulo 3 ao Módulo 4 vive aqui, em memória e
  // nunca no navegador: traz as declarações dos candidatos, que são dados
  // pessoais e desaparecem ao fechar o separador.
  const [apuramentoParaOrdenar, setApuramentoParaOrdenar] = useState<Apuramento | null>(null);

  // O catálogo de perfis e o agrupamento em lotes vivem aqui, e não dentro dos
  // respetivos módulos, porque são partilhados: o Módulo 1 define os perfis, o
  // Módulo 2 agrupa-os e também os pode carregar de ficheiro. Ter um só dono
  // para cada um é o que permite que uma alteração feita num módulo se reflita
  // no outro — ver `aplicarPerfis`.
  const [perfis, setPerfis] = useEstadoPersistente<PerfilJSON[]>(CHAVE_PERFIS, () => [], ehListaDePerfisGuardada);
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

  function irPara(destino: Aba) {
    setAba(destino);
    window.scrollTo({ top: 0 });
  }

  return (
    <ProtecaoExemplos>
      <div className="app">
      <header className="app-cabecalho">
        <div className="marca">
          <h1>Propostas</h1>
          <p>Requisitos de experiência profissional e avaliação de propostas</p>
        </div>

        <nav className="abas" aria-label="Módulos">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              className={aba === a.chave ? "aba aba-ativa" : "aba"}
              aria-current={aba === a.chave ? "page" : undefined}
              onClick={() => setAba(a.chave)}
            >
              <span className="aba-numero">{a.numero}</span>
              <span className="aba-texto">
                <span className="aba-titulo">{a.titulo}</span>
                <span className="aba-descricao">{a.descricao}</span>
              </span>
            </button>
          ))}

          {/* Força a vista para uma linha própria, por baixo dos quatro módulos. */}
          <span className="abas-quebra" aria-hidden="true" />

          {ABAS_DE_VISTA.map((v) => (
            <button
              key={v.chave}
              type="button"
              className={aba === v.chave ? `aba ${v.classe} aba-ativa` : `aba ${v.classe}`}
              aria-current={aba === v.chave ? "page" : undefined}
              onClick={() => setAba(v.chave)}
            >
              <span className="aba-numero" aria-hidden="true">
                {v.marca}
              </span>
              <span className="aba-texto">
                <span className="aba-titulo">{v.titulo}</span>
                <span className="aba-descricao">{v.descricao}</span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <main>
        {aba === "modulo1" && (
          <Modulo1
            perfis={perfis}
            onAlterarPerfis={aplicarPerfis}
            nomeProjeto={nomeProjeto}
            onAlterarNomeProjeto={setNomeProjeto}
            onAdotarNomeProjeto={adotarNomeProjeto}
            descricaoProjeto={descricaoProjeto}
            onAlterarDescricaoProjeto={setDescricaoProjeto}
            onAdotarDescricaoProjeto={adotarDescricaoProjeto}
            lotePorPerfilId={lotePorPerfilId(lotes)}
            onIrParaLotes={() => irPara("modulo2")}
          />
        )}
        {aba === "modulo2" && (
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
            onAcrescentarPerfis={acrescentarPerfis}
            onSubstituirPerfis={aplicarPerfis}
          />
        )}
        {aba === "modulo3" && (
          <Modulo3
            onIrParaOrdenacao={(resultado, config) => {
              setApuramentoParaOrdenar({ resultado, config });
              irPara("modulo4");
            }}
          />
        )}

        {aba === "modulo4" && (
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
