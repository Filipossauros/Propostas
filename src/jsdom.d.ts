// Só os testes usam o jsdom diretamente, e só pelo DOMParser: o pacote não traz
// tipos, e os de @types/jsdom seriam uma dependência para uma linha.
declare module "jsdom";
