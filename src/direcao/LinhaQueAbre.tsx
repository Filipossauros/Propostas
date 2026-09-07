/**
 * O botão que abre e fecha uma linha de grupo.
 *
 * As três tabelas da direção abrem-se da mesma maneira — clicar no nome mostra
 * o que está por baixo — e por isso o botão é um só. Fechadas por omissão: a
 * vista abre-se para comparar unidades, e com tudo aberto de início a
 * comparação ficava soterrada no detalhe.
 */
export function BotaoQueAbre({
  aberto,
  texto,
  meta,
  onAlternar,
}: {
  aberto: boolean;
  texto: string;
  meta?: string;
  onAlternar: () => void;
}) {
  return (
    <button type="button" className="abre" aria-expanded={aberto} onClick={onAlternar}>
      <span className="seta" aria-hidden="true">
        ▶
      </span>
      <span>
        {texto}
        {meta !== undefined && <span className="meta"> {meta}</span>}
      </span>
    </button>
  );
}
