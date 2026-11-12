import type { CriterioConsulta, FontePreco, OrigemPreco } from "../core/licenciamento";
import { CRITERIOS_CONSULTA, ORIGENS_PRECO, fonteVazia } from "../core/licenciamento";
import { CampoNumero } from "../ui/CampoNumero";

interface Props {
  rotulo: string;
  fonte: FontePreco;
  onChange: (fonte: FontePreco) => void;
  /** Origens que não se podem escolher (a principal, na complementar). */
  excluir?: OrigemPreco;
}

/**
 * Uma origem do preço de referência, com os campos que permitem verificá-la:
 * cada tipo pede os seus — o n.º e o ano do contrato anterior, a entidade e a
 * data do orçamento, as entidades consultadas e as respostas da consulta, a
 * ligação e o desconto da tabela, as ligações dos contratos no portal BASE.
 */
export function EditorOrigemPreco({ rotulo, fonte, onChange, excluir }: Props) {
  const muda = (alteracao: Partial<FontePreco>) => onChange({ ...fonte, ...alteracao });
  const opcoes = (Object.entries(ORIGENS_PRECO) as Array<[Exclude<OrigemPreco, "">, string]>).filter(
    ([v]) => v !== excluir,
  );
  const vazio = (v: string) => v.trim() === "";

  return (
    <div className="origem-preco">
      <div className="linha-campos">
        <label className="campo-crescente">
          <span className="rotulo">{rotulo}</span>
          <select
            value={fonte.tipo}
            aria-invalid={fonte.tipo === ""}
            onChange={(e) => onChange({ ...fonteVazia(e.target.value as OrigemPreco), data: fonte.data })}
          >
            {fonte.tipo === "" && <option value="">— por escolher —</option>}
            {opcoes.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {(fonte.tipo === "orcamento" || fonte.tipo === "consultaPreliminar" || fonte.tipo === "tabelaPublica") && (
          <label className="campo-data">
            <span className="rotulo">
              {fonte.tipo === "orcamento" ? "Data do orçamento" : fonte.tipo === "consultaPreliminar" ? "Data da consulta" : "Consultada em"}
            </span>
            <input type="date" value={fonte.data} aria-invalid={vazio(fonte.data)} onChange={(e) => muda({ data: e.target.value })} />
          </label>
        )}
      </div>

      {fonte.tipo === "contratoAnterior" && (
        <>
          <div className="linha-campos linha-campos-separada">
            <label className="campo-crescente">
              <span className="rotulo">N.º do contrato ou do procedimento</span>
              <input
                type="text"
                value={fonte.numero}
                placeholder="ex.: CP 45/2023"
                aria-invalid={vazio(fonte.numero)}
                onChange={(e) => muda({ numero: e.target.value })}
              />
            </label>
          </div>
          <div className="linha-campos linha-campos-numeros">
            <label className="campo-numero-rotulado">
              <span className="rotulo">Ano</span>
              <CampoNumero valor={fonte.ano} min={2000} step={1} aria-label="Ano do contrato anterior" invalido={!(fonte.ano >= 2000)} onChange={(ano) => muda({ ano })} />
            </label>
            <label className="campo-numero-rotulado">
              <span className="rotulo">Preço unitário de então (c/ IVA)</span>
              <CampoNumero valor={fonte.precoAnterior} min={0} step={0.01} sufixo="€" aria-label="Preço unitário de então" onChange={(precoAnterior) => muda({ precoAnterior })} />
            </label>
          </div>
        </>
      )}

      {fonte.tipo === "orcamento" && (
        <div className="linha-campos linha-campos-separada">
          <label className="campo-crescente">
            <span className="rotulo">Entidade</span>
            <input
              type="text"
              value={fonte.entidade}
              placeholder="ex.: SNOMED International"
              aria-invalid={vazio(fonte.entidade)}
              onChange={(e) => muda({ entidade: e.target.value })}
            />
          </label>
          <label className="campo-crescente">
            <span className="rotulo">Referência do orçamento</span>
            <input
              type="text"
              value={fonte.referencia}
              placeholder="facultativo — ex.: Q-2026-0412"
              onChange={(e) => muda({ referencia: e.target.value })}
            />
          </label>
        </div>
      )}

      {fonte.tipo === "consultaPreliminar" && (
        <div className="linha-campos linha-campos-numeros">
          <label className="campo-numero-rotulado">
            <span className="rotulo">Entidades consultadas</span>
            <CampoNumero
              valor={fonte.entidadesConsultadas}
              min={1}
              step={1}
              aria-label="Entidades consultadas"
              invalido={!(Number.isInteger(fonte.entidadesConsultadas) && fonte.entidadesConsultadas >= 1)}
              onChange={(entidadesConsultadas) => muda({ entidadesConsultadas })}
            />
          </label>
          <label className="campo-numero-rotulado">
            <span className="rotulo">Respostas recebidas</span>
            <CampoNumero
              valor={fonte.respostas}
              min={0}
              step={1}
              aria-label="Respostas recebidas"
              invalido={!(Number.isInteger(fonte.respostas) && fonte.respostas >= 0 && fonte.respostas <= fonte.entidadesConsultadas)}
              onChange={(respostas) => muda({ respostas })}
            />
          </label>
          <label className="campo-criterio">
            <span className="rotulo">Critério</span>
            <select
              value={fonte.criterio}
              aria-invalid={fonte.criterio === ""}
              onChange={(e) => muda({ criterio: e.target.value as CriterioConsulta })}
            >
              {fonte.criterio === "" && <option value="">— por escolher —</option>}
              {(Object.entries(CRITERIOS_CONSULTA) as Array<[Exclude<CriterioConsulta, "">, string]>).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {fonte.tipo === "tabelaPublica" && (
        <>
          <div className="linha-campos linha-campos-separada">
            <label className="campo-crescente">
              <span className="rotulo">Ligação ou indicação da tabela</span>
              <input
                type="text"
                value={fonte.ligacao}
                placeholder="ex.: https://… ou «Tabela de preços 2026, p. 4»"
                aria-invalid={vazio(fonte.ligacao)}
                onChange={(e) => muda({ ligacao: e.target.value })}
              />
            </label>
          </div>
          <div className="linha-campos linha-campos-numeros">
            <label className="campo-numero-rotulado">
              <span className="rotulo">Desconto sobre a tabela</span>
              <CampoNumero
                valor={fonte.desconto}
                min={0}
                step={1}
                sufixo="%"
                aria-label="Desconto sobre a tabela"
                invalido={!(fonte.desconto >= 0 && fonte.desconto < 100)}
                onChange={(desconto) => muda({ desconto })}
              />
            </label>
          </div>
        </>
      )}

      {fonte.tipo === "contratosBase" && (
        <label className="campo">
          <span className="rotulo">Ligações dos contratos no portal BASE (uma por linha)</span>
          <textarea
            rows={3}
            value={fonte.ligacao}
            placeholder="https://www.base.gov.pt/…"
            aria-invalid={vazio(fonte.ligacao)}
            onChange={(e) => muda({ ligacao: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
