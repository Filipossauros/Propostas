import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Caminhos relativos: a aplicação é 100% estática e distribuível como
  // ficheiros (princípio 1) — funciona tanto na raiz de um domínio como
  // num subcaminho (ex.: GitHub Pages) ou aberta localmente a partir do disco.
  base: './',
  plugins: [react()],
})
