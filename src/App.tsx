import { useEffect, useState } from "react";
import type { JustificacaoProjeto, LotesJSON, PerfilJSON } from "./core/types";
import { SCHEMA_VERSION_ATUAL } from "./core/types";
import {
  CHAVE_DESCRICAO_PROJETO,
  CHAVE_JUSTIFICACAO_PROJETO,
  CHAVE_LICENCIAMENTO,
  CHAVE_LOTES,
  CHAVE_NOME_PROJETO,
  CHAVE_PERFIS,
} from "./core/persistencia";
import {
  ehJustificacaoGuardada,
  justificacaoInicial,
  normalizarJustificacao,
  temJustificacao,
  validarJustificacao,
} from "./core/justificacao";
import {
  ehListaDePerfisGuardada,
  normalizarPerfisGuardados,
  validarDescricaoProjeto,
  validarNomeProjeto,
  validarPerfis,
} from "./core/perfil";
import {
  lotePorPerfilId,
  lotesIniciais,
  normalizarLotesGuardados,
  sincronizarPerfisEmLotes,
  validarCategoriasEavalia,
  validarLotes,
} from "./core/lotes";
import { useEstadoPersistente } from "./core/useEstadoPersistente";
import { ProtecaoExemplos } from "./ui/ProtecaoExemplos";
import { ModuloProjeto } from "./projeto/ModuloProjeto";
import { ModuloPerfis } from "./modulo1/ModuloPerfis";
import { Modulo2 } from "./modulo2/Modulo2";
import { Modulo3 } from "./modulo3/Modulo3";
import { Modulo4, type Apuramento } from "./modulo4/Modulo4";
import { VistaGeral } from "./vistaGeral/VistaGeral";
import { VistaGeralDirecao } from "./direcao/VistaGeralDirecao";
import { ModuloLicencas, type ProjetoDoFicheiro } from "./licenciamento/ModuloLicencas";
import { ModuloCondicoes } from "./licenciamento/ModuloCondicoes";
import { ModuloPedidoLicenciamento } from "./licenciamento/ModuloPedidoLicenciamento";
import {
  ehPedidoLicenciamentoGuardado,
  normalizarPedidoLicenciamento,
  pedidoLicenciamentoInicial,
  validarCondicoes,
  validarLicencas,
  validarPedido,
  type PedidoLicenciamento,
} from "./core/licenciamento";
import { PaginaInicial, type EstadoDoModulo } from "./inicio/PaginaInicial";
import { BarraDoModulo } from "./inicio/BarraDoModulo";
import {
  enderecoDe,
  grupoDaPagina,
  localizacaoDoEndereco,
  type ChaveGrupo,
  type Localizacao,
  type Pagina,
} from "./inicio/navegacao";

/** O estado de um módulo, dito no seu cartão da página inicial: o que falta, ou que está completo. */
function estadoPorErros(n: number): EstadoDoModulo {
  return n === 0
    ? { texto: "completo", falta: false }
    : { texto: n === 1 ? "1 questão por resolver" : `${n} questões por resolver`, falta: true };
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

function ehLotesGuardado(valor: unknown): valor is LotesJSON {
  if (typeof valor !== "object" || valor === null) return false;
  const l = valor as Partial<LotesJSON>;
  return l.tipo === "lotes" && l.schemaVersion === SCHEMA_VERSION_ATUAL && Array.isArray(l.lotes);
}

function App() {
  // Onde se está: a página e o grupo de onde se veio. Vive no endereço
  // (`#bolsa/perfis`), para o «retroceder» do navegador funcionar e para um
  // recarregamento não atirar ninguém para a página inicial.
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

  // O catálogo de perfis e o agrupamento em lotes vivem aqui, e não dentro dos
  // respetivos módulos, porque são partilhados: o Módulo 2 define os perfis, o
  // Módulo 3 agrupa-os e também os pode carregar de ficheiro. Ter um só dono
  // para cada um é o que permite que uma alteração feita num módulo se reflita
  // no outro — ver `aplicarPerfis`.
  const [perfis, setPerfis] = useEstadoPersistente<PerfilJSON[]>(
    CHAVE_PERFIS,
    () => [],
    ehListaDePerfisGuardada,
    normalizarPerfisGuardados,
  );
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
  const [justificacao, setJustificacao] = useEstadoPersistente<JustificacaoProjeto>(
    CHAVE_JUSTIFICACAO_PROJETO,
    justificacaoInicial,
    ehJustificacaoGuardada,
    normalizarJustificacao,
  );

  // O pedido de licenciamento (L1, L2 e L3): um só estado, partilhado pelos
  // três módulos, como o agrupamento em lotes o é pelo Módulo 3.
  const [licenciamento, setLicenciamento] = useEstadoPersistente<PedidoLicenciamento>(
    CHAVE_LICENCIAMENTO,
    pedidoLicenciamentoInicial,
    ehPedidoLicenciamentoGuardado,
    normalizarPedidoLicenciamento,
  );

  /** O projeto de um ficheiro de licenciamento, campo a campo, pelas regras de adoção. */
  function adotarProjeto(p: ProjetoDoFicheiro) {
    adotarNomeProjeto(p.nomeProjeto);
    adotarDescricaoProjeto(p.descricaoProjeto);
    adotarJustificacao(p.justificacao);
  }

  /** O projeto do exemplo substitui o que lá estiver — como o exemplo da bolsa de horas. */
  function definirProjeto(p: ProjetoDoFicheiro) {
    setNomeProjeto(p.nomeProjeto);
    setDescricaoProjeto(p.descricaoProjeto);
    setJustificacao(p.justificacao);
  }

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

  /** Os benefícios e os riscos também — e as duas listas juntas, como foram escritas. */
  function adotarJustificacao(doFicheiro: JustificacaoProjeto) {
    if (temJustificacao(doFicheiro) && !temJustificacao(justificacao)) setJustificacao(doFicheiro);
  }

  // O estado de cada módulo de preparação, para o cartão da página inicial o
  // dizer sem ser preciso abri-lo. Sem nada escrito, o cartão não diz nada.
  const estados: Partial<Record<Pagina, EstadoDoModulo>> = {};
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

  if (licenciamento.produtos.length > 0) {
    estados.licencas = estadoPorErros(validarLicencas(licenciamento).length);
    estados.condicoes = estadoPorErros(validarCondicoes(licenciamento.condicoes).length);
    estados.pedidoLicenciamento = estadoPorErros(validarPedido(licenciamento).length);
  }

  function navegar(destino: Localizacao) {
    const endereco = enderecoDe(destino);
    if (window.location.hash !== endereco && !(endereco === "#" && window.location.hash === "")) {
      window.location.hash = endereco;
    }
    setLocal(destino);
    window.scrollTo({ top: 0 });
  }

  /** Vai para outro módulo do grupo em que se está (ou do grupo da página, se for de um só). */
  function irPara(destino: Exclude<Pagina, "inicio">) {
    navegar({ pagina: destino, grupo: grupoDaPagina(destino, local.grupo ?? undefined).chave });
  }

  function abrir(grupo: ChaveGrupo, pagina: Exclude<Pagina, "inicio">) {
    navegar({ pagina, grupo });
  }

  const grupo = aba === "inicio" ? null : grupoDaPagina(aba, local.grupo ?? undefined);

  return (
    <ProtecaoExemplos>
      <div className="app">
      <header className="app-cabecalho">
        <div className="marca">
          <h1>Manifestações de Necessidades</h1>
          <p>Preparação de procedimentos, análise de propostas e orçamento</p>
        </div>
      </header>

      <main>
        {aba === "inicio" && <PaginaInicial estados={estados} onAbrir={abrir} />}

        {grupo !== null && aba !== "inicio" && (
          <BarraDoModulo
            grupo={grupo}
            pagina={aba}
            onVoltar={() => navegar({ pagina: "inicio", grupo: null })}
            onIrPara={irPara}
          />
        )}

        {aba === "projeto" && (
          <ModuloProjeto
            nomeProjeto={nomeProjeto}
            onAlterarNomeProjeto={setNomeProjeto}
            descricaoProjeto={descricaoProjeto}
            onAlterarDescricaoProjeto={setDescricaoProjeto}
            justificacao={justificacao}
            onAlterarJustificacao={setJustificacao}
            mostrarComoFunciona={grupo?.chave === "bolsa"}
            comBeneficioFixo={grupo?.chave !== "licenciamento"}
            seguinte={
              grupo?.chave === "licenciamento"
                ? {
                    titulo: "as licenças",
                    nota: "O projeto fica guardado neste navegador e é o ponto de partida do pedido de licenciamento.",
                    onIr: () => irPara("licencas"),
                  }
                : {
                    titulo: "os perfis",
                    nota:
                      "O projeto fica guardado neste navegador e segue nos ficheiros dos perfis e dos lotes. Pode " +
                      "avançar com questões por resolver, mas o Anexo Técnico só se descarrega depois de resolvidas.",
                    onIr: () => irPara("perfis"),
                  }
            }
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

        {aba === "licencas" && (
          <ModuloLicencas
            pedido={licenciamento}
            onAlterar={setLicenciamento}
            onDefinirProjeto={definirProjeto}
            onAdotarProjeto={adotarProjeto}
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
          <ModuloPedidoLicenciamento
            pedido={licenciamento}
            onAlterar={setLicenciamento}
            nomeProjeto={nomeProjeto}
            descricaoProjeto={descricaoProjeto}
            justificacao={justificacao}
          />
        )}

        {aba === "vistaGeral" && <VistaGeral />}
        {aba === "vistaDirecao" && <VistaGeralDirecao />}
      </main>
      </div>
    </ProtecaoExemplos>
  );
}

export default App;
