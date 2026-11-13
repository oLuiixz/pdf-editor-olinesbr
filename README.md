# Forma PDF

Editor de PDF com identidade visual híbrida (workspace escuro + páginas claras), nível Complete e OCR desativado.

## Stack
- Next.js + React + TypeScript
- PDF.js para renderização, extração de blocos e metadados tipográficos
- pdf-lib para reconstrução visual e exportação
- Tailwind CSS + Lucide

## Desenvolvimento
```bash
npm install
npm run dev
```

## Funcionalidades disponíveis
- Importação local de PDFs, sem envio do arquivo para servidor
- Renderização e navegação entre páginas
- Seleção de blocos de texto extraídos da camada textual
- Edição de textos e valores existentes
- Inclusão e remoção de textos
- Estimativa de família tipográfica, tamanho e cor do texto
- Amostragem da cor de fundo próxima ao bloco para reconstrução visual
- Exportação de alterações em todas as páginas
- Ajuste de zoom e painel de propriedades

## Como a edição funciona nesta versão
PDFs não são documentos de texto convencionais. O Forma usa PDF.js para localizar e medir blocos de texto e PDF-Lib para aplicar a alteração na exportação. Para um trecho alterado, o editor cobre a região original com uma cor de fundo estimada a partir da renderização e desenha o novo conteúdo com uma fonte padrão aproximada. A família tipográfica é inferida e mapeada para fontes padrão (Helvetica, Times ou Courier), e a cor do texto é estimada pelos pixels renderizados.

Isso melhora a aparência em documentos simples e financeiros, mas **não é uma substituição nativa e universal dos operadores de texto do PDF**. Fontes incorporadas, texto rotacionado, fundos com textura, transparências, gradientes, tabelas complexas e blocos sobrepostos podem exigir ajustes manuais ou não ser reconstruídos perfeitamente. O texto mais longo é reduzido para caber na largura original estimada.

OCR está desativado conforme definido no escopo. PDFs digitalizados sem camada textual não oferecem blocos selecionáveis.

## Próximas evoluções
- Reconstrução avançada de fontes incorporadas e operadores de texto
- Ferramentas de movimentação e redimensionamento
- Gerenciamento de páginas
- Inserção, substituição e remoção de imagens
- Histórico de desfazer/refazer
- Suíte de testes com PDFs reais variados
