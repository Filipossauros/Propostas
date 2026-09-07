import { useRef, useState } from "react";
import { formatarMoeda } from "../core/lotes";
import { CHAVE_VISTA_DIRECAO } from "../core/persistencia";
import { useEstadoPersistente } from "../core/useEstadoPersistente";
import { ErroImportacao } from "../core/perfil";
import { importarOrcamentoJSON, pessoasDaUnidade } from "../core/vistaGeral";
import {
  anosDaDirecao,
  aplicarFiltros,
  comUnidade,
  ehVistaDirecaoGuardada,
  externosDaDirecao,
  filtrosIniciais,
  importarVistaDirecaoJSON,
  internosDaDirecao,
  jaTemUnidade,
  nomeDaUnidade,
  normalizarVistaDirecao,
  pessoasDaDirecao,
  semUnidade,
  valorDaDirecao,
  valorDaDirecaoSemIva,
  vistaDirecaoInicial,
  type FiltrosDirecao,
  type VistaDirecao,
} from "../core/vistaGeralDirecao";
import { descarregarBlob } from "../ui/descarregar";
import { descarregarPacote } from "../ui/pacote";
import { gerarVistaDirecaoBlob } from "../excel/vistaDirecao";
import { ficheirosDaVistaDirecao, nomeDoExcelDaDirecao, nomeDoPacoteDaVistaDirecao } from "../saidas/pacotes";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { FiltrosDaDirecao } from "./FiltrosDaDirecao";
import { ResumoPorUnidade } from "./ResumoPorUnidade";
import { TabelaDaDirecao } from "./TabelaDaDirecao";
import { TabelaDeRates } from "./TabelaDeRates";

/**
 * Vista Geral da Direção — as unidades lado a lado.
 *
 * A vista da unidade junta procedimentos; esta junta unidades. O Diretor
 * carrega o ficheiro que cada unidade descarrega no seu separador, e daí para a
 * frente só lê: o que vier das unidades não se edita aqui, para os dois sítios
 * não acabarem a divergir sobre a mesma equipa.
 */
export function VistaGeralDirecao() {
  const [vista, setVista] = useEstadoPersistente<VistaDirecao>(
    CHAVE_VISTA_DIRECAO,
    vistaDirecaoInicial,
    ehVistaDirecaoGuardada,
    normalizarVistaDirecao,
  );
  const [filtros, setFiltros] = useState<FiltrosDirecao>(filtrosIniciais);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputUnidadesRef = useRef<HTMLInputElement>(null);
  const inputVistaRef = useRef<HTMLInputElement>(null);

  const semDados = vista.unidades.length === 0;
  // Tudo o que se mostra sai da vista filtrada: as três tabelas, os totais e o
  // Excel. É o que garante que o ficheiro leva o que está no ecrã.
  const filtrada = aplicarFiltros(vista, filtros);
  const anos = anosDaDirecao(filtrada).filter((ano) => filtros.anos.length === 0 || filtros.anos.includes(ano));

  async function carregarUnidades(ficheiros: FileList) {
    setMensagem(null);
    const lidas: string[] = [];
    const substituidas: string[] = [];
    const falhas: string[] = [];
    let acumulado = vista;

    for (const ficheiro of Array.from(ficheiros)) {
      try {
        const orcamento = importarOrcamentoJSON(await ficheiro.text());
        const nome = nomeDaUnidade(orcamento);
        if (jaTemUnidade(acumulado, nome)) substituidas.push(nome);
        else lidas.push(nome);
        acumulado = comUnidade(acumulado, orcamento);
      } catch (erro) {
        falhas.push(`${ficheiro.name}: ${erro instanceof ErroImportacao ? erro.message : "ficheiro ilegível"}`);
      }
    }

    setVista(acumulado);

    if (falhas.length > 0 && lidas.length === 0 && substituidas.length === 0) {
      setMensagem({ tipo: "erro", texto: falhas.join(" · ") });
      return;
    }
    const partes: string[] = [];
    if (lidas.length > 0) partes.push(`${lidas.length} unidade(s) acrescentada(s): ${lidas.join(", ")}`);
    if (substituidas.length > 0) partes.push(`${substituidas.length} atualizada(s): ${substituidas.join(", ")}`);
    if (falhas.length > 0) partes.push(`${falhas.length} ficheiro(s) por ler`);
    setMensagem({ tipo: falhas.length > 0 ? "erro" : "sucesso", texto: partes.join(" · ") });
  }

  async function carregarVista(ficheiro: File) {
    setMensagem(null);
    try {
      const lida = importarVistaDirecaoJSON(await ficheiro.text());
      setVista(lida);
      setFiltros(filtrosIniciais());
      setMensagem({ tipo: "sucesso", texto: `Vista carregada, com ${lida.unidades.length} unidade(s).` });
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
      descarregarBlob(await gerarVistaDirecaoBlob(filtrada), nomeDoExcelDaDirecao(filtrada));
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o Excel da Vista Geral da Direção." });
    }
  }

  async function descarregarTudo() {
    setMensagem(null);
    try {
      await descarregarPacote(nomeDoPacoteDaVistaDirecao(filtrada), await ficheirosDaVistaDirecao(filtrada));
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o pacote da Vista Geral da Direção." });
    }
  }

  function recomecar() {
    if (!confirm("Apagar a Vista Geral da Direção e recomeçar do zero?")) return;
    setVista(vistaDirecaoInicial());
    setFiltros(filtrosIniciais());
    setMensagem({ tipo: "sucesso", texto: "Vista Geral da Direção reposta." });
  }

  return (
    <>
      <div className="modulo-cabecalho modulo-cabecalho-direcao">
        <div className="modulo-titulo-linha">
          <h2>Vista Geral da Direção</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar} disabled={semDados}>
              Recomeçar
            </button>
          </div>
        </div>
        <p>
          As vistas gerais das unidades lado a lado: quantas pessoas e quanto dinheiro em cada unidade, que projetos
          as compõem e a que rates cada perfil foi contratado.
        </p>
      </div>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Unidades da direção</h3>
          <p className="painel-nota">
            Carregue os JSON de Vista Geral que cada unidade descarrega no separador ao lado — um por unidade, ou
            vários de uma vez. Recarregar uma unidade atualiza-a, em vez de a duplicar.
          </p>
        </header>

        <label className="campo-unidade">
          <span>Direção</span>
          <input
            type="text"
            value={vista.direcao}
            placeholder="Nome da direção (sai nos ficheiros)"
            onChange={(e) => setVista((atual) => ({ ...atual, direcao: e.target.value }))}
          />
        </label>

        <div className="acoes">
          <button type="button" className="botao-principal" onClick={() => inputUnidadesRef.current?.click()}>
            Importar vistas gerais das unidades (JSON)
          </button>
          <input
            ref={inputUnidadesRef}
            type="file"
            multiple
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) void carregarUnidades(e.target.files);
              e.target.value = "";
            }}
          />

          <button type="button" className="botao-secundario" onClick={() => inputVistaRef.current?.click()}>
            Carregar Vista Geral da Direção (JSON)
          </button>
          <input
            ref={inputVistaRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void carregarVista(ficheiro);
              e.target.value = "";
            }}
          />
        </div>

        {!semDados && (
          <div className="lista-unidades">
            {vista.unidades.map((unidade) => {
              const nome = nomeDaUnidade(unidade);
              return (
                <span key={nome} className="etiqueta-unidade">
                  {nome}
                  <span className="meta">
                    {unidade.projetos.length} projeto(s) · {pessoasDaUnidade(unidade)} pessoas
                  </span>
                  <button
                    type="button"
                    aria-label={`Remover a unidade ${nome}`}
                    onClick={() => setVista((atual) => semUnidade(atual, nome))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <p className="ajuda">
          Esta vista fica guardada neste navegador, incluindo os nomes dos elementos internos que cada unidade
          registou, e não sai deste posto de trabalho. Os elementos internos não se editam aqui: são da unidade, e é
          lá que se acrescentam.
        </p>
      </section>

      {!semDados && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Filtros</h3>
              <p className="painel-nota">Valem para as três tabelas e para os ficheiros que daqui saem.</p>
            </header>

            <FiltrosDaDirecao vista={vista} filtros={filtros} onAlterar={setFiltros} />

            <dl className="tira-totais">
              <div>
                <dt>Unidades</dt>
                <dd>{filtrada.unidades.length}</dd>
              </div>
              <div>
                <dt>Projetos</dt>
                <dd>{filtrada.unidades.reduce((soma, u) => soma + u.projetos.length, 0)}</dd>
              </div>
              <div>
                <dt>Pessoas</dt>
                <dd>
                  {pessoasDaDirecao(filtrada)}
                  <span>
                    {externosDaDirecao(filtrada)} externos · {internosDaDirecao(filtrada)} internos
                  </span>
                </dd>
              </div>
              <div>
                <dt>Valor c/ IVA</dt>
                <dd>
                  {formatarMoeda(valorDaDirecao(filtrada, anos))}
                  <span>{formatarMoeda(valorDaDirecaoSemIva(filtrada, anos))} s/ IVA</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Resumo geral por unidade</h3>
              <p className="painel-nota">Uma linha por unidade. Abra uma linha para ver os projetos que a compõem.</p>
            </header>

            <ResumoPorUnidade vista={filtrada} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Projetos, pessoas e valores</h3>
              <p className="painel-nota">
                O detalhe de cada unidade: uma linha por perfil e por elemento interno, como na vista da unidade.
                Abra uma unidade para ver os projetos.
              </p>
            </header>

            <TabelaDaDirecao vista={filtrada} anos={anos} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Perfis e rates praticadas</h3>
              <p className="painel-nota">
                Um perfil por linha, com a rate a que foi contratado. Abra um perfil para ver em que unidade e em que
                projeto cada rate foi praticada.
              </p>
            </header>

            <TabelaDeRates vista={filtrada} anos={anos} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Descarregar</h3>
            </header>

            <div className="acoes">
              <button type="button" className="botao-principal" onClick={() => void descarregarExcel()}>
                Descarregar Excel (XLSX)
              </button>
              <button type="button" className="botao-secundario" onClick={() => void descarregarTudo()}>
                Descarregar pacote (ZIP: Excel + JSON)
              </button>
            </div>

            <p className="ajuda">
              O Excel leva as três tabelas, uma folha cada, tal como estão no ecrã — com os filtros aplicados. O JSON
              é o que permite retomar esta vista noutro posto de trabalho.
            </p>
          </section>
        </>
      )}
    </>
  );
}
