// Horas úteis de um ano civil em Portugal.
//
// Serve para pré-preencher as horas de um perfil sem ninguém ter de ir contar
// dias a um calendário. O cálculo é: dias de semana do ano, menos os feriados
// nacionais que calhem em dia útil, menos os dias de férias, vezes as horas de
// trabalho por dia.
//
// Os feriados municipais ficam de fora — dependem do concelho onde o serviço é
// prestado, e a aplicação não o sabe. O Carnaval também: é tolerância de ponto,
// concedida ano a ano, e não feriado obrigatório. Quem os quiser descontar
// corrige as horas à mão, que é o que o campo continua a permitir.

/** Um dia de trabalho, em horas. */
export const HORAS_POR_DIA = 8;

/** Dias úteis de descanso obrigatório por ano. */
export const DIAS_DE_FERIAS = 22;

/**
 * Domingo de Páscoa, pelo algoritmo gregoriano anónimo (Meeus/Jones/Butcher).
 *
 * É daqui que saem os dois feriados móveis: a Sexta-feira Santa, dois dias
 * antes, e o Corpo de Deus, sessenta dias depois.
 */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function maisDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000);
}

/**
 * Os feriados obrigatórios de âmbito nacional, nos termos do artigo 234.º do
 * Código do Trabalho.
 */
export function feriadosNacionais(ano: number): Date[] {
  const pascoa = domingoDePascoa(ano);
  const fixo = (mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));

  return [
    fixo(1, 1), // Ano Novo
    maisDias(pascoa, -2), // Sexta-feira Santa
    pascoa, // Domingo de Páscoa
    fixo(4, 25), // Dia da Liberdade
    fixo(5, 1), // Dia do Trabalhador
    maisDias(pascoa, 60), // Corpo de Deus
    fixo(6, 10), // Dia de Portugal
    fixo(8, 15), // Assunção de Nossa Senhora
    fixo(10, 5), // Implantação da República
    fixo(11, 1), // Todos os Santos
    fixo(12, 1), // Restauração da Independência
    fixo(12, 8), // Imaculada Conceição
    fixo(12, 25), // Natal
  ];
}

function ehDiaDeSemana(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia !== 0 && dia !== 6;
}

/** Os feriados nacionais que caem em dia de semana — os únicos que tiram trabalho. */
export function feriadosEmDiaUtil(ano: number): Date[] {
  return feriadosNacionais(ano).filter(ehDiaDeSemana);
}

/** Dias de semana do ano civil, feriados incluídos. */
export function diasDeSemana(ano: number): number {
  let dias = 0;
  const data = new Date(Date.UTC(ano, 0, 1));
  while (data.getUTCFullYear() === ano) {
    if (ehDiaDeSemana(data)) dias++;
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return dias;
}

/** As parcelas do cálculo, para o ecrã as poder mostrar em vez de as esconder. */
export interface HorasUteisDoAno {
  ano: number;
  diasDeSemana: number;
  feriados: number;
  /** Dias de semana menos feriados: o que o ano tem de trabalho. */
  diasUteis: number;
  ferias: number;
  /** Dias úteis menos férias. */
  diasTrabalhados: number;
  horasPorDia: number;
  horas: number;
}

export function horasUteisDoAno(ano: number): HorasUteisDoAno {
  const semana = diasDeSemana(ano);
  const feriados = feriadosEmDiaUtil(ano).length;
  const uteis = semana - feriados;
  const trabalhados = uteis - DIAS_DE_FERIAS;

  return {
    ano,
    diasDeSemana: semana,
    feriados,
    diasUteis: uteis,
    ferias: DIAS_DE_FERIAS,
    diasTrabalhados: trabalhados,
    horasPorDia: HORAS_POR_DIA,
    horas: trabalhados * HORAS_POR_DIA,
  };
}

/** Só as horas, que é o que vai para o campo. */
export function horasUteis(ano: number): number {
  return horasUteisDoAno(ano).horas;
}
