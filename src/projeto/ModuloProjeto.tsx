import { useRef, useState } from "react";
import type { JustificacaoProjeto } from "../core/types";
import { BENEFICIO_FIXO } from "../core/types";
import { validarDescricaoProjeto, validarNomeProjeto } from "../core/perfil";
import { DESCRICAO_PROJETO_EXEMPLO, JUSTIFICACAO_EXEMPLO, NOME_PROJETO_EXEMPLO } from "../core/exemplo";
import { justificacaoInicial, validarJustificacao } from "../core/justificacao";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";
import { ErroImportacao } from "../core/perfil";
import { importarProjetoJSON, projetoParaJSON } from "../core/projetoJSON";
import { temJustificacao } from "../core/justificacao";
import { descarregarBlob, nomeComProjeto } from "../ui/descarregar";

interface Props {
  nomeProjeto: string;
  onAlterarNomeProjeto: (nome: string) => void;
  descricaoProjeto: string;
  onAlterarDescricaoProjeto: (descricao: string) => void;
  /** Objetivos da aquisição, benefícios do projeto e riscos da não contratação. */
  justificacao: JustificacaoProjeto;
  onAlterarJustificacao: (justificacao: JustificacaoProjeto) => void;
  /**
   * O passo seguinte do pedido de onde se veio: os perfis, no pedido de
   * serviços de bolsa de horas; o pedido, no de licenciamento.
   */
  seguinte: { titulo: string; nota: string; onIr: () => void };
  /** O quadro «Como funciona» é o do pedido de serviços de bolsa de horas. */
  mostrarComoFunciona: boolean;
}

const CHAVE_COMO_FUNCIONA = "propostas.v2.comoFuncionaFechado";

// Só uma conveniência de quem usa: se o navegador não guardar, volta a aparecer.
function comoFuncionaFechado(): boolean {
  try {
    return localStorage.getItem(CHAVE_COMO_FUNCIONA) === "1";
  } catch {
    return false;
  }
}

function fecharComoFunciona() {
  try {
    localStorage.setItem(CHAVE_COMO_FUNCIONA, "1");
  } catch {
    // Sem armazenamento, fica fechado só até recarregar.
  }
}

/**
 * Módulo 1 · Projeto.
 *
 * O que é do projeto e não de nenhum perfil: o nome, a descrição e as três
 * listas da manifestação de necessidades do pedido de serviços de bolsa de
 * horas (o licenciamento tem o seu Módulo 1, o Produto). Tem ficheiro próprio, só com a
 * caracterização, e viaja também dentro do JSON dos perfis e do dos lotes;
 * qualquer um dos três o repõe aqui.
 */
export function ModuloProjeto({
  nomeProjeto,
  onAlterarNomeProjeto,
  descricaoProjeto,
  onAlterarDescricaoProjeto,
  justificacao,
  onAlterarJustificacao,
  seguinte,
  mostrarComoFunciona,
}: Props) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const inputProjetoRef = useRef<HTMLInputElement>(null);
  const temProjeto = nomeProjeto.trim() !== "" || descricaoProjeto.trim() !== "" || temJustificacao(justificacao);
  const [verComoFunciona, setVerComoFunciona] = useState(() => !comoFuncionaFechado());

  const erros = [
    ...validarNomeProjeto(nomeProjeto),
    ...validarDescricaoProjeto(descricaoProjeto),
    ...validarJustificacao(justificacao),
  ];

  const podeCarregarExemplo = usePodeCarregarExemplo();

  async function carregarExemplo() {
    if (!(await podeCarregarExemplo())) return;
    onAlterarNomeProjeto(NOME_PROJETO_EXEMPLO);
    onAlterarDescricaoProjeto(DESCRICAO_PROJETO_EXEMPLO);
    onAlterarJustificacao(structuredClone(JUSTIFICACAO_EXEMPLO));
    setMensagem({ tipo: "sucesso", texto: "Projeto de exemplo carregado." });
  }

  function descarregarProjeto() {
    const blob = new Blob([projetoParaJSON(nomeProjeto, descricaoProjeto, justificacao)], {
      type: "application/json",
    });
    descarregarBlob(blob, nomeComProjeto(nomeProjeto, "Projeto.json"));
  }

  async function importarProjeto(ficheiro: File) {
    try {
      const lido = importarProjetoJSON(await ficheiro.text());
      if (
        temProjeto &&
        !confirm("Substituir o nome, a descrição, os objetivos, os benefícios e os riscos pelos do ficheiro?")
      ) {
        return;
      }
      onAlterarNomeProjeto(lido.nomeProjeto);
      onAlterarDescricaoProjeto(lido.descricaoProjeto);
      onAlterarJustificacao(lido.justificacao);
      const de = { projeto: "do projeto", perfis: "dos perfis", lotes: "dos lotes" }[lido.origem];
      setMensagem({
        tipo: "sucesso",
        texto:
          `Projeto carregado do ficheiro ${de}.` +
          (lido.origem === "projeto" ? "" : " Só a caracterização do projeto: os perfis e os lotes não foram tocados."),
      });
    } catch (erro) {
      setMensagem({
        tipo: "erro",
        texto: erro instanceof ErroImportacao ? erro.message : "Não foi possível ler o ficheiro.",
      });
    }
  }

  function recomecar() {
    if (
      !confirm(
        "Apagar o nome, a descrição, os objetivos, os benefícios e os riscos do projeto? Os perfis e os lotes ficam.",
      )
    ) {
      return;
    }
    // O nome vai com o resto: o nome de um projeto anterior num campo
    // preenchido é o género de resto que acaba dentro de uma peça.
    onAlterarNomeProjeto("");
    onAlterarDescricaoProjeto("");
    onAlterarJustificacao(justificacaoInicial());
    setMensagem({ tipo: "sucesso", texto: "Identificação do projeto reposta." });
  }

  return (
    <div className="modulo">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo 1 · Projeto</h2>
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
          Identifica o projeto e justifica a aquisição dos serviços de bolsa de horas.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o gestor do projeto.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

      {mostrarComoFunciona && verComoFunciona && (
        <section className="painel painel-como-funciona">
          <header className="painel-cabecalho">
            <h3>Como funciona a preparação</h3>
            <button
              type="button"
              className="botao-discreto"
              onClick={() => {
                fecharComoFunciona();
                setVerComoFunciona(false);
              }}
            >
              Fechar
            </button>
          </header>
          <ol className="passos-preparacao">
            <li>
              <strong>1 · Projeto</strong>
              Nome, descrição e justificação: objetivos, benefícios e riscos.
            </li>
            <li>
              <strong>2 · Perfis</strong>
              As funções e a experiência mínima exigida a cada perfil.
            </li>
            <li>
              <strong>3 · Lotes</strong>
              Horas, preço/hora e júri; no fim, descarrega o Anexo Técnico (ZIP).
            </li>
          </ol>
          <p className="ajuda">
            Primeira vez? Use «Carregar exemplo» em cada módulo para ver um procedimento completo. Tudo fica guardado
            neste navegador; nada sai deste computador.
          </p>
        </section>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Carregar projeto</h3>
          <p className="painel-nota">Para retomar um projeto guardado, ou começar a partir de um já existente.</p>
        </header>
        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={() => inputProjetoRef.current?.click()}>
            Importar projeto (JSON)
          </button>
          <input
            ref={inputProjetoRef}
            type="file"
            accept="application/json,.json"
            className="input-ficheiro-oculto"
            onChange={(e) => {
              const ficheiro = e.target.files?.[0];
              if (ficheiro) void importarProjeto(ficheiro);
              e.target.value = "";
            }}
          />
        </div>
        <p className="ajuda">
          Aceita o JSON do projeto e também o JSON dos perfis ou dos lotes, de onde tira só o projeto. Substitui o
          que está escrito neste módulo (pede confirmação); os perfis e os lotes não são tocados.
        </p>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Identificação do projeto</h3>
        </header>

        <label className="campo-largo">
          <span className="rotulo">Nome do projeto</span>
          <input
            type="text"
            value={nomeProjeto}
            placeholder="ex.: Modernização dos sistemas de informação"
            onChange={(e) => onAlterarNomeProjeto(e.target.value)}
            aria-invalid={nomeProjeto.trim() === ""}
          />
        </label>
        <p className="ajuda">Identifica o projeto e dá nome a todos os ficheiros descarregados, em todos os módulos.</p>

        <label className="campo-largo">
          <span className="rotulo">Descrição do projeto</span>
          <textarea
            rows={3}
            value={descricaoProjeto}
            placeholder="ex.: substituir as aplicações de gestão clínica por uma plataforma única e interoperável"
            onChange={(e) => onAlterarDescricaoProjeto(e.target.value)}
            aria-invalid={descricaoProjeto.trim() === ""}
          />
        </label>
        <p className="ajuda">
          O que o projeto se propõe fazer. Sai na manifestação de necessidades («…a necessidade visa:») e na
          descrição das especificações técnicas, pelo que uma ou duas frases bastam.
        </p>
      </section>

      <ListaItensEditor
        titulo="Objetivos da aquisição"
        nota={
          "Obrigatório. Um objetivo por linha. Abrem o «Enquadramento» da manifestação de necessidades, como " +
          "alíneas a., b., c.…, a seguir à frase «…que possibilitará atingir os seguintes objetivos»."
        }
        nomeItem="objetivo"
        rotuloColuna="Objetivo"
        placeholder="ex.: Assegurar a continuidade da manutenção das aplicações até à sua substituição"
        textoVazio="Ainda não há objetivos. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar objetivo"
        itens={justificacao.objetivos}
        onChange={(objetivos) => onAlterarJustificacao({ ...justificacao, objetivos })}
      />

      <ListaItensEditor
        titulo="Benefícios do projeto"
        nota={
          "Obrigatório. Um benefício por linha. Saem na manifestação de necessidades, como alíneas a., b., c.…, " +
          "na identificação da necessidade e nos benefícios operacionais da avaliação custo-benefício. O último é " +
          "fixo e fecha a lista em todos os projetos: acrescente pelo menos um antes dele."
        }
        nomeItem="benefício"
        rotuloColuna="Benefício"
        placeholder="ex.: Redução do tempo de registo clínico, com uma única aplicação em vez de várias"
        textoVazio="Ainda não há benefícios. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar benefício"
        itemFixo={BENEFICIO_FIXO}
        rotuloFixo="fixo"
        itens={justificacao.beneficios}
        onChange={(beneficios) => onAlterarJustificacao({ ...justificacao, beneficios })}
      />

      <ListaItensEditor
        titulo="Riscos da não contratação"
        nota={
          "Obrigatório. Um risco por linha: o que acontece se estes serviços não forem contratados. Saem na " +
          "secção «Riscos da não contratação» da manifestação de necessidades, também como alíneas."
        }
        nomeItem="risco"
        rotuloColuna="Risco"
        placeholder="ex.: Interrupção do suporte às aplicações em fim de vida"
        textoVazio="Ainda não há riscos. Acrescente o primeiro."
        rotuloAdicionar="+ Adicionar risco"
        itens={justificacao.riscos}
        onChange={(riscos) => onAlterarJustificacao({ ...justificacao, riscos })}
      />

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
          <button type="button" className="botao-principal" disabled={!temProjeto} onClick={descarregarProjeto}>
            Descarregar projeto (JSON)
          </button>
        </div>
        <p className="ajuda">
          Um JSON só com a caracterização do projeto — o nome, a descrição, os objetivos, os benefícios e os riscos —,
          sem perfis nem lotes. Serve para o guardar ou partilhar e para o retomar mais tarde em «Carregar projeto».
        </p>
      </section>

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para {seguinte.titulo}</h3>
          <p className="painel-nota">{seguinte.nota}</p>
        </div>
        <button type="button" className="botao-principal" onClick={seguinte.onIr}>
          Continuar para {seguinte.titulo} →
        </button>
      </section>
    </div>
  );
}
