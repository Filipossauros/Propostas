import { useId } from "react";

/**
 * Porque é que a repartição de horas existe, e o que significa um ano a zero.
 *
 * Não é evidente à primeira: quem olha para os três anos presume que o contrato
 * corre nos três, para todos os perfis. A hipótese de um perfil entrar só a
 * meio — porque até lá está coberto por um contrato em vigor — é precisamente o
 * que esta repartição serve, e é preciso dizê-lo.
 */
export function DicaRepartirHoras() {
  const id = useId();

  return (
    <span className="dica">
      <button type="button" className="dica-alvo dica-ajuda" aria-describedby={id} aria-label="Como repartir as horas">
        ?
      </button>

      <span role="tooltip" id={id} className="dica-conteudo dica-lista">
        <strong>Como funciona a repartição</strong>
        <ul>
          <li>As horas de cada perfil escrevem-se no lote, ano a ano, em vez de num total.</li>
          <li>O total do perfil é a soma dos três anos, e é dele que sai o preço base.</li>
          <li>
            Um ano a zero significa que o perfil não é contratado nesse ano — é o que permite acomodar um contrato
            ainda em vigor.
          </li>
          <li>
            Exemplo: com um contrato a decorrer durante o primeiro ano, esse perfil leva 0 horas nesse ano e as suas
            horas repartem-se pelos dois seguintes, enquanto os restantes perfis vigoram nos três.
          </li>
          <li>
            O contrato só pode iniciar-se no ano corrente ou no seguinte: não se pede hoje autorização para uma
            despesa que só começa mais tarde.
          </li>
        </ul>
      </span>
    </span>
  );
}
