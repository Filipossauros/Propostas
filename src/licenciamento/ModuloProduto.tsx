import { useRef, useState } from "react";
import type { PedidoLicenciamento } from "../core/licenciamento";
import {
  PRODUTO_LICENCIAMENTO_EXEMPLO,
  beneficiariosDoPedido,
  beneficiosOperacionaisDoPedido,
  importarProdutoJSON,
  nomeProcedimentoLicenciamento,
  produtoParaJSON,
  validarProdutoLicenciamento,
} from "../core/licenciamento";
import { justificacaoInicial, temJustificacao } from "../core/justificacao";
import { ErroImportacao } from "../core/perfil";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { descarregarBlob, nomeComProjeto } from "../ui/descarregar";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  onIrParaLicencas: () => void;
}

/**
 * Módulo 1 · Produto, no pedido de licenciamento.
 *
 * O que se adquire é um produto — um software, uma terminologia como a SNOMED
 * CT, uma norma ou um conteúdo —, e não um projeto. Os dados são deste pedido:
 * o projeto da bolsa de horas fica como está, e vice-versa.
 */
export function ModuloProduto({ pedido, onAlterar, onIrParaLicencas }: Props) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const podeCarregarExemplo = usePodeCarregarExemplo();
  const temProduto =
    pedido.nomeProduto.trim() !== "" || pedido.descricaoProduto.trim() !== "" || temJustificacao(pedido.justificacao);
  const erros = validarProdutoLicenciamento(pedido);
  const procedimento = nomeProcedimentoLicenciamento(pedido.nomeProduto);

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    onAlterar((atual) => ({
      ...atual,
      ...structuredClone(PRODUTO_LICENCIAMENTO_EXEMPLO),
      beneficiarios: null,
      beneficiosOperacionais: null,
    }));
    setMensagem({ tipo: "sucesso", texto: "Produto de exemplo carregado." });
  }

  function recomecar() {
    if (!confirm("Apagar o nome, a descrição, os objetivos, os benefícios e os riscos do produto? As licenças ficam."))
      return;
    onAlterar((atual) => ({
      ...atual,
      nomeProduto: "",
      descricaoProduto: "",
      justificacao: justificacaoInicial(),
      beneficiarios: null,
      beneficiosOperacionais: null,
    }));
    setMensagem({ tipo: "sucesso", texto: "Identificação do produto reposta." });
  }

  async function importar(ficheiro: File) {
    try {
      const lido = importarProdutoJSON(await ficheiro.text());
      if (temProduto && !confirm("Substituir o nome, a descrição, os objetivos, os benefícios e os riscos pelos do ficheiro?"))
        return;
      onAlterar((atual) => ({
        ...atual,
        nomeProduto: lido.nomeProduto,
        descricaoProduto: lido.descricaoProduto,
        justificacao: lido.justificacao,
        beneficiarios: lido.beneficiarios,
        beneficiosOperacionais: lido.beneficiosOperacionais,
      }));
      const de = { produto: "do produto", licenciamento: "do pedido de licenciamento", projeto: "de um projeto" }[lido.origem];
      setMensagem({
        tipo: "sucesso",
        texto:
          `Produto carregado do ficheiro ${de}.` +
          (lido.origem === "licenciamento" ? " Só o produto: as licenças, as condições e os lotes não foram tocados." : ""),
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível ler o ficheiro.",
      });
    }
  }

  function descarregar() {
    const blob = new Blob([produtoParaJSON(pedido)], { type: "application/json" });
    descarregarBlob(blob, nomeComProjeto(pedido.nomeProduto, "Produto.json"));
  }

  const justificacao = pedido.justificacao;
  const alterarJustificacao = (j: typeof justificacao) => onAlterar((atual) => ({ ...atual, justificacao: j }));

  return (
    <div className="modulo modulo-licenciamento">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 1 · Produto</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto" onClick={carregarExemplo}>
              Carregar exemplo
            </button>
            <button type="button" className="botao-discreto botao-recomecar" onClick={recomecar}>
              Recomeçar
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          O produto a licenciar e porque se adquire: objetivos, benefícios e riscos da não aquisição.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o responsável do produto.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Carregar produto</h3>
          <p className="painel-nota">Para retomar um produto guardado, ou começar a partir de outro já existente.</p>
        </header>
        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputRef.current?.click()}>
            Importar produto (JSON)
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importar(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
        <p className="ajuda">
          Aceita o JSON do produto, o do pedido de licenciamento (de onde tira só o produto) e o de um projeto. Substitui
          o que está escrito neste módulo (pede confirmação). Os dados do produto são próprios do pedido de
          licenciamento: o projeto da bolsa de horas não muda.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Identificação do produto</h3>
        </header>
        <label className="campo-largo">
          <span className="rotulo">Nome do produto</span>
          <input
            type="text"
            value={pedido.nomeProduto}
            placeholder="ex.: SNOMED CT"
            aria-invalid={pedido.nomeProduto.trim() === ""}
            onChange={(e) => onAlterar((atual) => ({ ...atual, nomeProduto: e.target.value }))}
          />
        </label>
        <p className="ajuda">
          Dá nome ao procedimento{procedimento ? ` («${procedimento}»)` : ""} e aos ficheiros descarregados.
        </p>
        <label className="campo-largo">
          <span className="rotulo">Descrição do produto</span>
          <textarea
            rows={3}
            value={pedido.descricaoProduto}
            placeholder="ex.: terminologia clínica de referência internacional, que permite codificar a informação clínica…"
            aria-invalid={pedido.descricaoProduto.trim() === ""}
            onChange={(e) => onAlterar((atual) => ({ ...atual, descricaoProduto: e.target.value }))}
          />
        </label>
        <p className="ajuda">
          O que é o produto. Sai na manifestação de necessidades e na descrição das especificações técnicas, pelo que
          uma ou duas frases bastam.
        </p>
      </section>

      <ListaItensEditor
        titulo="Objetivos da aquisição"
        nota={
          "Obrigatório. Um objetivo por linha. Abrem o «Enquadramento» da manifestação de necessidades, como " +
          "alíneas a., b., c.…"
        }
        nomeItem="objetivo"
        rotuloColuna="Objetivo"
        placeholder="ex.: Assegurar a utilização da SNOMED CT em todo o território nacional"
        textoVazio="Ainda não há objetivos. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar objetivo"
        itens={justificacao.objetivos}
        onChange={(objetivos) => alterarJustificacao({ ...justificacao, objetivos })}
      />

      <ListaItensEditor
        titulo="Benefícios do produto"
        nota={
          "Obrigatório. Um benefício por linha. Saem na identificação da necessidade e nos benefícios operacionais da " +
          "avaliação custo-benefício."
        }
        nomeItem="benefício"
        rotuloColuna="Benefício"
        placeholder="ex.: Interoperabilidade semântica entre os sistemas de informação do SNS"
        textoVazio="Ainda não há benefícios. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar benefício"
        itens={justificacao.beneficios}
        onChange={(beneficios) => alterarJustificacao({ ...justificacao, beneficios })}
      />

      <ListaItensEditor
        titulo="Riscos da não aquisição"
        nota={
          "Obrigatório. Um risco por linha: o que acontece se o produto não for adquirido. Saem na secção «Riscos da " +
          "não contratação» da manifestação de necessidades."
        }
        nomeItem="risco"
        rotuloColuna="Risco"
        placeholder="ex.: Os sistemas de informação deixam de poder usar a SNOMED CT no termo da afiliação"
        textoVazio="Ainda não há riscos. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar risco"
        itens={justificacao.riscos}
        onChange={(riscos) => alterarJustificacao({ ...justificacao, riscos })}
      />

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Avaliação custo-benefício</h3>
          <p className="painel-nota">
            Saem na secção «Avaliação custo-benefício» da manifestação de necessidades. Partem de um texto por omissão,
            que pode alterar.
          </p>
        </header>
        <label className="campo-largo">
          <span className="rotulo">Beneficiários</span>
          <textarea
            rows={2}
            value={beneficiariosDoPedido(pedido)}
            aria-invalid={beneficiariosDoPedido(pedido).trim() === ""}
            onChange={(e) => onAlterar((atual) => ({ ...atual, beneficiarios: e.target.value }))}
          />
        </label>
        {pedido.beneficiarios !== null && (
          <button
            type="button"
            className="botao-discreto"
            onClick={() => onAlterar((atual) => ({ ...atual, beneficiarios: null }))}
          >
            Repor o texto por omissão
          </button>
        )}
        <label className="campo-largo">
          <span className="rotulo">Benefícios operacionais</span>
          <textarea
            rows={3}
            value={beneficiosOperacionaisDoPedido(pedido)}
            placeholder="Formam-se a partir dos benefícios do produto, acima."
            aria-invalid={beneficiosOperacionaisDoPedido(pedido).trim() === ""}
            onChange={(e) => onAlterar((atual) => ({ ...atual, beneficiosOperacionais: e.target.value }))}
          />
        </label>
        {pedido.beneficiosOperacionais !== null ? (
          <button
            type="button"
            className="botao-discreto"
            onClick={() => onAlterar((atual) => ({ ...atual, beneficiosOperacionais: null }))}
          >
            Repor o texto por omissão
          </button>
        ) : (
          <p className="ajuda">Por omissão, são os benefícios do produto numa frase, e acompanham-nos enquanto não forem alterados.</p>
        )}
      </section>

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
          <button type="button" className="botao-principal" disabled={!temProduto} onClick={descarregar}>
            Descarregar produto (JSON)
          </button>
        </div>
        <p className="ajuda">
          Um JSON só com o produto — o nome, a descrição, os objetivos, os benefícios e os riscos —, sem licenças nem
          condições. Retoma-se em «Carregar produto».
        </p>
      </section>

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para as licenças</h3>
          <p className="painel-nota">O produto fica guardado neste navegador e é o ponto de partida do pedido.</p>
        </div>
        <button type="button" className="botao-principal" onClick={onIrParaLicencas}>
          Continuar para as licenças →
        </button>
      </section>
    </div>
  );
}
