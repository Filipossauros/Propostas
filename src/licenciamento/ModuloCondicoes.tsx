import type { ReactNode } from "react";
import type { CondicoesContrato, HorarioSuporte, PedidoLicenciamento, TemposDeSeveridade } from "../core/licenciamento";
import {
  HORARIOS_SUPORTE,
  LIMITE_GLOBAL_PENALIZACOES,
  TEXTOS_CONDICOES,
  condicoesIniciais,
  validarCondicoes,
} from "../core/licenciamento";
import { gerarId } from "../core/id";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  pedido: PedidoLicenciamento;
  onAlterar: (atualizar: (atual: PedidoLicenciamento) => PedidoLicenciamento) => void;
  onIrParaPedido: () => void;
}

type Selo = "obrigatória" | "recomendada" | "se SaaS";

/**
 * Uma condição do contrato: o título, a marca (obrigatória, recomendada…), o
 * interruptor quando se pode desligar, o texto e os parâmetros.
 */
function Condicao({
  titulo,
  selo,
  ligada,
  onLigar,
  texto,
  textoPorOmissao,
  onTexto,
  children,
}: {
  titulo: string;
  selo: Selo;
  ligada?: boolean;
  onLigar?: (ligada: boolean) => void;
  texto: string;
  textoPorOmissao: string;
  onTexto: (texto: string) => void;
  children?: ReactNode;
}) {
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
        <span className={`selo-condicao selo-condicao-${selo === "obrigatória" ? "obrigatoria" : "opcional"}`}>{selo}</span>
      </div>
      {ativa && (
        <>
          <label className="campo">
            <span className="rotulo-oculto">Texto da condição «{titulo}»</span>
            <textarea rows={3} value={texto} aria-invalid={texto.trim() === ""} onChange={(e) => onTexto(e.target.value)} />
          </label>
          {texto.trim() !== textoPorOmissao && (
            <button type="button" className="botao-discreto" onClick={() => onTexto(textoPorOmissao)}>
              Repor o texto por omissão
            </button>
          )}
          {children}
        </>
      )}
    </div>
  );
}

function Horas({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: number;
  onChange: (valor: number) => void;
}) {
  return (
    <label className="campo-numero-rotulado">
      <span className="rotulo">{rotulo}</span>
      <CampoNumero valor={valor} min={0} step={1} sufixo="h" aria-label={rotulo} invalido={!(valor > 0)} onChange={onChange} />
    </label>
  );
}

/**
 * L2 · Condições do contrato: o que o adjudicatário se obriga a cumprir. O
 * preço é o único critério; tudo o resto são termos e condições, e cada
 * condição ligada sai nas Especificações Técnicas (Anexo III).
 */
export function ModuloCondicoes({ pedido, onAlterar, onIrParaPedido }: Props) {
  const c = pedido.condicoes;
  const erros = validarCondicoes(c);
  const temSaaS = pedido.produtos.some((p) => p.direitoUso === "temporario");

  function alterar<K extends keyof CondicoesContrato>(chave: K, alteracao: Partial<CondicoesContrato[K]>) {
    onAlterar((atual) => ({
      ...atual,
      condicoes: { ...atual.condicoes, [chave]: { ...atual.condicoes[chave], ...alteracao } },
    }));
  }

  function severidade(chave: "critica" | "alta" | "normal", alteracao: Partial<TemposDeSeveridade>) {
    alterar("suporte", { [chave]: { ...c.suporte[chave], ...alteracao } });
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

  const ligadas =
    4 + Number(c.suporte.ligada) + Number(c.disponibilidade.ligada) + Number(c.prazo.ligada) + c.proprias.length;
  const total = 7 + c.proprias.length;

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
          Especificações Técnicas (Anexo III), com o texto e os valores aqui fixados.
        </p>
        <p className="modulo-quem">
          <strong>Quem preenche:</strong> o gestor do projeto.
        </p>
      </header>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Âmbito e direitos de utilização</h3>
        </header>

        <Condicao
          titulo="Âmbito da licença"
          selo="obrigatória"
          texto={c.ambito.texto}
          textoPorOmissao={TEXTOS_CONDICOES.ambito}
          onTexto={(texto) => alterar("ambito", { texto })}
        >
          <div className="linha-campos linha-campos-separada">
            <label className="campo-crescente">
              <span className="rotulo">Entidades abrangidas</span>
              <input
                type="text"
                value={c.ambito.entidades}
                placeholder="facultativo — ex.: SPMS, E.P.E. e Unidades Locais de Saúde"
                onChange={(e) => alterar("ambito", { entidades: e.target.value })}
              />
            </label>
          </div>
          <label className="campo-opcao">
            <input
              type="checkbox"
              checked={c.ambito.naoProdutivosSemCusto}
              onChange={(e) => alterar("ambito", { naoProdutivosSemCusto: e.target.checked })}
            />
            <span>
              <strong>Ambientes não produtivos sem custo</strong>
              <span className="meta">Teste, formação e recuperação não contam para o licenciamento.</span>
            </span>
          </label>
        </Condicao>

        <Condicao
          titulo="Direito de uso e transmissão"
          selo="obrigatória"
          texto={c.direitoUso.texto}
          textoPorOmissao={TEXTOS_CONDICOES.direitoUso}
          onTexto={(texto) => alterar("direitoUso", { texto })}
        >
          <label className="campo-opcao">
            <input
              type="checkbox"
              checked={c.direitoUso.transmissao}
              onChange={(e) => alterar("direitoUso", { transmissao: e.target.checked })}
            />
            <span>
              <strong>Transmissão a outra entidade do SNS, sem custo</strong>
              <span className="meta">Mediante comunicação prévia ao adjudicatário.</span>
            </span>
          </label>
        </Condicao>
      </section>

      <section className="painel">
        <header className="painel-cabecalho">
          <h3>Manutenção, suporte e níveis de serviço</h3>
        </header>

        <Condicao
          titulo="Manutenção e atualizações"
          selo="obrigatória"
          texto={c.manutencao.texto}
          textoPorOmissao={TEXTOS_CONDICOES.manutencao}
          onTexto={(texto) => alterar("manutencao", { texto })}
        />

        <Condicao
          titulo="Suporte técnico e SLA"
          selo="recomendada"
          ligada={c.suporte.ligada}
          onLigar={(ligada) => alterar("suporte", { ligada })}
          texto={c.suporte.texto}
          textoPorOmissao={TEXTOS_CONDICOES.suporte}
          onTexto={(texto) => alterar("suporte", { texto })}
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
          </div>
          {(
            [
              ["critica", "Crítica"],
              ["alta", "Alta"],
              ["normal", "Normal"],
            ] as const
          ).map(([chave, nome]) => (
            <div key={chave} className="linha-campos linha-campos-numeros">
              <Horas
                rotulo={`${nome} — resposta`}
                valor={c.suporte[chave].resposta}
                onChange={(resposta) => severidade(chave, { resposta })}
              />
              <Horas
                rotulo={`${nome} — resolução`}
                valor={c.suporte[chave].resolucao}
                onChange={(resolucao) => severidade(chave, { resolucao })}
              />
            </div>
          ))}
          <p className="ajuda">
            Tempos máximos por severidade, em horas {c.suporte.horario === "uteis" ? "do horário de suporte" : "seguidas"}.
            Crítica: serviço indisponível ou perda de dados; alta: funcionalidade relevante afetada; normal: os
            restantes.
          </p>
        </Condicao>

        <Condicao
          titulo="Disponibilidade (SaaS)"
          selo="se SaaS"
          ligada={c.disponibilidade.ligada}
          onLigar={(ligada) => alterar("disponibilidade", { ligada })}
          texto={c.disponibilidade.texto}
          textoPorOmissao={TEXTOS_CONDICOES.disponibilidade}
          onTexto={(texto) => alterar("disponibilidade", { texto })}
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
          {!temSaaS && pedido.produtos.length > 0 && (
            <p className="aviso aviso-atencao" role="status">
              Nenhum produto do L1 é uma subscrição: a disponibilidade só faz sentido num serviço prestado pelo
              fornecedor (SaaS). Desligue-a se não se aplicar.
            </p>
          )}
        </Condicao>

        <Condicao
          titulo="Penalizações"
          selo="obrigatória"
          texto={c.penalizacoes.texto}
          textoPorOmissao={TEXTOS_CONDICOES.penalizacoes}
          onTexto={(texto) => alterar("penalizacoes", { texto })}
        >
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
                invalido={!(c.penalizacoes.limiteGlobal > 0) || c.penalizacoes.limiteGlobal > LIMITE_GLOBAL_PENALIZACOES}
                onChange={(limiteGlobal) => alterar("penalizacoes", { limiteGlobal })}
              />
            </label>
          </div>
          <p className="ajuda">
            Em percentagem do valor mensal do contrato (o preço do lote a dividir pelos meses). O limite global não
            pode exceder {LIMITE_GLOBAL_PENALIZACOES} % do preço contratual (art.º 329.º do CCP).
          </p>
        </Condicao>

        <Condicao
          titulo="Prazo de disponibilização"
          selo="recomendada"
          ligada={c.prazo.ligada}
          onLigar={(ligada) => alterar("prazo", { ligada })}
          texto={c.prazo.texto}
          textoPorOmissao={TEXTOS_CONDICOES.prazo}
          onTexto={(texto) => alterar("prazo", { texto })}
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
            Outras obrigações do adjudicatário, com título e texto. Cada uma sai como ponto próprio do Anexo III.
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
                  placeholder="ex.: Formação dos administradores"
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
            {ligadas} de {total} condições ligadas.
            {erros.length > 0 && ` ${erros.length === 1 ? "1 questão" : `${erros.length} questões`} por resolver.`}
          </p>
        </div>
        <button type="button" className="botao-principal" onClick={onIrParaPedido}>
          Continuar para L3 →
        </button>
      </section>
    </div>
  );
}
