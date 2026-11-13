import { ehLinhaDeLicenca, type ProjetoVistaGeral } from "../core/vistaGeral";

/** A origem do projeto, numa etiqueta: o tipo do pedido, ou importado de ficheiro. */
export function EtiquetaDoProjeto({ projeto }: { projeto: ProjetoVistaGeral }) {
  if (projeto.tipoPedido === "licenciamento")
    return <span className="etiqueta-tipo etiqueta-tipo-licenciamento">Licenciamento</span>;
  if (projeto.tipoPedido === "bolsa") return <span className="etiqueta-tipo etiqueta-tipo-bolsa">Bolsa de horas</span>;
  return (
    <span className="etiqueta-tipo etiqueta-tipo-importado" title="Importado de ficheiro, sem pedido na biblioteca">
      Importado
    </span>
  );
}

/** O botão que abre e fecha as linhas de um projeto. */
export function BotaoColapsar({
  projeto,
  colapsado,
  onAlternar,
}: {
  projeto: ProjetoVistaGeral;
  colapsado: boolean;
  onAlternar: (projetoId: string) => void;
}) {
  return (
    <button
      type="button"
      className="botao-icone botao-colapsar"
      aria-expanded={!colapsado}
      aria-label={`${colapsado ? "Mostrar" : "Esconder"} as linhas de ${projeto.nome}`}
      title={colapsado ? "Mostrar as linhas" : "Colapsar o projeto"}
      onClick={() => onAlternar(projeto.id)}
    >
      {colapsado ? "▸" : "▾"}
    </button>
  );
}

/** «7 perfis · 2 internos», «3 licenças»: o conteúdo do projeto, numa linha colapsada. */
// oxlint-disable-next-line react/only-export-components
export function resumoDoProjeto(projeto: ProjetoVistaGeral): string {
  const licencas = projeto.entradas.filter(ehLinhaDeLicenca).length;
  const perfis = projeto.entradas.length - licencas;
  const partes: string[] = [];
  if (perfis > 0) partes.push(`${perfis} ${perfis === 1 ? "perfil" : "perfis"}`);
  if (licencas > 0) partes.push(`${licencas} ${licencas === 1 ? "licença" : "licenças"}`);
  if (projeto.internos.length > 0)
    partes.push(`${projeto.internos.length} ${projeto.internos.length === 1 ? "interno" : "internos"}`);
  return partes.join(" · ") || "sem linhas";
}
