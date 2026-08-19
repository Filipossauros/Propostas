import { useState } from "react";
import type { PerfilJSON } from "./core/types";
import { SCHEMA_VERSION_ATUAL } from "./core/types";
import { CHAVE_POR_ATRIBUIR } from "./core/persistencia";
import { useEstadoPersistente } from "./core/useEstadoPersistente";
import { Modulo1 } from "./modulo1/Modulo1";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";

type Aba = "modulo1" | "modulo2" | "modulo3";

const ABAS: Array<{ chave: Aba; numero: string; titulo: string; descricao: string }> = [
  { chave: "modulo1", numero: "1", titulo: "Perfil", descricao: "Requisitos e formulário" },
  { chave: "modulo2", numero: "2", titulo: "Lotes", descricao: "Agrupamento e preço base" },
  { chave: "modulo3", numero: "3", titulo: "Avaliação", descricao: "Apuramento das declarações" },
];

function ehListaDePerfis(valor: unknown): valor is PerfilJSON[] {
  return (
    Array.isArray(valor) &&
    valor.every((p) => {
      if (typeof p !== "object" || p === null) return false;
      const perfil = p as Partial<PerfilJSON>;
      return perfil.tipo === "perfil" && perfil.schemaVersion === SCHEMA_VERSION_ATUAL;
    })
  );
}

function App() {
  const [aba, setAba] = useState<Aba>("modulo1");

  // Vive aqui, e não dentro do Módulo 2, para que o Módulo 1 possa entregar um
  // perfil diretamente ao Módulo 2 sem passar por ficheiro.
  const [porAtribuir, setPorAtribuir] = useEstadoPersistente<PerfilJSON[]>(
    CHAVE_POR_ATRIBUIR,
    () => [],
    ehListaDePerfis,
  );

  function enviarParaLotes(perfil: PerfilJSON) {
    setPorAtribuir((atual) => [...atual, perfil]);
    setAba("modulo2");
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
        {aba === "modulo1" && <Modulo1 onEnviarParaLotes={enviarParaLotes} />}
        {aba === "modulo2" && <Modulo2 porAtribuir={porAtribuir} onAlterarPorAtribuir={setPorAtribuir} />}
        {aba === "modulo3" && <Modulo3 />}
      </main>

      <footer className="app-rodape">
        <p>
          Aplicação 100% local: nenhum ficheiro sai do posto de trabalho e não há qualquer chamada de rede. O perfil e
          o agrupamento em edição são guardados neste navegador; os dados das declarações em avaliação vivem apenas em
          memória e desaparecem ao fechar o separador.
        </p>
      </footer>
    </div>
  );
}

export default App;
