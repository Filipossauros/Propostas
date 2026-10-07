// O que as informações da SPMS partilham, para lá do gerador de cada uma.
//
// A informação que a aplicação produz é a manifestação de necessidades, no
// modelo da DAG — ver `manifestacaoNecessidades.ts`, que substituiu o pedido de
// encargos plurianuais e a manifestação anterior. Ficam aqui as peças comuns:
// a data por extenso, o quadro das rates de referência e o arranjo da linha do
// rodapé dos modelos.

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataPorExtenso(quando: Date): string {
  return `${quando.getDate()} de ${MESES[quando.getMonth()]} de ${quando.getFullYear()}`;
}

/**
 * As rates dos concursos anteriores que fundamentam os valores hora usados.
 *
 * É um quadro de referência da organização, e não algo que a aplicação apure:
 * vem dos procedimentos já realizados, e atualiza-se aqui quando houver mais.
 */
export const RATES_DE_REFERENCIA: Array<{
  perfil: string;
  procedimentos: string[];
  propostas: string;
  base: string;
  maisAlta: string;
  media: string;
  diferenca: string;
}> = [
  {
    perfil: "Analista Funcional",
    procedimentos: ["20260065", "20260066", "20260080"],
    propostas: "28",
    base: "54,10 €/h",
    maisAlta: "46,50 €/h",
    media: "26,22 €/h",
    diferenca: "52%",
  },
  {
    perfil: "Arquiteto de Sistemas",
    procedimentos: ["20260080"],
    propostas: "4",
    base: "59,51 €/h",
    maisAlta: "52,00 €/h",
    media: "47,31 €/h",
    diferenca: "20%",
  },
  {
    perfil: "Backend — Java data access",
    procedimentos: ["20260065"],
    propostas: "6",
    base: "54,10 €/h",
    maisAlta: "46,50 €/h",
    media: "29,29 €/h",
    diferenca: "46%",
  },
  {
    perfil: "Backend — System Integration",
    procedimentos: ["20260080"],
    propostas: "4",
    base: "54,10 €/h",
    maisAlta: "38,13 €/h",
    media: "27,30 €/h",
    diferenca: "50%",
  },
  {
    perfil: "Consultor de Administração de Sistemas e Observabilidade",
    procedimentos: ["20260081"],
    propostas: "1",
    base: "54,10 €/h",
    maisAlta: "28,12 €/h",
    media: "28,12 €/h",
    diferenca: "48%",
  },
  {
    perfil: "Frontend",
    procedimentos: ["20260081"],
    propostas: "7",
    base: "54,10 €/h",
    maisAlta: "46,50 €/h",
    media: "27,50 €/h",
    diferenca: "49%",
  },
  {
    perfil: "Tester",
    procedimentos: ["20260065", "20260066", "20260080", "20260081"],
    propostas: "23",
    base: "27,05 €/h",
    maisAlta: "27,05 €/h",
    media: "22,60 €/h",
    diferenca: "16%",
  },
  {
    perfil: "UX-UI Designer",
    procedimentos: ["20260066"],
    propostas: "13",
    base: "54,10 €/h",
    maisAlta: "37,25 €/h",
    media: "27,64 €/h",
    diferenca: "49%",
  },
  {
    perfil: "Gestor de Projeto",
    procedimentos: ["20230160"],
    propostas: "6",
    base: "40,50 €/h",
    maisAlta: "39,70 €/h",
    media: "34,13 €/h",
    diferenca: "16%",
  },
  {
    perfil: "Developer de Integração",
    procedimentos: ["20230160"],
    propostas: "4",
    base: "35,14 €/h",
    maisAlta: "34,90 €/h",
    media: "30,08 €/h",
    diferenca: "14%",
  },
  {
    perfil: "Suporte IOP",
    procedimentos: ["20230160"],
    propostas: "8",
    base: "35,14 €/h",
    maisAlta: "34,90 €/h",
    media: "30,95 €/h",
    diferenca: "12%",
  },
];

/**
 * A linha de separação do rodapé, desenhada como borda e não como texto.
 *
 * No modelo é uma fila de sublinhados: com o tipo de letra do rodapé ocupa
 * mais do que a largura da página e parte-se em duas, a segunda a meio. Uma
 * borda inferior do parágrafo tem sempre a largura do texto, seja qual for o
 * tipo de letra — é uma linha só, de margem a margem. Fica no mesmo parágrafo,
 * com a mesma cor, para o resto do rodapé não mudar de sítio.
 */
export function rodapeComLinhaUnica(rodape: string): string {
  return rodape.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t>_{10,}<\/w:t>[\s\S]*?<\/w:p>/, (paragrafo) =>
    paragrafo
      .replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:t>_+<\/w:t><\/w:r>/g, "")
      .replace(
        /(<w:pStyle [^>]*\/>)/,
        '$1<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="A6A6A6"/></w:pBdr>',
      ),
  );
}
