import { useRef, useState } from "react";
import type { PerfilJSON } from "../core/types";
import { SCHEMA_VERSION_ATUAL } from "../core/types";
import {
  ErroImportacao,
  gerarTextoCadernoEncargos,
  importarPerfilJSON,
  perfilParaJSON,
  validarPerfil,
} from "../core/perfil";
import { PERFIL_EXEMPLO } from "../core/exemplo";
import { CHAVE_PERFIL, PERSISTENCIA_DISPONIVEL } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { gerarDeclaracaoExcelBlob } from "../excel/gerar";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { CampoNumero } from "../ui/CampoNumero";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { BlocoCopiavel } from "../ui/BlocoCopiavel";
import { RequisitosEditor } from "./RequisitosEditor";

interface Props {
  /** Entrega o perfil ao Módulo 2 e muda de separador, sem passar por ficheiro. */
  onEnviarParaLotes: (perfil: PerfilJSON) => void;
}

function perfilInicial(): PerfilJSON {
  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    tipo: "perfil",
    perfil: "",
    nBlocos: 15,
    requisitos: [],
  };
}

function ehPerfilGuardado(valor: unknown): valor is PerfilJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const p = valor as Partial<PerfilJSON>;
  return p.tipo === "perfil" && p.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(p.requisitos);
}

function nomeBase(perfil: PerfilJSON): string {
  return `Declaracao_Experiencia_${nomeSeguro(perfil.perfil, "Perfil")}`;
}

export function Modulo1({ onEnviarParaLotes }: Props) {
  const [perfil, setPerfil] = useEstadoPersistente<PerfilJSON>(CHAVE_PERFIL, perfilInicial, ehPerfilGuardado);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);

  const erros = validarPerfil(perfil);
  const podeExportar = erros.length === 0;
  const textoCaderno = perfil.requisitos.length > 0 ? gerarTextoCadernoEncargos(perfil.requisitos) : "";

  function patch(alteracao: Partial<PerfilJSON>) {
    setPerfil((atual) => ({ ...atual, ...alteracao }));
  }

  async function gerarExcel() {
    setMensagem(null);
    setAGerar(true);
    try {
      descarregarBlob(await gerarDeclaracaoExcelBlob(perfil), `${nomeBase(perfil)}.xlsx`);
    } finally {
      setAGerar(false);
    }
  }

  function descarregarJSON() {
    setMensagem(null);
    descarregarBlob(new Blob([perfilParaJSON(perfil)], { type: "application/json" }), `${nomeBase(perfil)}.json`);
  }

  async function importarJSON(ficheiro: File) {
    try {
      setPerfil(importarPerfilJSON(await ficheiro.text()));
      setMensagem({ tipo: "sucesso", texto: "Perfil importado." });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível importar o ficheiro.",
      });
    }
  }

  function carregarExemplo() {
    setPerfil(structuredClone(PERFIL_EXEMPLO));
    setMensagem({ tipo: "sucesso", texto: "Perfil de exemplo carregado." });
  }

  function recomecar() {
    if (!confirm("Apagar o perfil em edição e recomeçar do zero?")) return;
    setPerfil(perfilInicial());
    setMensagem({ tipo: "sucesso", texto: "Perfil reposto." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 1 · Definição do perfil</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          Define os requisitos mínimos de experiência de um perfil e gera o formulário de declaração a entregar aos
          concorrentes. Nem o número do procedimento nem o lote são pedidos aqui: nesta fase ainda não existem, e o
          agrupamento em lotes faz-se depois, no Módulo 2.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Identificação do perfil</h3>
        </header>

        <div className="grelha-campos">
          <label className="campo-largo">
            <span className="rotulo">Perfil</span>
            <input
              type="text"
              value={perfil.perfil}
              placeholder="ex.: Arquiteto / Programador Sénior — Integração"
              onChange={(e) => patch({ perfil: e.target.value })}
              aria-invalid={perfil.perfil.trim() === ""}
            />
          </label>

          <label>
            <span className="rotulo">N.º de blocos de projeto do formulário</span>
            <CampoNumero
              valor={perfil.nBlocos}
              min={1}
              step={1}
              sufixo="blocos"
              invalido={!Number.isInteger(perfil.nBlocos) || perfil.nBlocos < 1}
              onChange={(nBlocos) => patch({ nBlocos })}
            />
            <span className="ajuda">Quantos projetos distintos cada candidato poderá declarar.</span>
          </label>
        </div>
      </section>

      <RequisitosEditor requisitos={perfil.requisitos} onChange={(requisitos) => patch({ requisitos })} />

      {erros.length > 0 && (
        <section className="painel painel-erros">
          <h3>
            {erros.length} {erros.length === 1 ? "questão por resolver" : "questões por resolver"}
          </h3>
          <ul className="lista-erros">
            {erros.map((e, idx) => (
              <li key={`${e.campo}-${idx}`}>{e.mensagem}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Saídas</h3>
        </header>
        <div className="acoes">
          <button type="button" className="botao-principal" onClick={gerarExcel} disabled={aGerar || !podeExportar}>
            {aGerar ? "A gerar…" : "Descarregar formulário Excel"}
          </button>
          <button type="button" className="botao-secundario" onClick={descarregarJSON} disabled={!podeExportar}>
            Descarregar perfil (JSON)
          </button>
          <button type="button" className="botao-secundario" onClick={() => inputImportarRef.current?.click()}>
            Importar perfil (JSON)
          </button>
          <input
            ref={inputImportarRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importarJSON(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
        {PERSISTENCIA_DISPONIVEL && (
          <p className="ajuda">O perfil em edição é guardado neste navegador e reaparece na próxima sessão.</p>
        )}
      </section>

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para o agrupamento em lotes</h3>
          <p className="painel-nota">
            Envia este perfil diretamente para o Módulo 2, sem passar por ficheiro. Continua a poder guardar o JSON e
            importá-lo lá mais tarde — por exemplo, se o agrupamento for feito por outra pessoa.
          </p>
        </div>
        <button
          type="button"
          className="botao-principal"
          disabled={!podeExportar}
          onClick={() => {
            onEnviarParaLotes(structuredClone(perfil));
          }}
        >
          Enviar para o Módulo 2 →
        </button>
      </section>

      {textoCaderno !== "" && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Texto para o caderno de encargos</h3>
            <p className="painel-nota">Só os requisitos deste perfil. O texto completo, por lote, sai do Módulo 2.</p>
          </header>
          <BlocoCopiavel texto={textoCaderno} onMensagem={setMensagem} />
        </section>
      )}
    </div>
  );
}
