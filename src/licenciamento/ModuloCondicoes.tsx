import type { ReactNode } from "react";
import type {
  CondicaoComTexto,
  CondicoesContrato,
  HorarioSuporte,
  NivelServico,
  PedidoLicenciamento,
} from "../core/licenciamento";
import {
  HORARIOS_SUPORTE,
  LIMITE_GLOBAL_PENALIZACOES,
  aplicabilidade,
  condicoesIniciais,
  horarioPorExtenso,
  niveisServicoPorOmissao,
  objetoPorExtenso,
  textoDaCondicao,
  tituloDaManutencao,
  validarCondicoes,
} from "../core/licenciamento";
import { gerarId } from "../core/id";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  onIrParaPedido: () => void;
}

type Selo = "obrigatória" | "recomendada" | "facultativa" | "se SaaS";

/**
 * Uma condição do contrato: o título, a marca, o interruptor quando se pode
 * desligar, o texto e os parâmetros. Quando não se aplica às licenças do L1,
 * fica só o título e a razão.
 */
function Condicao({
  titulo,
  selo,
  ligada,
  onLigar,
  naoAplica,
  texto,
  personalizado,
  onTexto,
  onRepor,
  children,
}: {
  titulo: string;
  selo: Selo;
  ligada?: boolean;
  onLigar?: (ligada: boolean) => void;
  /** A razão por que não se aplica, ou vazio. */
  naoAplica?: string;
  /** O texto da condição; sem ele (os níveis de serviço), ficam só os parâmetros. */
  texto?: string;
  /** Se o texto foi escrito à mão (e já não acompanha as licenças). */
  personalizado?: boolean;
  onTexto?: (texto: string) => void;
  onRepor?: () => void;
  children?: ReactNode;
}) {
  if (naoAplica) {
    return (
      <div className="condicao condicao-desligada">
        <div className="condicao-cabecalho">
          <strong className="condicao-titulo">{titulo}</strong>
          <span className="selo-condicao selo-condicao-opcional">não se aplica</span>
        </div>
        <p className="ajuda">{naoAplica}</p>
      </div>
    );
  }
  const ativa = ligada ?? true;
  return (
    <div className={ativa ? "condicao" : "condicao condicao-desligada"}>
      <div className="condicao-cabecalho">
        {onLigar ? (
          <label className="campo-opcao condicao-interruptor">
            <input type="checkbox" checked={ativa} onChange={(e) => onLigar(e.target.checked)} />
            <span>
              <strong>{titulo}</strong>
            </span>
          </label>
        ) : (
          <strong className="condicao-titulo">{titulo}</strong>
        )}
        <span className={`selo-condicao selo-condicao-${selo === "obrigatória" ? "obrigatoria" : "opcional"}`}>
          {selo}
        </span>
      </div>
      {ativa && (
        <>
          {texto !== undefined && (
            <>
              <label className="campo">
                <span className="rotulo-oculto">Texto da condição «{titulo}»</span>
                <textarea
                  rows={3}
                  value={texto}
                  aria-invalid={texto.trim() === ""}
                  onChange={(e) => onTexto?.(e.target.value)}
                />
              </label>
              {personalizado ? (
                <button type="button" className="botao-discreto" onClick={onRepor}>
                  Repor o texto por omissão
                </button>
              ) : (
                <p className="ajuda">Texto por omissão, adaptado às licenças do L1. Pode alterá-lo.</p>
              )}
            </>
          )}
          {children}
        </>
      )}
    </div>
  );
}

const HORA = /^([01]\d|2[0-4]):([0-5]\d)$/;

/**
 * L2 · Condições do contrato: o que o adjudicatário se obriga a cumprir. O
 * preço é o único critério; tudo o resto são termos e condições, e cada
 * condição ligada sai nas Especificações Técnicas (Anexo III).
 */
export function ModuloCondicoes({ pedido, onAlterar, onIrParaPedido }: Props) {
  const c = pedido.condicoes;
  const erros = validarCondicoes(pedido);

  function alterar<K extends keyof CondicoesContrato>(chave: K, alteracao: Partial<CondicoesContrato[K]>) {
    onAlterar((atual) => ({
      ...atual,
      condicoes: { ...atual.condicoes, [chave]: { ...atual.condicoes[chave], ...alteracao } },
    }));
  }

  /** As propriedades do texto de uma condição: o efetivo, se é escrito à mão, e como se muda e repõe. */
  const textoDe = (chave: CondicaoComTexto) => ({
    texto: textoDaCondicao(chave, pedido),
    personalizado: c[chave].texto !== null,
    onTexto: (texto: string) => alterar(chave, { texto } as Partial<CondicoesContrato[typeof chave]>),
    onRepor: () => alterar(chave, { texto: null } as Partial<CondicoesContrato[typeof chave]>),
  });

  function alterarNivel(id: string, alteracao: Partial<NivelServico>) {
    alterar("sla", { niveis: c.sla.niveis.map((n) => (n.id === id ? { ...n, ...alteracao } : n)) });
  }

  function alterarPropria(id: string, alteracao: Partial<{ titulo: string; texto: string }>) {
    onAlterar((atual) => ({
      ...atual,
      condicoes: {
        ...atual.condicoes,
        proprias: atual.condicoes.proprias.map((p) => (p.id === id ? { ...p, ...alteracao } : p)),
      },
    }));
  }

  function reporTudo() {
    if (!confirm("Repor todas as condições com os textos e valores por omissão? As condições próprias são apagadas."))
      return;
    onAlterar((atual) => ({ ...atual, condicoes: condicoesIniciais() }));
  }

  const manutencao = aplicabilidade("manutencao", pedido);
  const disponibilidade = aplicabilidade("disponibilidade", pedido);
  const resumo = [
    ...new Set(
      pedido.licencas
        .filter((l) => l.objeto !== "servico")
        .map(
          (l) => `${objetoPorExtenso(l).toLowerCase()} (${l.direitoUso === "temporario" ? "subscrição" : "perpétua"})`,
        ),
    ),
  ];
  const horaValida = (h: string) => HORA.test(h.trim());

  return (
    <div className="modulo modulo-licenciamento">
      <header className="modulo-cabecalho">
        <div className="modulo-titulo-linha">
          <h2>Módulo L2 · Condições do contrato</h2>
          <div className="acoes-linha">
            <button type="button" className="botao-discreto botao-recomecar" onClick={reporTudo}>
              Repor por omissão
            </button>
          </div>
        </div>
        <p className="modulo-subtitulo">
          O preço é o único critério: tudo o resto são termos e condições do contrato. Cada condição ligada sai nas
          Especificações Técnicas (Anexo III). Os textos por omissão partem das licenças do L1 e acompanham-nas enquanto
          não forem alterados à mão.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o responsável do produto.
        </p>
      </header>

      {pedido.licencas.length > 0 ? (
        <p className="aviso aviso-info" role="status">
          Licenças do L1: {resumo.join("; ")}. As condições que não se aplicam ficam assinaladas, com a razão.
        </p>
      ) : (
        <p className="aviso aviso-atencao" role="status">
          Ainda não há licenças no L1: os textos por omissão ficam genéricos até as acrescentar.
        </p>
      )}

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Âmbito da licença</h3>
        </header>

        <Condicao titulo="Âmbito da licença" selo="obrigatória" {...textoDe("ambito")} />
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Manutenção, suporte e níveis de serviço</h3>
        </header>

        <Condicao
          titulo={tituloDaManutencao(pedido)}
          selo="obrigatória"
          naoAplica={manutencao.aplica ? "" : manutencao.razao}
          {...textoDe("manutencao")}
        />

        <Condicao
          titulo="Suporte técnico"
          selo="recomendada"
          ligada={c.suporte.ligada}
          onLigar={(ligada) => alterar("suporte", { ligada })}
          {...textoDe("suporte")}
        >
          <div className="linha-campos linha-campos-separada">
            <label className="campo-estreito campo-horario">
              <span className="rotulo">Horário do suporte</span>
              <select
                value={c.suporte.horario}
                onChange={(e) => alterar("suporte", { horario: e.target.value as HorarioSuporte })}
              >
                {(Object.entries(HORARIOS_SUPORTE) as Array<[HorarioSuporte, string]>).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {c.suporte.horario === "personalizado" && (
              <label className="campo-crescente">
                <span className="rotulo">Dias</span>
                <input
                  type="text"
                  value={c.suporte.diasPersonalizados}
                  placeholder="ex.: Dias úteis e sábados"
                  aria-invalid={c.suporte.diasPersonalizados.trim() === ""}
                  onChange={(e) => alterar("suporte", { diasPersonalizados: e.target.value })}
                />
              </label>
            )}
            <label className="campo-hora">
              <span className="rotulo">Das</span>
              <input
                type="text"
                inputMode="numeric"
                value={c.suporte.horaInicio}
                placeholder="09:00"
                aria-invalid={!horaValida(c.suporte.horaInicio)}
                onChange={(e) => alterar("suporte", { horaInicio: e.target.value })}
              />
            </label>
            <label className="campo-hora">
              <span className="rotulo">Às</span>
              <input
                type="text"
                inputMode="numeric"
                value={c.suporte.horaFim}
                placeholder="18:00"
                aria-invalid={!horaValida(c.suporte.horaFim)}
                onChange={(e) => alterar("suporte", { horaFim: e.target.value })}
              />
            </label>
          </div>
          <p className="ajuda">
            Sai assim: «{horarioPorExtenso(c.suporte)}». Horas no formato 09:00; das 00:00 às 23:59 é o dia inteiro.
          </p>
        </Condicao>

        <Condicao
          titulo="Níveis de serviço (SLA)"
          selo="facultativa"
          ligada={c.sla.ligada}
          onLigar={(ligada) => alterar("sla", { ligada })}
          naoAplica={
            c.suporte.ligada ? "" : "Os níveis de serviço contam-se no horário do suporte técnico, que está desligado."
          }
        >
          <p className="ajuda">
            Tempos máximos por nível, em horas do horário de suporte. Por omissão, os três níveis abaixo; pode
            alterá-los, acrescentar ou retirar. A penalização por hora de atraso aplica-se ao primeiro nível.
          </p>
          {c.sla.niveis.length === 0 ? (
            <p className="estado-vazio">
              Sem níveis de serviço. Acrescente o primeiro, ou reponha os três por omissão.
            </p>
          ) : (
            <div className="tabela-edicao tabela-sla">
              <div className="grelha-sla tabela-edicao-cabecalho">
                <span />
                <span>Nível</span>
                <span>Descrição</span>
                <span>Resposta</span>
                <span>Resolução</span>
                <span />
              </div>
              {c.sla.niveis.map((n, i) => (
                <div key={n.id} className="grelha-sla linha-edicao">
                  <span className="pega" aria-hidden="true">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={n.nome}
                    placeholder="ex.: Crítica"
                    aria-label={`Nome do nível ${i + 1}`}
                    aria-invalid={n.nome.trim() === ""}
                    onChange={(e) => alterarNivel(n.id, { nome: e.target.value })}
                  />
                  <input
                    type="text"
                    value={n.descricao}
                    placeholder="ex.: Serviço indisponível, sem alternativa de contorno"
                    aria-label={`Descrição do nível ${i + 1}`}
                    onChange={(e) => alterarNivel(n.id, { descricao: e.target.value })}
                  />
                  <CampoNumero
                    valor={n.resposta}
                    min={0}
                    step={1}
                    sufixo="h"
                    aria-label={`Resposta do nível ${i + 1}`}
                    invalido={!(n.resposta > 0)}
                    onChange={(resposta) => alterarNivel(n.id, { resposta })}
                  />
                  <CampoNumero
                    valor={n.resolucao}
                    min={0}
                    step={1}
                    sufixo="h"
                    aria-label={`Resolução do nível ${i + 1}`}
                    invalido={!(n.resolucao > 0) || n.resolucao < n.resposta}
                    onChange={(resolucao) => alterarNivel(n.id, { resolucao })}
                  />
                  <button
                    type="button"
                    className="botao-icone botao-perigo"
                    title="Remover o nível"
                    aria-label={`Remover o nível ${i + 1}`}
                    onClick={() => alterar("sla", { niveis: c.sla.niveis.filter((x) => x.id !== n.id) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="acoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() =>
                alterar("sla", {
                  niveis: [...c.sla.niveis, { id: gerarId(), nome: "", descricao: "", resposta: 0, resolucao: 0 }],
                })
              }
            >
              + Acrescentar nível
            </button>
            <button
              type="button"
              className="botao-discreto"
              onClick={() => alterar("sla", { niveis: niveisServicoPorOmissao() })}
            >
              Repor os três níveis por omissão
            </button>
          </div>
        </Condicao>

        <Condicao
          titulo="Disponibilidade (SaaS)"
          selo="se SaaS"
          ligada={c.disponibilidade.ligada}
          onLigar={(ligada) => alterar("disponibilidade", { ligada })}
          naoAplica={disponibilidade.aplica ? "" : disponibilidade.razao}
          {...textoDe("disponibilidade")}
        >
          <div className="linha-campos linha-campos-numeros">
            <label className="campo-numero-rotulado">
              <span className="rotulo">Disponibilidade mensal mínima</span>
              <CampoNumero
                valor={c.disponibilidade.percentagem}
                min={0}
                step={0.1}
                sufixo="%"
                aria-label="Disponibilidade mensal mínima"
                invalido={!(c.disponibilidade.percentagem > 0 && c.disponibilidade.percentagem <= 100)}
                onChange={(percentagem) => alterar("disponibilidade", { percentagem })}
              />
            </label>
          </div>
          <label className="campo-opcao">
            <input
              type="checkbox"
              checked={c.disponibilidade.janelasForaDoHorario}
              onChange={(e) => alterar("disponibilidade", { janelasForaDoHorario: e.target.checked })}
            />
            <span>
              <strong>Janelas de manutenção fora do horário de funcionamento</strong>
              <span className="meta">Comunicadas com, pelo menos, 5 dias úteis de antecedência.</span>
            </span>
          </label>
        </Condicao>

        <Condicao
          titulo="Penalizações"
          selo="facultativa"
          ligada={c.penalizacoes.ligada}
          onLigar={(ligada) => alterar("penalizacoes", { ligada })}
          {...textoDe("penalizacoes")}
        >
          <p className="ajuda">
            Facultativas: podem ficar para a formulação do contrato. Ligue-as se quiser fixá-las já na manifestação de
            necessidades.
          </p>
          <div className="linha-campos linha-campos-numeros">
            <label className="campo-numero-rotulado">
              <span className="rotulo">Por hora de atraso (crítica)</span>
              <CampoNumero
                valor={c.penalizacoes.porHoraCritica}
                min={0}
                step={0.1}
                sufixo="% / mês"
                aria-label="Penalização por hora de atraso"
                invalido={!(c.penalizacoes.porHoraCritica > 0)}
                onChange={(porHoraCritica) => alterar("penalizacoes", { porHoraCritica })}
              />
            </label>
            <label className="campo-numero-rotulado">
              <span className="rotulo">Limite mensal</span>
              <CampoNumero
                valor={c.penalizacoes.limiteMensal}
                min={0}
                step={1}
                sufixo="% / mês"
                aria-label="Limite mensal das penalizações"
                invalido={!(c.penalizacoes.limiteMensal > 0)}
                onChange={(limiteMensal) => alterar("penalizacoes", { limiteMensal })}
              />
            </label>
            <label className="campo-numero-rotulado">
              <span className="rotulo">Limite global</span>
              <CampoNumero
                valor={c.penalizacoes.limiteGlobal}
                min={0}
                step={1}
                sufixo="% do contrato"
                aria-label="Limite global das penalizações"
                invalido={
                  !(c.penalizacoes.limiteGlobal > 0) || c.penalizacoes.limiteGlobal > LIMITE_GLOBAL_PENALIZACOES
                }
                onChange={(limiteGlobal) => alterar("penalizacoes", { limiteGlobal })}
              />
            </label>
          </div>
          <p className="ajuda">
            Em percentagem do valor mensal do contrato (o preço do lote a dividir pelos meses). O limite global não pode
            exceder {LIMITE_GLOBAL_PENALIZACOES} % do preço contratual (art.º 329.º do CCP).
          </p>
        </Condicao>

        <Condicao
          titulo="Prazo de disponibilização"
          selo="recomendada"
          ligada={c.prazo.ligada}
          onLigar={(ligada) => alterar("prazo", { ligada })}
          {...textoDe("prazo")}
        >
          <div className="linha-campos linha-campos-numeros">
            <label className="campo-numero-rotulado">
              <span className="rotulo">Prazo máximo</span>
              <CampoNumero
                valor={c.prazo.diasUteis}
                min={1}
                step={1}
                sufixo="dias úteis"
                aria-label="Prazo de disponibilização"
                invalido={!(Number.isInteger(c.prazo.diasUteis) && c.prazo.diasUteis > 0)}
                onChange={(diasUteis) => alterar("prazo", { diasUteis })}
              />
            </label>
          </div>
        </Condicao>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Condições próprias</h3>
          <p className="painel-nota">
            Outras obrigações do adjudicatário, com título e texto. Cada uma sai como ponto próprio do Anexo III. Por
            exemplo: a formação dos administradores, ou os ambientes de teste, formação e recuperação sem custo (num
            software instalado, as cópias usadas só nesses ambientes não contam para a quantidade nem se pagam à
            parte).
          </p>
        </header>
        {c.proprias.length === 0 && <p className="estado-vazio">Sem condições próprias.</p>}
        {c.proprias.map((p, i) => (
          <div key={p.id} className="condicao">
            <div className="linha-campos">
              <label className="campo-crescente">
                <span className="rotulo">Título da condição {i + 1}</span>
                <input
                  type="text"
                  value={p.titulo}
                  placeholder="ex.: Formação dos administradores; Ambientes de teste, formação e recuperação sem custo"
                  aria-invalid={p.titulo.trim() === ""}
                  onChange={(e) => alterarPropria(p.id, { titulo: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="botao-discreto botao-perigo"
                onClick={() =>
                  onAlterar((atual) => ({
                    ...atual,
                    condicoes: { ...atual.condicoes, proprias: atual.condicoes.proprias.filter((x) => x.id !== p.id) },
                  }))
                }
              >
                Remover
              </button>
            </div>
            <label className="campo">
              <span className="rotulo">Texto</span>
              <textarea
                rows={3}
                value={p.texto}
                aria-invalid={p.texto.trim() === ""}
                onChange={(e) => alterarPropria(p.id, { texto: e.target.value })}
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="botao-secundario"
          onClick={() =>
            onAlterar((atual) => ({
              ...atual,
              condicoes: {
                ...atual.condicoes,
                proprias: [...atual.condicoes.proprias, { id: gerarId(), titulo: "", texto: "" }],
              },
            }))
          }
        >
          + Condição própria
        </button>
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

      <section className="painel painel-avancar">
        <div>
          <h3>Continuar para o pedido</h3>
          <p className="painel-nota">
            {erros.length === 0
              ? "As condições estão completas."
              : `${erros.length === 1 ? "1 questão" : `${erros.length} questões`} por resolver.`}
          </p>
        </div>
        <button type="button" className="botao-principal" onClick={onIrParaPedido}>
          Continuar para L3 →
        </button>
      </section>
    </div>
  );
}
