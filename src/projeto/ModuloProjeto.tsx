import { useState } from "react";
import type { JustificacaoProjeto } from "../core/types";
import { BENEFICIO_FIXO } from "../core/types";
import { validarDescricaoProjeto, validarNomeProjeto } from "../core/perfil";
import { DESCRICAO_PROJETO_EXEMPLO, JUSTIFICACAO_EXEMPLO, NOME_PROJETO_EXEMPLO } from "../core/exemplo";
import { justificacaoInicial, validarJustificacao } from "../core/justificacao";
import { PainelMensagem, type Mensagem } from "../ui/PainelMensagem";
import { usePodeCarregarExemplo } from "../ui/contextoExemplos";
import { ListaItensEditor } from "../modulo1/ListaItensEditor";

interface Props {
  nomeProjeto: string;
  onAlterarNomeProjeto: (nome: string) => void;
  descricaoProjeto: string;
  onAlterarDescricaoProjeto: (descricao: string) => void;
  /** Objetivos da aquisição, benefícios do projeto e riscos da não contratação. */
  justificacao: JustificacaoProjeto;
  onAlterarJustificacao: (justificacao: JustificacaoProjeto) => void;
  onIrParaPerfis: () => void;
}

/**
 * Módulo 1 · Projeto.
 *
 * O que é do projeto e não de nenhum perfil: o nome, a descrição e as três
 * listas da manifestação de necessidades. Não tem ficheiro próprio — viaja
 * dentro do JSON dos perfis e do dos lotes, como sempre viajou, e é adotado de
 * lá ao importar se ainda não estiver escrito.
 */
export function ModuloProjeto({
  nomeProjeto,
  onAlterarNomeProjeto,
  descricaoProjeto,
  onAlterarDescricaoProjeto,
  justificacao,
  onAlterarJustificacao,
  onIrParaPerfis,
}: Props) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

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

  function recomecar() {
    if (!confirm("Apagar o nome, a descrição, os objetivos, os benefícios e os riscos do projeto?")) return;
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
          Identifica o projeto e justifica a aquisição. Escreve-se uma vez e segue para todas as peças.
        </p>
      </header>

      <PainelMensagem mensagem={mensagem} onFechar={() => setMensagem(null)} />

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

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para os perfis</h3>
          <p className="painel-nota">
            O projeto fica guardado neste navegador e segue nos ficheiros dos perfis e dos lotes. Pode avançar com
            questões por resolver, mas o Anexo Técnico só se descarrega depois de resolvidas.
          </p>
        </div>
        <button type="button" className="botao-principal" onClick={onIrParaPerfis}>
          Continuar para os perfis →
        </button>
      </section>
    </div>
  );
}
