import { useState } from "react";
import { Modulo1 } from "./modulo1/Modulo1";
import { Modulo2 } from "./modulo2/Modulo2";

type Aba = "modulo1" | "modulo2";

function App() {
  const [aba, setAba] = useState<Aba>("modulo1");

  return (
    <div className="app">
      <header className="app-header">
        <h1>Propostas</h1>
        <p>Definição de requisitos e avaliação de experiência profissional</p>
        <nav className="abas">
          <button type="button" onClick={() => setAba("modulo1")} disabled={aba === "modulo1"}>
            Módulo 1 — Requisitos
          </button>
          <button type="button" onClick={() => setAba("modulo2")} disabled={aba === "modulo2"}>
            Módulo 2 — Avaliação
          </button>
        </nav>
      </header>
      <main>{aba === "modulo1" ? <Modulo1 /> : <Modulo2 />}</main>
    </div>
  );
}

export default App;
