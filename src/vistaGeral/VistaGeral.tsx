import { useRef, useState } from "react";
import { importarLotesJSON } from "../core/lotes";
import { ErroImportacao } from "../core/perfil";
import {
  comInterno,
  comProjeto,
  importarOrcamentoJSON,
  jaTemProjeto,
  nomeDoProjeto,
  orcamentoInicial,
  orcamentoParaJSON,
  projetoDeAgrupamento,
  semEntrada,
  semInterno,
  semProjeto,
  type OrcamentoUnidade,
} from "../core/vistaGeral";
import { gerarVistaGeralBlob } from "../excel/vistaGeral";
import { descarregarBlob, nomeSeguro } from "../ui/descarregar";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { ResumoGeral } from "./ResumoGeral";
import { TabelaVistaGeral } from "./TabelaVistaGeral";

/**
 * Vista Geral — o orçamento da unidade.
 *
 * Ao contrário dos quatro módulos, não prepara nem avalia procedimento nenhum:
 * junta os que já estão preparados. E, ao contrário deles, não guarda nada no
 * navegador — traz nomes de pessoas da equipa, e o compromisso desta aplicação
 * é não guardar nomes de pessoas. Quem quiser conservar o trabalho descarrega o
 * JSON do orçamento e volta a carregá-lo da próxima vez.
 */
export function VistaGeral() {
  const [orcamento, setOrcamento] = useState<OrcamentoUnidade>(orcamentoInicial);
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

  async function descarregarExcel() {
    setMensagem(null);
    try {
      const blob = await gerarVistaGeralBlob(orcamento);
      descarregarBlob(blob, `${nomeSeguro(orcamento.unidade, "Unidade")}_Vista_Geral.xlsx`);
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o Excel." });
    }
  }

  function descarregarJSON() {
    const blob = new Blob([orcamentoParaJSON(orcamento)], { type: "application/json" });
    descarregarBlob(blob, `${nomeSeguro(orcamento.unidade, "Unidade")}_Vista_Geral.json`);
  }

  return (
    <>
      <div className="modulo-cabecalho modulo-cabecalho-unidade">
        <h2>Vista Geral</h2>
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
            Carregue os JSON de agrupamento gerados no Módulo 2 — um por projeto, ou vários de uma vez. Reimportar um
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
            Importar agrupamentos (JSON)
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

        {/* Dito onde se decide guardar, e não escondido numa nota de rodapé: quem
            fecha o separador sem descarregar perde o trabalho todo. */}
        <p className="ajuda">
          Esta vista não fica guardada no navegador — traz nomes de pessoas da equipa, e esta aplicação não guarda
          nomes de pessoas. Para a conservar, descarregue a Vista Geral em JSON, ao fundo da página, e volte a
          carregá-la da próxima vez.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Resumo geral</h3>
          <p className="painel-nota">
            Um projeto por linha: quantas pessoas leva, que fatia da unidade ocupa e quanto vale.
          </p>
        </header>

        <ResumoGeral orcamento={orcamento} />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Projetos, pessoas e valores</h3>
          <p className="painel-nota">
            O detalhe de cada projeto, perfil a perfil. É aqui que se registam os elementos internos e se apaga o que
            não pertence à vista.
          </p>
        </header>

        <TabelaVistaGeral
          orcamento={orcamento}
          onRemoverProjeto={(projetoId) => setOrcamento((atual) => semProjeto(atual, projetoId))}
          onRemoverEntrada={(projetoId, entradaId) => setOrcamento((atual) => semEntrada(atual, projetoId, entradaId))}
          onRemoverInterno={(projetoId, internoId) => setOrcamento((atual) => semInterno(atual, projetoId, internoId))}
          onAcrescentarInterno={(projetoId, nome) => setOrcamento((atual) => comInterno(atual, projetoId, nome))}
        />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Ficheiros</h3>
        </header>
        <div className="acoes">
          <button type="button" className="botao-principal" disabled={semDados} onClick={() => void descarregarExcel()}>
            Descarregar Vista Geral (Excel)
          </button>
          <button type="button" className="botao-secundario" disabled={semDados} onClick={descarregarJSON}>
            Descarregar Vista Geral (JSON)
          </button>
        </div>
        <p className="ajuda">
          O Excel leva as duas tabelas, uma por folha: o resumo geral e o detalhe por projeto. O JSON é o que volta a
          carregar-se aqui, com tudo como está — incluindo os elementos internos.
        </p>
      </section>
    </>
  );
}
