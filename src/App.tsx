import { useCallback, useEffect, useMemo, useState } from "react";
import type { JustificacaoProjeto, LotesJSON, PerfilJSON } from "./core/types";
import { temJustificacao, validarJustificacao } from "./core/justificacao";
import { validarDescricaoProjeto, validarNomeProjeto, validarPerfis } from "./core/perfil";
import { lotePorPerfilId, sincronizarPerfisEmLotes, validarCategoriasEavalia, validarLotes } from "./core/lotes";
import { ProtecaoExemplos } from "./ui/ProtecaoExemplos";
import { ModuloProjeto } from "./projeto/ModuloProjeto";
import { ModuloPerfis } from "./modulo1/ModuloPerfis";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";
import { Modulo4, type Apuramento } from "./modulo4/Modulo4";
import { VistaGeral } from "./vistaGeral/VistaGeral";
import { ModuloLicencas } from "./licenciamento/ModuloLicencas";
import { ModuloProduto } from "./licenciamento/ModuloProduto";
import { ModuloCondicoes } from "./licenciamento/ModuloCondicoes";
import { ModuloPedidoLicenciamento } from "./licenciamento/ModuloPedidoLicenciamento";
import {
  validarCondicoes,
  validarLicencas,
  validarPedido,
  validarProdutoLicenciamento,
  type PedidoLicenciamento,
} from "./core/licenciamento";
import {
  comDadosBolsa,
  comDadosLicenciamento,
  comPedidoAberto,
  comPedidoNovo,
  dadosBolsaIniciais,
  novoPedidoBolsa,
  novoPedidoLicenciamento,
  pedidoAtivo,
  type DadosBolsa,
  type TipoPedido,
} from "./core/biblioteca";
import { pedidoLicenciamentoInicial } from "./core/licenciamento";
import { useBiblioteca } from "./core/useBiblioteca";
import { BarraSuperior, type Seccao } from "./inicio/BarraSuperior";
import { BarraDoModulo, type EstadoDoModulo } from "./inicio/BarraDoModulo";
import { PaginaBiblioteca } from "./inicio/PaginaBiblioteca";
import { DialogoDescarregarTudo } from "./inicio/DialogoDescarregarTudo";
import {
  ehGrupoDePedido,
  enderecoDe,
  grupoDaPagina,
  localizacaoDoEndereco,
  type Localizacao,
  type Pagina,
} from "./inicio/navegacao";

/** O estado de um módulo, dito nos passos do pedido: o que falta, ou que está completo. */
function estadoPorErros(n: number): EstadoDoModulo {
  return n === 0
    ? { texto: "completo", falta: false }
    : { texto: n === 1 ? "1 questão por resolver" : `${n} questões por resolver`, falta: true };
}

/** O primeiro módulo de cada tipo de pedido. */
const PRIMEIRO_MODULO: Record<TipoPedido, Exclude<Pagina, "inicio">> = { bolsa: "projeto", licenciamento: "produto" };

function App() {
  // Onde se está: a página e o grupo de onde se veio. Vive no endereço
  // (`#bolsa/perfis`), para o «retroceder» do navegador funcionar e para um
  // recarregamento não atirar ninguém para a biblioteca. O pedido aberto vive
  // na própria biblioteca.
  const [local, setLocal] = useState<Localizacao>(() => localizacaoDoEndereco(window.location.hash));
  useEffect(() => {
    const aoMudar = () => setLocal(localizacaoDoEndereco(window.location.hash));
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  const aba = local.pagina;

  // O apuramento entregue pelo Módulo 4 ao Módulo 5 vive aqui, em memória e
  // nunca no navegador: traz as declarações dos candidatos, que são dados
  // pessoais e desaparecem ao fechar o separador.
  const [apuramentoParaOrdenar, setApuramentoParaOrdenar] = useState<Apuramento | null>(null);

  // Todos os pedidos, e o que está aberto. Os módulos trabalham o aberto.
  const [biblioteca, setBiblioteca, gravacao] = useBiblioteca();
  const ativo = pedidoAtivo(biblioteca);
  const [aDescarregar, setADescarregar] = useState<string | null>(null);

  // Os dados do pedido aberto, como os módulos os esperam. Sem pedido do tipo,
  // valores vazios (os módulos desse tipo não se mostram).
  const vazioBolsa = useMemo(() => dadosBolsaIniciais(), []);
  const vazioLicenciamento = useMemo(() => pedidoLicenciamentoInicial(), []);
  const bolsa: DadosBolsa = ativo?.tipo === "bolsa" ? ativo.dados : vazioBolsa;
  const licenciamento: PedidoLicenciamento = ativo?.tipo === "licenciamento" ? ativo.dados : vazioLicenciamento;

  // Os «setters» de cada parte do pedido de bolsa: alteram o pedido aberto na
  // biblioteca, aceitando um valor ou uma função do valor atual — como um
  // useState. Estáveis, para os módulos os poderem usar sem cuidados.
  const campoBolsa = useCallback(
    <K extends keyof DadosBolsa>(chave: K): React.Dispatch<React.SetStateAction<DadosBolsa[K]>> =>
      (valor) =>
        setBiblioteca((b) =>
          comDadosBolsa(b, (d) => ({
            ...d,
            [chave]: typeof valor === "function" ? (valor as (atual: DadosBolsa[K]) => DadosBolsa[K])(d[chave]) : valor,
          })),
        ),
    [setBiblioteca],
  );
  const setLotes = useMemo(() => campoBolsa("lotes"), [campoBolsa]) as React.Dispatch<React.SetStateAction<LotesJSON>>;
  const setNomeProjeto = useMemo(() => campoBolsa("nomeProjeto"), [campoBolsa]);
  const setDescricaoProjeto = useMemo(() => campoBolsa("descricaoProjeto"), [campoBolsa]);
  const setJustificacao = useMemo(() => campoBolsa("justificacao"), [campoBolsa]) as React.Dispatch<
    React.SetStateAction<JustificacaoProjeto>
  >;
  const setLicenciamento = useCallback(
    (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) =>
      setBiblioteca((b) => comDadosLicenciamento(b, atualizar)),
    [setBiblioteca],
  );

  const { nomeProjeto, descricaoProjeto, justificacao, perfis } = bolsa;
  const lotes = bolsa.lotes;

  /**
   * Ponto único de alteração do catálogo de perfis: repõe-nos também nos lotes
   * onde já estejam atribuídos, para a edição ser transversal.
   */
  function aplicarPerfis(novos: PerfilJSON[]) {
    setBiblioteca((b) => comDadosBolsa(b, (d) => ({ ...d, perfis: novos, lotes: sincronizarPerfisEmLotes(d.lotes, novos) })));
  }

  /** Acrescenta perfis vindos de ficheiro, substituindo os que já existam com o mesmo id. */
  function acrescentarPerfis(novos: PerfilJSON[]) {
    const porId = new Map(perfis.map((p) => [p.id, p]));
    for (const p of novos) porId.set(p.id, p);
    aplicarPerfis([...porId.values()]);
  }

  /** Um nome vindo de ficheiro só se aplica se ainda não houver nenhum. */
  function adotarNomeProjeto(doFicheiro: string) {
    if (doFicheiro.trim() !== "" && nomeProjeto.trim() === "") setNomeProjeto(doFicheiro);
  }
  function adotarDescricaoProjeto(doFicheiro: string) {
    if (doFicheiro.trim() !== "" && descricaoProjeto.trim() === "") setDescricaoProjeto(doFicheiro);
  }
  function adotarJustificacao(doFicheiro: JustificacaoProjeto) {
    if (temJustificacao(doFicheiro) && !temJustificacao(justificacao)) setJustificacao(doFicheiro);
  }

  // O estado de cada módulo do pedido aberto, para os passos o dizerem.
  const estados: Partial<Record<Pagina, EstadoDoModulo>> = {};
  if (ativo?.tipo === "bolsa") {
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
  }
  if (ativo?.tipo === "licenciamento") {
    const produtoVazio =
      licenciamento.nomeProduto.trim() === "" &&
      licenciamento.descricaoProduto.trim() === "" &&
      !temJustificacao(licenciamento.justificacao);
    if (!produtoVazio) estados.produto = estadoPorErros(validarProdutoLicenciamento(licenciamento).length);
    if (licenciamento.licencas.length > 0) {
      estados.licencas = estadoPorErros(validarLicencas(licenciamento).length);
      estados.condicoes = estadoPorErros(validarCondicoes(licenciamento).length);
      estados.pedidoLicenciamento = estadoPorErros(validarPedido(licenciamento).length);
    }
  }

  const navegar = useCallback((destino: Localizacao) => {
    const endereco = enderecoDe(destino);
    if (window.location.hash !== endereco && !(endereco === "#" && window.location.hash === "")) {
      window.location.hash = endereco;
    }
    setLocal(destino);
    window.scrollTo({ top: 0 });
  }, []);

  /** Vai para outro módulo do grupo em que se está. */
  function irPara(destino: Exclude<Pagina, "inicio">) {
    navegar({ pagina: destino, grupo: grupoDaPagina(destino, local.grupo ?? undefined).chave });
  }

  function abrirPedido(id: string) {
    const p = biblioteca.pedidos.find((x) => x.id === id);
    if (p === undefined) return;
    setBiblioteca((b) => comPedidoAberto(b, id));
    navegar({ pagina: PRIMEIRO_MODULO[p.tipo], grupo: p.tipo });
  }

  function novoPedido(tipo: TipoPedido) {
    const p = tipo === "bolsa" ? novoPedidoBolsa() : novoPedidoLicenciamento();
    setBiblioteca((b) => comPedidoNovo(b, p));
    navegar({ pagina: PRIMEIRO_MODULO[tipo], grupo: tipo });
  }

  function irParaSeccao(seccao: Exclude<Seccao, "pedido">) {
    if (seccao === "biblioteca") navegar({ pagina: "inicio", grupo: null });
    else if (seccao === "analise") navegar({ pagina: "avaliacao", grupo: "analise" });
    else navegar({ pagina: "vistaGeral", grupo: "orcamento" });
  }

  // Um módulo de pedido só se abre com um pedido desse tipo aberto: sem ele (um
  // endereço antigo, um pedido apagado), mostra-se a biblioteca, e o endereço
  // acompanha.
  const grupoNoEndereco = aba === "inicio" ? null : grupoDaPagina(aba, local.grupo ?? undefined).chave;
  const pedidoEmFalta = ehGrupoDePedido(grupoNoEndereco) && ativo?.tipo !== grupoNoEndereco;
  useEffect(() => {
    if (pedidoEmFalta) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#`);
  }, [pedidoEmFalta]);

  const grupo = aba === "inicio" || pedidoEmFalta ? null : grupoDaPagina(aba, local.grupo ?? undefined);
  const seccao: Seccao =
    grupo === null
      ? "biblioteca"
      : ehGrupoDePedido(grupo.chave)
        ? "pedido"
        : grupo.chave === "analise"
          ? "analise"
          : "orcamento";
  const pedidoADescarregar = biblioteca.pedidos.find((p) => p.id === aDescarregar) ?? null;

  return (
    <ProtecaoExemplos>
      <BarraSuperior
        seccao={seccao}
        ativo={ativo}
        pedidos={biblioteca.pedidos.filter((p) => !p.arquivado)}
        gravacao={gravacao}
        onIrPara={irParaSeccao}
        onAbrirPedido={abrirPedido}
        onNovoPedido={novoPedido}
        onDescarregarTudo={() => ativo !== null && setADescarregar(ativo.id)}
      />

      <div className="app">
        <main>
          {seccao === "biblioteca" && (
            <PaginaBiblioteca
              biblioteca={biblioteca}
              onAlterar={setBiblioteca}
              onAbrir={abrirPedido}
              onNovo={novoPedido}
              onDescarregarTudo={setADescarregar}
            />
          )}

          {grupo !== null && aba !== "inicio" && (
            <BarraDoModulo grupo={grupo} pagina={aba} estados={seccao === "pedido" ? estados : undefined} onIrPara={irPara} />
          )}

          {seccao === "pedido" && ativo?.tipo === "bolsa" && (
            <>
              {aba === "projeto" && (
                <ModuloProjeto
                  nomeProjeto={nomeProjeto}
                  onAlterarNomeProjeto={setNomeProjeto}
                  descricaoProjeto={descricaoProjeto}
                  onAlterarDescricaoProjeto={setDescricaoProjeto}
                  justificacao={justificacao}
                  onAlterarJustificacao={setJustificacao}
                  mostrarComoFunciona
                  seguinte={{
                    titulo: "os perfis",
                    nota:
                      "O projeto fica guardado na biblioteca, neste navegador. Pode avançar com questões por " +
                      "resolver, mas o Anexo Técnico só se descarrega depois de resolvidas.",
                    onIr: () => irPara("perfis"),
                  }}
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
            </>
          )}

          {seccao === "pedido" && ativo?.tipo === "licenciamento" && (
            <>
              {aba === "produto" && (
                <ModuloProduto
                  pedido={licenciamento}
                  onAlterar={setLicenciamento}
                  onIrParaLicencas={() => irPara("licencas")}
                />
              )}
              {aba === "licencas" && (
                <ModuloLicencas
                  pedido={licenciamento}
                  onAlterar={setLicenciamento}
                  onIrParaCondicoes={() => irPara("condicoes")}
                />
              )}
              {aba === "condicoes" && (
                <ModuloCondicoes
                  pedido={licenciamento}
                  onAlterar={setLicenciamento}
                  onIrParaPedido={() => irPara("pedidoLicenciamento")}
                />
              )}
              {aba === "pedidoLicenciamento" && (
                <ModuloPedidoLicenciamento pedido={licenciamento} onAlterar={setLicenciamento} />
              )}
            </>
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

          {aba === "vistaGeral" && (
            <VistaGeral biblioteca={biblioteca} onAlterarBiblioteca={setBiblioteca} onAbrirPedido={abrirPedido} />
          )}
        </main>
      </div>

      {pedidoADescarregar !== null && (
        <DialogoDescarregarTudo pedido={pedidoADescarregar} onFechar={() => setADescarregar(null)} />
      )}
    </ProtecaoExemplos>
  );
}

export default App;
