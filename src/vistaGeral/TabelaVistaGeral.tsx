import { useState } from "react";
import { useArrastoDeProjetos, type Arrasto } from "./arrasto";
import { formatarMoeda } from "../core/lotes";
import {
  anosDoOrcamento,
  totaisPorAnoDaUnidade,
  totaisPorAnoDaUnidadeSemIva,
  valorDaEntradaNoAno,
  type OrcamentoUnidade,
  type ProjetoVistaGeral,
} from "../core/vistaGeral";

interface Props {
  orcamento: OrcamentoUnidade;
  onRemoverProjeto: (projetoId: string) => void;
  onRemoverInterno: (projetoId: string, internoId: string) => void;
  onAcrescentarInterno: (projetoId: string, nome: string) => void;
  onMoverProjeto: (arrastadoId: string, alvoId: string) => void;
  onDeslocarProjeto: (projetoId: string, passos: number) => void;
}

/**
 * O campo de registo de um elemento interno, no fim das linhas do projeto.
 *
 * Tem estado próprio, e não um por projeto guardado acima: o que ali está por
 * escrever não é orçamento nenhum — é meia palavra — e não tem de subir ao
 * estado partilhado nem de sair nos ficheiros.
 */
function CampoInterno({ onAcrescentar }: { onAcrescentar: (nome: string) => void }) {
  const [nome, setNome] = useState("");

  function acrescentar() {
    if (nome.trim() === "") return;
    onAcrescentar(nome);
    setNome("");
  }

  return (
    <div className="linha-interno">
      <input
        type="text"
        value={nome}
        placeholder="Nome de um elemento interno"
        aria-label="Nome de um elemento interno"
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            acrescentar();
          }
        }}
      />
      <button type="button" className="botao-secundario" onClick={acrescentar} disabled={nome.trim() === ""}>
        + Acrescentar
      </button>
    </div>
  );
}

export function TabelaVistaGeral({
  orcamento,
  onRemoverProjeto,
  onRemoverInterno,
  onAcrescentarInterno,
  onMoverProjeto,
  onDeslocarProjeto,
}: Props) {
  const anos = anosDoOrcamento(orcamento);
  const arrasto = useArrastoDeProjetos({ onMover: onMoverProjeto, onDeslocar: onDeslocarProjeto });

  if (orcamento.projetos.length === 0) {
    return <p className="estado-vazio">Importe os JSON de lotes do Módulo 2 para começar a vista.</p>;
  }

  const totaisAnos = totaisPorAnoDaUnidade(orcamento);
  const totaisAnosSemIva = totaisPorAnoDaUnidadeSemIva(orcamento);

  /** Da coluna «Pessoas» à última dos anos: o que uma linha ocupa à direita do projeto. */
  const colunasDaLinha = 4 + anos.length;

  return (
    <div className="tabela-envolvente">
      <table className="tabela tabela-unidade">
        <caption className="tabela-legenda">
          Uma linha por perfil e por elemento interno. Cada elemento interno conta uma pessoa, ao lado dos elementos
          exigidos em cada perfil. Arraste um projeto para o reordenar; a ordem é a mesma nas duas tabelas.
        </caption>

        <thead>
          <tr>
            <th scope="col">Projeto</th>
            <th scope="col" className="numerico">
              Lotes
            </th>
            <th scope="col">Perfil</th>
            <th scope="col" className="numerico">
              Pessoas
            </th>
            <th scope="col" className="numerico">
              Rate (€/h) <span className="cabecalho-nota">c/ IVA</span>
            </th>
            {anos.map((ano) => (
              <th key={ano} scope="col" className="numerico">
                Total € c/ IVA <span className="cabecalho-nota">(11 meses)</span>{" "}
                <span className="cabecalho-nota">{ano}</span>
              </th>
            ))}
            <th scope="col">
              <span className="rotulo-oculto">Ações</span>
            </th>
          </tr>
        </thead>

        {orcamento.projetos.map((projeto) => (
          <LinhasDoProjeto
            key={projeto.id}
            projeto={projeto}
            anos={anos}
            colunasDaLinha={colunasDaLinha}
            arrasto={arrasto}
            onRemoverProjeto={onRemoverProjeto}
            onRemoverInterno={onRemoverInterno}
            onAcrescentarInterno={onAcrescentarInterno}
          />
        ))}

        <tfoot>
          <tr>
            <th scope="row" colSpan={5}>
              Total da unidade
            </th>
            {totaisAnos.map((total, i) => (
              <td key={anos[i]} className="numerico">
                {/* As duas versões só aqui: é este o valor que instrui o
                    processo, e é aqui que a pergunta se faz. Em cada linha
                    dobrava a altura da tabela para nada. */}
                <strong>{formatarMoeda(total)}</strong>
                <span className="total-sem-iva">{formatarMoeda(totaisAnosSemIva[i])} s/ IVA</span>
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface PropsProjeto extends Omit<Props, "orcamento" | "onMoverProjeto" | "onDeslocarProjeto"> {
  projeto: ProjetoVistaGeral;
  anos: number[];
  colunasDaLinha: number;
  arrasto: Arrasto;
}

/**
 * Um `tbody` por projeto.
 *
 * O nome do projeto escreve-se uma vez e abrange as linhas todas: vê-lo
 * repetido em cada perfil tornaria impossível dizer, de relance, onde acaba um
 * projeto e começa o seguinte.
 */
function LinhasDoProjeto({
  projeto,
  anos,
  colunasDaLinha,
  arrasto,
  onRemoverProjeto,
  onRemoverInterno,
  onAcrescentarInterno,
}: PropsProjeto) {
  // A última linha é sempre a de acrescentar um elemento interno.
  const nLinhas = projeto.entradas.length + projeto.internos.length + 1;

  const celulaDoProjeto = (
    <th scope="rowgroup" rowSpan={nLinhas} className="celula-projeto">
      <div className="projeto-nome">
        <span {...arrasto.pega(projeto.id, projeto.nome)}>⠿</span>
        <strong>{projeto.nome}</strong>
        <button
          type="button"
          className="botao-icone botao-perigo"
          aria-label={`Remover o projeto ${projeto.nome}`}
          onClick={() => onRemoverProjeto(projeto.id)}
        >
          ×
        </button>
      </div>
      <p className="meta">A partir de {projeto.anoInicio}</p>
    </th>
  );

  // As linhas do meio, por ordem: primeiro os perfis, depois quem é da casa.
  const linhas: Array<{ chave: string; celulas: React.ReactNode; acoes: React.ReactNode; interno?: boolean }> = [
    ...projeto.entradas.map((entrada) => ({
      chave: entrada.id,
      // Um perfil vem do agrupamento e não se apaga aqui: o que se retira da
      // vista é o projeto inteiro, ou quem é da casa.
      acoes: null,
      celulas: (
        <>
          <td className="numerico">{entrada.lote}</td>
          <td>{entrada.perfil}</td>
          <td className="numerico">{entrada.pessoas}</td>
          <td className="numerico">{formatarMoeda(entrada.valorHoraComIva)}</td>
          {anos.map((ano) => {
            const valor = valorDaEntradaNoAno(projeto, entrada, ano);
            return (
              <td key={ano} className="numerico">
                {valor === null ? <span className="meta">—</span> : formatarMoeda(valor)}
              </td>
            );
          })}
        </>
      ),
    })),
    ...projeto.internos.map((interno) => ({
      chave: interno.id,
      acoes: (
        <button
          type="button"
          className="botao-icone botao-perigo"
          aria-label={`Remover ${interno.nome} de ${projeto.nome}`}
          onClick={() => onRemoverInterno(projeto.id, interno.id)}
        >
          ×
        </button>
      ),
      interno: true,
      celulas: (
        <>
          <td className="numerico">
            <span className="meta">—</span>
          </td>
          <td>
            {interno.nome} <span className="etiqueta-interno">interno</span>
          </td>
          <td className="numerico">1</td>
          <td className="numerico">
            <span className="meta">—</span>
          </td>
          {anos.map((ano) => (
            <td key={ano} className="numerico">
              <span className="meta">—</span>
            </td>
          ))}
        </>
      ),
    })),
    {
      chave: "acrescentar",
      acoes: null,
      celulas: (
        <td colSpan={colunasDaLinha}>
          <CampoInterno onAcrescentar={(nome) => onAcrescentarInterno(projeto.id, nome)} />
        </td>
      ),
    },
  ];

  return (
    <tbody className={`grupo-projeto ${arrasto.classe(projeto.id)}`.trim()} {...arrasto.zona(projeto.id)}>
      {linhas.map((linha, i) => (
        <tr
          key={linha.chave}
          className={
            linha.chave === "acrescentar"
              ? "linha-acrescentar"
              : linha.interno === true
                ? "linha-interno-registado"
                : undefined
          }
        >
          {i === 0 && celulaDoProjeto}
          {linha.celulas}
          <td className="celula-acoes">{linha.acoes}</td>
        </tr>
      ))}
    </tbody>
  );
}
