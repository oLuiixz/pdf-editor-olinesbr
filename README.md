# Forma PDF

Editor de PDF com identidade visual híbrida (workspace escuro + páginas claras), nível Complete e OCR desativado.

## Stack
- Next.js + React + TypeScript
- PDF.js para renderização e extração de blocos de texto
- pdf-lib para exportação e manipulação de páginas
- Tailwind CSS + Lucide

## Desenvolvimento
```bash
npm install
npm run dev
```

## Escopo inicial
- Importação local de PDFs
- Renderização paginada e seleção de blocos de texto extraídos
- Edição visual de texto e valores
- Inclusão de texto livre
- Exportação do PDF com as alterações aplicadas
- Zoom, navegação e painel de propriedades

## Limitação técnica importante
PDFs não funcionam como documentos de texto convencionais. PDF.js consegue renderizar e localizar blocos de texto, mas a edição universal do conteúdo original depende da estrutura interna, das fontes incorporadas e dos operadores do PDF. Nesta primeira base, alterações de texto são aplicadas visualmente sobre a área original durante a exportação; não prometemos reescrever os operadores/fontes originais em todos os PDFs. PDFs digitalizados não terão reconhecimento automático porque OCR foi explicitamente desativado.

O próximo ciclo deve evoluir a reconstrução tipográfica, edição de imagens/formulários, operações de página e testes com PDFs financeiros reais.
