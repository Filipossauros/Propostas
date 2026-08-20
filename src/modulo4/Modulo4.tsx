import { useMemo, useRef, useState } from "react";
import type { LotesJSON } from "../core/types";
import type { ResultadoProcedimento } from "../core/avaliacaoProcedimento";
import { ErroImportacao } from "../core/perfil";
import { importarResultadosJSON } from "../core/resultadosJSON";
import {
  REGRA_UM_LOTE,
  chavePreco,
  ordenarPropostas,
  propostasAdmitidas,
  type PrecosPropostos,
} from "../core/ordenacao";
import { gerarResultadosBlob } from "../excel/exportarResultados";
import { descarregarBlob, nomeComProjeto } from "../ui/descarregar";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { TabelaOrdenacao } from "./TabelaOrdenacao";

/** O apuramento sobre o qual se ordena — vindo do Módulo 3 ou de ficheiro. */
export interface Apuramento {
  resultado: ResultadoProcedimento;
  config: LotesJSON;
}

interface Props {
  /** Apuramento entregue pelo Módulo 3 nesta sessão, se o utilizador veio por aí. */
  recebido: Apuramento | null;
  onLimparRecebido: () => void;
}

/**
 * Lê um preço escrito à mão. Aceita as formas em que os preços aparecem nas
 * propostas — "148 500,00", "148500.00", "148.500,00 €" — e devolve null
 * enquanto não houver ali um número.
 */
function lerPreco(texto: string): number | null {
  const limpo = texto
    .replace(/[^0-9,.]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (limpo.trim() === "") return null;

  const valor = Number(limpo);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

export function Modulo4({ recebido, onLimparRecebido }: Props) {
  const [carregado, setCarregado] = useState<Apuramento | null>(null);
  // Guarda-se o que a pessoa escreveu, e não o número já lido: normalizar a
  // cada tecla apagava-lhe a vírgula a meio de "148 500,0" e tornava o campo
  // impossível de preencher.
  const [precosEscritos, setPrecosEscritos] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // O que veio de ficheiro tem precedência sobre o que veio do Módulo 3: se o
  // utilizador carregou um ficheiro, foi esse que quis ver.
  const apuramento = carregado ?? recebido;

  const admitidas = useMemo(
    () => (apuramento === null ? [] : propostasAdmitidas(apuramento.resultado)),
    [apuramento],
  );

  const precos: PrecosPropostos = useMemo(() => {
    const lidos: PrecosPropostos = {};
    for (const [chave, texto] of Object.entries(precosEscritos)) lidos[chave] = lerPreco(texto);
    return lidos;
  }, [precosEscritos]);

  const ordenacao = useMemo(
    () => (apuramento === null ? null : ordenarPropostas(apuramento.resultado, precos)),
    [apuramento, precos],
  );

  async function carregarFicheiro(ficheiro: File) {
    setMensagem(null);
    try {
      const { config, resultado } = importarResultadosJSON(await ficheiro.text());
      setCarregado({ config, resultado });
      setPrecosEscritos({});
      setMensagem({
        tipo: "sucesso",
        texto: `Resultados carregados: ${resultado.lotes.length} lote(s).`,
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível carregar os resultados.",
      });
    }
  }

  function recomecar() {
    if (!confirm("Apagar os preços indicados e recomeçar do zero?")) return;
    setCarregado(null);
    onLimparRecebido();
    setPrecosEscritos({});
    setMensagem({ tipo: "sucesso", texto: "Ordenação reposta." });
  }

  async function exportar() {
    if (apuramento === null || ordenacao === null) return;
    descarregarBlob(
      await gerarResultadosBlob(apuramento.resultado, apuramento.config, ordenacao),
      nomeComProjeto(apuramento.config.nomeProjeto, "Resultados_e_Ordenacao.xlsx"),
    );
  }

  const semPreco = ordenacao?.lotes.reduce((soma, l) => soma + l.precosEmFalta, 0) ?? 0;

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 4 · Ordenação das propostas</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">Ordena pelo preço as propostas admitidas em cada lote.</p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Passo 1 · Apuramento do Módulo 3</h3>
          <p className="painel-nota">
            Venha do Módulo 3 nesta sessão, ou carregue aqui o JSON de resultados que ele descarrega.
          </p>
        </header>

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputRef.current?.click()}>
            {apuramento === null ? "Carregar resultados (JSON)" : "Trocar resultados"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void carregarFicheiro(ficheiro);
              e.target.value = "";
            }}
          />
        </div>

        {apuramento === null ? (
          <p className="estado-vazio">
            Ainda não há apuramento. Conclua o Módulo 3 e siga daí, ou carregue o JSON de resultados.
          </p>
        ) : (
          <ul className="lista-erros lista-sem-erro">
            <li>
              {apuramento.config.nomeProjeto || "(projeto sem nome)"} · {apuramento.resultado.lotes.length} lote(s)
            </li>
            <li>
              {admitidas.length} proposta(s) admitida(s) — só estas entram na ordenação.
            </li>
            <li>
              Limitação de um lote por concorrente:{" "}
              <strong>{apuramento.resultado.umLotePorConcorrente ? "sim" : "não"}</strong>
            </li>
          </ul>
        )}
      </section>

      {apuramento !== null && (
        <section className="painel">
          <header className="painel-cabecalho">
            <h3>Passo 2 · Preço de cada proposta</h3>
            <p className="painel-nota">
              O preço não consta do formulário de declaração de experiência: indique-o aqui, sem IVA, tal como vem
              na proposta. Só aparecem as propostas admitidas no Módulo 3.
            </p>
          </header>

          {admitidas.length === 0 ? (
            <p className="estado-vazio">Nenhuma proposta foi admitida: não há nada a ordenar.</p>
          ) : (
            <div className="tabela-envolvente">
              <table className="tabela tabela-precos">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Concorrente</th>
                    <th>Preço proposto (s/ IVA)</th>
                  </tr>
                </thead>
                <tbody>
                  {admitidas.map((p) => {
                    const chave = chavePreco(p.loteId, p.concorrente);
                    const escrito = precosEscritos[chave] ?? "";
                    const lido = lerPreco(escrito);
                    const ilegivel = escrito.trim() !== "" && lido === null;
                    return (
                      <tr key={chave}>
                        <td>
                          {p.numero} · {p.designacao}
                        </td>
                        <td>{p.concorrente}</td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={escrito}
                            placeholder="ex.: 148 500,00"
                            aria-label={`Preço da proposta de ${p.concorrente} ao lote ${p.numero}`}
                            aria-invalid={lido === null}
                            onChange={(e) =>
                              setPrecosEscritos((atual) => ({ ...atual, [chave]: e.target.value }))
                            }
                          />
                          {ilegivel && <span className="aviso aviso-erro">Preço ilegível.</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {semPreco > 0 && admitidas.length > 0 && (
            <p className="ajuda">
              Faltam {semPreco} preço(s). Uma proposta sem preço não é ordenada nem vence — não há como a comparar.
            </p>
          )}
        </section>
      )}

      {apuramento !== null && ordenacao !== null && admitidas.length > 0 && (
        <>
          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Passo 3 · Ordenação</h3>
            </header>

            {ordenacao.umLotePorConcorrente && (
              <div className="aviso-regra">
                <strong>Regra de ordenação</strong>
                <span>{REGRA_UM_LOTE}</span>
              </div>
            )}

            <TabelaOrdenacao ordenacao={ordenacao} />
          </section>

          <section className="painel">
            <header className="painel-cabecalho">
              <h3>Exportação</h3>
              <p className="painel-nota">
                O relatório do Módulo 3 por inteiro, mais duas folhas: a ordenação de cada lote e os vencedores.
              </p>
            </header>
            <button type="button" className="botao-principal" onClick={() => void exportar()}>
              Descarregar resultados e ordenação (Excel)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
