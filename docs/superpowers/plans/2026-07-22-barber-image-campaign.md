# Barber OS Image Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, validar e disponibilizar 20 imagens coesas no estilo Grafite editorial para a demonstração da AS Barber Club.

**Architecture:** A produção começa por quatro retratos-base que fixam as identidades fictícias. Esses arquivos alimentam as gerações de equipe e atendimento como referências visuais; produtos e ambientes usam o mesmo vocabulário material, iluminação e gradação. Os resultados são salvos de forma não destrutiva em `public/images/` e registrados em um manifesto para integração previsível.

**Tech Stack:** geração nativa de imagens do Codex, PNG, inspeção visual local, Next.js `public/` assets.

---

### Task 1: Retratos-base dos profissionais

**Files:**
- Create: `public/images/staff-lucas-moreira.png`
- Create: `public/images/staff-diego-santos.png`
- Create: `public/images/staff-marco-almeida.png`
- Create: `public/images/staff-andre-costa.png`

- [ ] **Step 1: Gerar Lucas Moreira**

Gerar retrato 4:5, meio corpo, do personagem definido na especificação, usando fundo de concreto e salão desfocado, roupas pretas sem marca, luz lateral suave e gradação Grafite editorial.

- [ ] **Step 2: Gerar Diego Santos**

Repetir direção, câmera, fundo, luz e tratamento, alterando somente a identidade para Diego.

- [ ] **Step 3: Gerar Marco Almeida**

Repetir direção, câmera, fundo, luz e tratamento, alterando somente a identidade para Marco.

- [ ] **Step 4: Gerar André Costa**

Repetir direção, câmera, fundo, luz e tratamento, alterando somente a identidade para André.

- [ ] **Step 5: Validar os retratos**

Inspecionar rosto, mãos, cabelo, textura de pele, roupa, fundo e ausência de textos, marcas e watermark. Confirmar que os quatro personagens são claramente distintos.

### Task 2: Campanha de equipe e serviços

**Files:**
- Create: `public/images/barber-hero-v2.png`
- Create: `public/images/barber-detail-v2.png`
- Create: `public/images/barber-team-v2.png`
- Create: `public/images/work-haircut-texture.png`
- Create: `public/images/work-beard-finish.png`
- Create: `public/images/work-razor-chair.png`
- Create: `public/images/work-wash-hair.png`

- [ ] **Step 1: Gerar hero com Lucas**

Usar o retrato de Lucas como referência de identidade. Compor a ação no lado direito, preservar espaço negativo à esquerda e evitar texto embutido.

- [ ] **Step 2: Gerar detalhe de barba**

Criar macro 4:3 de acabamento com navalha, luvas pretas e textura anatômica correta.

- [ ] **Step 3: Gerar equipe consistente**

Usar os quatro retratos como referências. Preservar traços faciais, cabelo e tom de pele de cada personagem em um retrato coletivo 3:2.

- [ ] **Step 4: Gerar os quatro serviços**

Usar Diego no corte texturizado, Marco na barba, Lucas na navalha e André na lavagem. Manter o mesmo salão, figurino, contraste e temperatura de cor.

- [ ] **Step 5: Validar campanha**

Inspecionar continuidade de identidade, anatomia das mãos, ferramentas, interação física, cortes responsivos e ausência de artefatos.

### Task 3: Produtos e vitrine

**Files:**
- Create: `public/images/product-pomade-matte-club.png`
- Create: `public/images/product-beard-oil-n7.png`
- Create: `public/images/product-shampoo-daily-clean.png`
- Create: `public/images/product-comb-carbon-pro.png`
- Create: `public/images/products-shelf.png`

- [ ] **Step 1: Gerar quatro fotos individuais de produto**

Criar imagens 1:1 de catálogo sobre concreto e aço escovado, com embalagem genérica sem rótulo legível, reflexos controlados e sombras suaves.

- [ ] **Step 2: Gerar vitrine conjunta**

Usar os quatro produtos como referência visual e posicioná-los em prateleira minimalista do mesmo salão, em composição 3:2.

- [ ] **Step 3: Validar produtos**

Confirmar geometria, materiais, silhuetas, consistência entre foto individual e vitrine, e ausência de marcas ou texto acidental.

### Task 4: Ambientes e experiência

**Files:**
- Create: `public/images/booking-experience.png`
- Create: `public/images/shop-interior-wide.png`
- Create: `public/images/reception-counter.png`
- Create: `public/images/client-before-after-neutral.png`

- [ ] **Step 1: Gerar experiência de agendamento**

Criar cena 3:2 com cliente usando smartphone; a tela deve estar desfocada e sem conteúdo legível.

- [ ] **Step 2: Gerar interior amplo**

Criar plano 16:9 do salão vazio com quatro estações, concreto, aço, couro preto e luz natural lateral.

- [ ] **Step 3: Gerar recepção**

Criar plano 3:2 do balcão minimalista, sem sinalização, logotipos ou textos.

- [ ] **Step 4: Gerar antes/depois**

Criar díptico 2:1 do mesmo cliente, mesma câmera, luz, roupa, posição e expressão; alterar somente cabelo e barba.

- [ ] **Step 5: Validar ambientes e experiência**

Confirmar perspectiva arquitetônica, número de estações, tela sem texto, consistência do cliente no díptico e unidade visual.

### Task 5: Manifesto, integração e verificação final

**Files:**
- Create: `public/images/barber-image-manifest.json`
- Modify: `src/app/(public)/barbearia/[slug]/page.tsx`
- Modify: `prisma/seed.ts`
- Modify: `src/components/booking/booking-wizard.tsx`

- [ ] **Step 1: Registrar os 20 assets**

Criar manifesto JSON com `filename`, `role`, `aspectRatio` e `alt` para cada imagem.

- [ ] **Step 2: Conectar os assets principais**

Trocar as três referências públicas para os arquivos `-v2`, mantendo as imagens antigas como fallback versionado.

- [ ] **Step 3: Conectar retratos e produtos aos dados demonstrativos**

Adicionar os caminhos públicos `imageUrl` aos quatro profissionais e quatro produtos no seed, sem alterar identificadores ou regras de negócio.

- [ ] **Step 4: Renderizar retratos no agendamento**

Usar `AvatarImage` quando `member.imageUrl` existir e preservar `AvatarFallback` com as iniciais.

- [ ] **Step 5: Verificar arquivos e aplicação**

Executar:

```bash
find public/images -maxdepth 1 -type f -print | sort
npm run lint
npm run typecheck
npm test
npm run build
```

Resultado esperado: os 20 novos assets aparecem na listagem e todos os comandos encerram com código 0.
