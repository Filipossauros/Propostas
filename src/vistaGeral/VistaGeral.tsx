import { useRef, useState } from "react";
import { importarLotesJSON } from "../core/lotes";
import { CHAVE_VISTA_GERAL } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { ErroImportacao } from "../core/perfil";
import {
  comInterno,
  comProjeto,
  comProjetoDeslocado,
  comProjetoMovido,
  ehOrcamentoGuardado,
  importarOrcamentoJSON,
  normalizarOrcamento,
  jaTemProjeto,
  nomeDoProjeto,
  orcamentoInicial,
  projetoDeAgrupamento,
  semInterno,
  semProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import { descarregarPacote } from "../ui/pacote";
import { ficheirosDaVistaGeral, nomeDoPacoteDaVistaGeral } from "../saidas/pacotes";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { ResumoGeral } from "./ResumoGeral";
import { TabelaVistaGeral } from "./TabelaVistaGeral";

/**
 * Vista Geral — o orçamento da unidade.
 *
 * Ao contrário dos quatro módulos, não prepara nem avalia procedimento nenhum:
 * junta os que já estão preparados. Como eles, fica guardada neste navegador —
 * mudar de separador não pode apagar o trabalho de juntar uma unidade inteira.
 */
export function VistaGeral() {
  const [orcamento, setOrcamento] = useEstadoPersistente<OrcamentoUnidade>(
    CHAVE_VISTA_GERAL,
    orcamentoInicial,
    ehOrcamentoGuardado,
    normalizarOrcamento,
  );
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputAgrupamentosRef = useRef<HTMLInputElement>(null);
  const inputOrcamentoRef = useRef<HTMLInputElement>(null);

  const semDados = orcamento.projetos.length === 0;

  async function carregarAgrupamentos(ficheiros: FileList) {
    setMensagem(null);
    const lidos: string[] = [];
    const substituidos: string[] = [];
    const falhas: string[] = [];
    let acumulado = orcamento;

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const config = importarLotesJSON(await ficheiro.text());
        const nome = nomeDoProjeto(config);
        if (jaTemProjeto(acumulado, nome)) substituidos.push(nome);
        else lidos.push(nome);
        acumulado = comProjeto(acumulado, projetoDeAgrupamento(config));
      } catch (erro) {
        falhas.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    setOrcamento(acumulado);

    if (falhas.length > 0 && lidos.length === 0 && substituidos.length === 0) {
      setMensagem({ tipo: "erro", texto: falhas.join(" · ") });
      return;
    }
    const partes: string[] = [];
    if (lidos.length > 0) partes.push(`${lidos.length} projeto(s) acrescentado(s): ${lidos.join(", ")}`);
    if (substituidos.length > 0) partes.push(`${substituidos.length} atualizado(s): ${substituidos.join(", ")}`);
    if (falhas.length > 0) partes.push(`${falhas.length} ficheiro(s) por ler`);
    setMensagem({ tipo: falhas.length > 0 ? "erro" : "sucesso", texto: partes.join(" · ") });
  }

  async function carregarOrcamento(ficheiro: File) {
    setMensagem(null);
    try {
      const lido = importarOrcamentoJSON(await ficheiro.text());
      setOrcamento(lido);
      setMensagem({
        tipo: "sucesso",
        texto: `Orçamento carregado, com ${lido.projetos.length} projeto(s).`,
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível ler o ficheiro.",
      });
    }
  }

  async function descarregarVistaGeral() {
    setMensagem(null);
    try {
      await descarregarPacote(nomeDoPacoteDaVistaGeral(orcamento), await ficheirosDaVistaGeral(orcamento));
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o pacote da Vista Geral." });
    }
  }

  /**
   * Repõe a vista do zero.
   *
   * Pergunta antes, e diz o que leva com ela: os nomes dos elementos internos
   * foram escritos à mão, um a um, e não voltam de nenhum ficheiro importado.
   */
  // A ordem dos projetos é uma só, e vive aqui: as duas tabelas arrastam sobre
  // ela, e é por isso que arrastar numa se vê logo na outra.
  function moverProjeto(arrastadoId: string, alvoId: string) {
    setOrcamento((atual) => comProjetoMovido(atual, arrastadoId, alvoId));
  }

  function deslocarProjeto(projetoId: string, passos: number) {
    setOrcamento((atual) => comProjetoDeslocado(atual, projetoId, passos));
  }

  function recomecar() {
    if (!confirm("Apagar a Vista Geral, incluindo os elementos internos registados, e recomeçar do zero?")) return;
    setOrcamento(orcamentoInicial());
    setMensagem({ tipo: "sucesso", texto: "Vista Geral reposta." });
  }

  return (
    <>
      <div className="modulo-cabecalho modulo-cabecalho-unidade">
        <div className="modulo-titulo-linha">
          <h2>Vista Geral</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar} disabled={semDados}>
              Recomeçar
            </button>
          </div>
        </div>
        <p>
          Os agrupamentos da unidade lado a lado: quantas pessoas e quanto dinheiro em cada projeto, e que fatia da
          equipa cada um ocupa.
        </p>
      </div>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Orçamento da unidade</h3>
          <p className="painel-nota">
            Carregue os JSON de lotes gerados no Módulo 2 — um por projeto, ou vários de uma vez. Reimportar um
            projeto atualiza-o, em vez de o duplicar.
          </p>
        </header>

        <label className="campo-unidade">
          <span>Unidade</span>
          <input
            type="text"
            value={orcamento.unidade}
            placeholder="Nome da unidade (sai nos ficheiros)"
            onChange={(e) => setOrcamento((atual) => ({ ...atual, unidade: e.target.value }))}
          />
        </label>

        <div className="acoes">
          <button type="button" className="botao-principal" onClick={() => inputAgrupamentosRef.current?.click()}>
            Importar lotes (JSON)
          </button>
          <input
            ref={inputAgrupamentosRef}
            type="file"
            multiple
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) void carregarAgrupamentos(e.target.files);
              e.target.value = "";
            }}
          />

          <button type="button" className="botao-secundario" onClick={() => inputOrcamentoRef.current?.click()}>
            Carregar Vista Geral (JSON)
          </button>
          <input
            ref={inputOrcamentoRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void carregarOrcamento(ficheiro);
              e.target.value = "";
            }}
          />

        </div>

        {/* A vista traz nomes de pessoas da equipa: quem a preenche tem de saber
            onde ficam, e que ficam só aqui. */}
        <p className="ajuda">
          Esta vista fica guardada neste navegador, incluindo os nomes dos elementos internos, e não sai deste posto
          de trabalho. Apagar um projeto apaga também os nomes que lhe estavam afetos. Para a levar para outro posto,
          descarregue a Vista Geral em JSON, ao fundo da página.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Resumo geral</h3>
          <p className="painel-nota">As pessoas de todos os projetos na unidade.</p>
        </header>

        <ResumoGeral
          orcamento={orcamento}
          onMoverProjeto={moverProjeto}
          onDeslocarProjeto={deslocarProjeto}
        />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Projetos, pessoas e valores</h3>
          <p className="painel-nota">Detalhe de cada projeto, perfil a perfil.</p>
        </header>

        <TabelaVistaGeral
          orcamento={orcamento}
          onRemoverProjeto={(projetoId) => setOrcamento((atual) => semProjeto(atual, projetoId))}
          onRemoverInterno={(projetoId, internoId) => setOrcamento((atual) => semInterno(atual, projetoId, internoId))}
          onAcrescentarInterno={(projetoId, nome) => setOrcamento((atual) => comInterno(atual, projetoId, nome))}
          onMoverProjeto={moverProjeto}
          onDeslocarProjeto={deslocarProjeto}
        />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Ficheiros</h3>
        </header>
        <div className="acoes">
          <button
            type="button"
            className="botao-principal"
            disabled={semDados}
            onClick={() => void descarregarVistaGeral()}
          >
            Descarregar Vista Geral (ZIP)
          </button>
        </div>
        <p className="ajuda">
          Um ZIP com o Excel e o JSON. O Excel contempla duas tabelas, uma por folha: o resumo geral e o detalhe por
          projeto. O nome do ficheiro leva os anos de início dos projetos carregados.
        </p>
      </section>
    </>
  );
}
