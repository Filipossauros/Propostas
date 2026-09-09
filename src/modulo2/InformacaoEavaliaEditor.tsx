import type { InformacaoEavalia } from "../core/types";

interface Props {
  eavalia: InformacaoEavalia;
  onChange: (eavalia: InformacaoEavalia) => void;
}

/**
 * Uma medida do formulário, com as respostas que lhe cabem.
 *
 * As opções de cada medida saem do próprio campo: a da usabilidade responde-se
 * na escala dos selos, e o tipo não deixa oferecer aqui uma resposta que o
 * ficheiro não aceite.
 */
type Medida = {
  [C in keyof InformacaoEavalia]: {
    campo: C;
    pergunta: string;
    opcoes: Array<Exclude<InformacaoEavalia[C], "">>;
  };
}[keyof InformacaoEavalia];

/**
 * As opções são as das listas de validação do formulário eAvalia, escritas tal
 * e qual — incluindo o "Já cumpre" com minúscula. Cada medida oferece só as que
 * lhe fazem sentido.
 *
 * A ordem é a das linhas do formulário, para quem confere o ficheiro gerado
 * poder descer as duas listas lado a lado.
 */
const MEDIDAS: Medida[] = [
  {
    campo: "iap",
    pergunta: "Utilização da plataforma de interoperabilidade da ARTE (iAP)",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "sms",
    pergunta: "O sistema envia SMS através da plataforma da ARTE",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "faturacao",
    pergunta: "O sistema emite faturação através da plataforma da ARTE",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "chaveMovelDigital",
    pergunta:
      "Utilização de chave móvel digital como único método de autenticação para portais (websites) " +
      "disponibilizados ao público.",
    opcoes: ["Já cumpre", "Não aplicável"],
  },
  {
    campo: "usabilidade",
    pergunta:
      "Conformidade com as melhores práticas de usabilidade e acessibilidade, a nível equivalente ou " +
      "superior ao selo de prata.",
    // A escala do selo é a que o ficheiro traz para esta medida, e não a do
    // cumprimento: aqui responde-se com o selo que se tem.
    opcoes: ["Não aplicável", "Declaração", "Selo Ouro", "Selo Prata", "Selo Bronze"],
  },
  {
    campo: "idiomas",
    pergunta: "Disponibilização do portal (website) pelo menos nos idiomas português e inglês.",
    opcoes: ["Cumpre Parcialmente", "Já cumpre", "Não aplicável"],
  },
];

/**
 * Muda uma resposta só.
 *
 * O campo vem de uma união e o valor de um `select`, pelo que a ligação entre
 * os dois — que a lista de opções já garante — tem de ser afirmada aqui.
 */
function comResposta(eavalia: InformacaoEavalia, campo: keyof InformacaoEavalia, valor: string): InformacaoEavalia {
  return { ...eavalia, [campo]: valor } as InformacaoEavalia;
}

export function InformacaoEavaliaEditor({ eavalia, onChange }: Props) {
  const porResponder = MEDIDAS.filter((m) => eavalia[m.campo] === "").length;

  return (
    <>
      <div className="grelha-eavalia">
        {MEDIDAS.map((medida) => (
          <label key={medida.campo}>
            <span className="rotulo">{medida.pergunta}</span>
            <select
              value={eavalia[medida.campo]}
              aria-invalid={eavalia[medida.campo] === ""}
              onChange={(e) => onChange(comResposta(eavalia, medida.campo, e.target.value))}
            >
              <option value="">— por responder —</option>
              {medida.opcoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {porResponder > 0 && (
        <p className="aviso aviso-erro">
          {porResponder === 1 ? "Falta responder a uma medida." : `Faltam responder a ${porResponder} medidas.`} As
          {" "}
          {MEDIDAS.length} são de preenchimento obrigatório.
        </p>
      )}

      <p className="ajuda">
        Preenchem as medidas correspondentes na folha «Alinhamento Tecnológico» do pedido de parecer prévio. A da
        usabilidade e acessibilidade responde-se na escala dos selos, que é a que o formulário traz para essa linha.
        Duas outras medidas seguem com resposta fixa, que não se decide procedimento a procedimento: o ponto de troca
        de tráfego (PTT) vai como «Já cumpre», e o Quadro Nacional de Referência para a Cibersegurança como «Não
        aplicável».
      </p>
    </>
  );
}
