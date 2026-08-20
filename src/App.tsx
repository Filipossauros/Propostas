import { useState } from "react";
import type { LotesJSON, PerfilJSON } from "./core/types";
import { SCHEMA_VERSION_ATUAL } from "./core/types";
import { CHAVE_LOTES, CHAVE_PERFIS } from "./core/persistencia";
import { ehListaDePerfisGuardada } from "./core/perfil";
import { lotePorPerfilId, lotesIniciais, sincronizarPerfisEmLotes } from "./core/lotes";
import { useEstadoPersistente } from "./core/useEstadoPersistente";
import { Modulo1 } from "./modulo1/Modulo1";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";

type Aba = "modulo1" | "modulo2" | "modulo3";

const ABAS: Array<{ chave: Aba; numero: string; titulo: string; descricao: string }> = [
  { chave: "modulo1", numero: "1", titulo: "Perfis", descricao: "Requisitos e formulário" },
  { chave: "modulo2", numero: "2", titulo: "Lotes", descricao: "Agrupamento e preço base" },
  { chave: "modulo3", numero: "3", titulo: "Avaliação", descricao: "Apuramento das declarações" },
];

function ehLotesGuardado(valor: unknown): valor is LotesJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Partial<LotesJSON>;
  return l.tipo === "lotes" && l.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(l.lotes);
}

function App() {
  const [aba, setAba] = useState<Aba>("modulo1");

  // O catálogo de perfis e o agrupamento em lotes vivem aqui, e não dentro dos
  // respetivos módulos, porque são partilhados: o Módulo 1 define os perfis, o
  // Módulo 2 agrupa-os e também os pode carregar de ficheiro. Ter um só dono
  // para cada um é o que permite que uma alteração feita num módulo se reflita
  // no outro — ver `aplicarPerfis`.
  const [perfis, setPerfis] = useEstadoPersistente<PerfilJSON[]>(CHAVE_PERFIS, () => [], ehListaDePerfisGuardada);
  const [lotes, setLotes] = useEstadoPersistente<LotesJSON>(CHAVE_LOTES, lotesIniciais, ehLotesGuardado);

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

  function irPara(destino: Aba) {
    setAba(destino);
    window.scrollTo({ top: 0 });
  }

  return (
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
        </nav>
      </header>

      <main>
        {aba === "modulo1" && (
          <Modulo1
            perfis={perfis}
            onAlterarPerfis={aplicarPerfis}
            lotePorPerfilId={lotePorPerfilId(lotes)}
            onIrParaLotes={() => irPara("modulo2")}
          />
        )}
        {aba === "modulo2" && (
          <Modulo2
            perfis={perfis}
            config={lotes}
            onAlterarConfig={setLotes}
            onAcrescentarPerfis={acrescentarPerfis}
            onSubstituirPerfis={aplicarPerfis}
            onIrParaPerfis={() => irPara("modulo1")}
          />
        )}
        {aba === "modulo3" && <Modulo3 />}
      </main>

      <footer className="app-rodape">
        <p>
          Aplicação 100% local: nenhum ficheiro sai do posto de trabalho e não há qualquer chamada de rede. Os perfis e
          o agrupamento em edição são guardados neste navegador; os dados das declarações em avaliação vivem apenas em
          memória e desaparecem ao fechar o separador.
        </p>
      </footer>
    </div>
  );
}

export default App;
