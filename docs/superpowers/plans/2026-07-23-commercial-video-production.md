# Comercial Barber OS — Plano de Produção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir o comercial de ~53 segundos "Do caos ao controle" para o Barber OS usando Higgsfield AI para cenas live-action e motion graphics para a parte de produto.

**Architecture:** 6 cenas AI-generated via Higgsfield (personagem consistente) + narração em off gerada via Higgsfield audio + motion graphics para Ato 5 e encerramento. Assets salvos em `artifacts/commercial/`.

**Tech Stack:** Higgsfield AI (imagem, vídeo, áudio), motion graphics (Gamma ou exportação manual), edição final externa (CapCut / DaVinci Resolve).

---

## Estrutura de Arquivos

```
artifacts/commercial/
├── character/
│   └── reference.png          ← imagem de referência do personagem
├── scenes/
│   ├── 01-despertar.mp4       ← Ato 1A (~8s)
│   ├── 02-barbearia-caos.mp4  ← Ato 1B (~10s)
│   ├── 03-limite.mp4          ← Ato 2 (~3s)
│   ├── 04-campo.mp4           ← Ato 3 (~7s)
│   ├── 05-barbearia-paz.mp4   ← Ato 4 (~10s)
│   └── 06-encerramento.mp4    ← Ato 5 + Logo (~15s)
├── audio/
│   └── narracao.mp3           ← narração em off completa
└── final/
    └── comercial-barber-os.mp4 ← vídeo montado (editor externo)
```

---

## Descrição do Personagem (usar em TODAS as cenas)

> Brazilian male barbershop owner, 38-42 years old, Latino features, athletic build, short trimmed beard, wearing a black barber apron over a white t-shirt, professional and authentic look

Essa descrição deve ser usada como base em todos os prompts de geração para manter consistência visual.

---

## Task 1: Preparar Estrutura de Pastas

**Files:**
- Create: `artifacts/commercial/character/`
- Create: `artifacts/commercial/scenes/`
- Create: `artifacts/commercial/audio/`
- Create: `artifacts/commercial/final/`

- [ ] **Step 1: Criar estrutura de diretórios**

```bash
mkdir -p artifacts/commercial/character
mkdir -p artifacts/commercial/scenes
mkdir -p artifacts/commercial/audio
mkdir -p artifacts/commercial/final
```

- [ ] **Step 2: Commit estrutura vazia**

```bash
touch artifacts/commercial/.gitkeep
git add artifacts/commercial/
git commit -m "chore: scaffold commercial video production structure"
```

---

## Task 2: Roteiro Completo da Narração

**Files:**
- Create: `artifacts/commercial/narracao.md`

O roteiro deve acompanhar a jornada emocional do personagem. Tom: voz masculina, calma mas tensa no início, aliviada no fim. Português brasileiro, linguagem simples e direta.

- [ ] **Step 1: Criar arquivo do roteiro**

Criar `artifacts/commercial/narracao.md` com o seguinte conteúdo:

```markdown
# Roteiro de Narração — Comercial Barber OS

**Voz:** Masculina, 35-45 anos, tom de quem fala por experiência própria.
**Ritmo:** Lento e pesado no Ato 1–2. Silêncio no Ato 3. Firme e confiante no Ato 4–5.

---

## Ato 1A — O Despertar (0s–8s)
> "Todo dia começa igual..."
> "Antes mesmo de levantar... o caos já começou."

## Ato 1B — Barbearia Caótica (8s–18s)
> "Quem pagou? Quem faltou? Quanto entrou hoje?"
> "Você trabalha o dia inteiro... mas nunca sabe onde está."

## Ato 2 — O Limite (18s–21s)
> [silêncio — pausa dramática, sem narração]

## Ato 3 — O Campo (21s–28s)
> "E se existisse uma forma de ter controle de verdade?"

## Ato 4 — A Solução (28s–38s)
> "Com o Barber OS, você vê tudo."
> "Agenda. Equipe. Caixa. Em tempo real."

## Ato 5 — Produto (38s–50s)
> "Agenda inteligente. Confirmação automática. Controle financeiro."
> "Gestão completa da sua barbearia — na palma da mão."

## Encerramento (50s–53s)
> "Barber OS."
> "Do caos ao controle."
```

- [ ] **Step 2: Commit roteiro**

```bash
git add artifacts/commercial/narracao.md
git commit -m "feat: add commercial narration script"
```

---

## Task 3: Gerar Personagem de Referência

**Files:**
- Create: `artifacts/commercial/character/reference.png`

Precisamos de uma imagem de referência do personagem para manter consistência visual em todas as cenas de vídeo.

- [ ] **Step 1: Explorar modelo de imagem adequado**

Usar `mcp__claude_ai_higgsfield__models_explore` com:
```
action: "recommend"
goal: "photorealistic portrait of a Brazilian male barbershop owner for use as character reference in a commercial video"
```

- [ ] **Step 2: Gerar imagem de referência**

Usar `mcp__claude_ai_higgsfield__generate_image` com o prompt:

```
Photorealistic portrait of a Brazilian male barbershop owner, 38-42 years old, 
Latino features, athletic build, short trimmed beard, wearing a black barber apron 
over a white t-shirt. Natural studio lighting. Confident expression. 
Cinematic quality. Commercial photography style.
```

- [ ] **Step 3: Salvar imagem**

Fazer download do resultado e salvar em `artifacts/commercial/character/reference.png`.

- [ ] **Step 4: Avaliar consistência**

Verificar se a imagem:
- Tem aparência realista e profissional
- É adequada para um público brasileiro
- Pode ser usada como referência de personagem (face clara, iluminação neutra)

Se não satisfatório, regenerar ajustando o prompt até obter uma referência sólida.

- [ ] **Step 5: Commit**

```bash
git add artifacts/commercial/character/reference.png
git commit -m "feat: add commercial character reference image"
```

---

## Task 4: Gerar Cena 01 — O Despertar (Ato 1A, ~8s)

**Files:**
- Create: `artifacts/commercial/scenes/01-despertar.mp4`

**Objetivo da cena:** Mostrar o barbeiro acordando e sendo bombardeado por notificações. Sensação de ansiedade imediata ao amanhecer.

- [ ] **Step 1: Verificar workflow de vídeo disponível**

Usar `mcp__claude_ai_higgsfield__get_workflow_instructions` sem argumento para ver catálogo. Verificar se existe workflow para "commercial" ou "cinematic narrative".

- [ ] **Step 2: Gerar vídeo da cena**

Usar `mcp__claude_ai_higgsfield__generate_video` com:

```
Prompt:
A Brazilian male barbershop owner (38-42, Latino features, short beard) 
waking up in bed in the early morning. His phone on the nightstand starts 
buzzing with notifications, screen lighting up repeatedly. He reaches for 
it, face showing exhaustion and stress. Camera slowly zooms into his face. 
Warm dim bedroom lighting. Cinematic, handheld camera feel. 
Documentary style. Realistic.

Duration: 8 seconds
Aspect ratio: 16:9
Style: cinematic, realistic, warm tones
```

- [ ] **Step 3: Revisar resultado**

Verificar:
- Personagem parece brasileiro/latino
- Expressão transmite cansaço e ansiedade
- Iluminação é quente e de amanhecer
- Movimento de câmera é cinematográfico

Se necessário ajustar prompt e regenerar.

- [ ] **Step 4: Salvar e commitar**

```bash
git add artifacts/commercial/scenes/01-despertar.mp4
git commit -m "feat: add commercial scene 01 - wake up"
```

---

## Task 5: Gerar Cena 02 — Barbearia Caótica (Ato 1B, ~10s)

**Files:**
- Create: `artifacts/commercial/scenes/02-barbearia-caos.mp4`

**Objetivo da cena:** Barbearia movimentada mas desorganizada. Dono no meio do caos — papéis, clientes, telefone, sem controle.

- [ ] **Step 1: Gerar vídeo da cena**

Usar `mcp__claude_ai_higgsfield__generate_video` com:

```
Prompt:
A busy barbershop interior, slightly chaotic. A Brazilian male barbershop 
owner (38-42, Latino, black apron) stands in the middle looking overwhelmed. 
Papers scattered on the counter. Clients waiting. Another barber looking 
confused. The owner checks his phone (WhatsApp messages flooding in), then 
looks at a messy paper appointment book. His expression shows confusion and 
pressure. Camera moves handheld, slightly chaotic movement. 
Warm but slightly harsh lighting. Realistic, cinematic.

Duration: 10 seconds
Aspect ratio: 16:9
Style: cinematic, documentary, realistic
```

- [ ] **Step 2: Revisar resultado**

Verificar:
- Ambiente de barbearia reconhecível
- Sensação de desordem e pressão é palpável
- Personagem parece o mesmo da cena anterior

- [ ] **Step 3: Salvar e commitar**

```bash
git add artifacts/commercial/scenes/02-barbearia-caos.mp4
git commit -m "feat: add commercial scene 02 - chaotic barbershop"
```

---

## Task 6: Gerar Cena 03 — O Limite (Ato 2, ~3s)

**Files:**
- Create: `artifacts/commercial/scenes/03-limite.mp4`

**Objetivo da cena:** Close no rosto do dono olhando diretamente para a câmera. Expressão de exaustão total. Precede o corte brusco.

- [ ] **Step 1: Gerar vídeo da cena**

Usar `mcp__claude_ai_higgsfield__generate_video` com:

```
Prompt:
Extreme close-up of a Brazilian male barbershop owner's face (38-42, 
Latino, short beard). He stares directly into the camera. His expression 
shows complete exhaustion, frustration, and emotional breaking point. 
Eyes slightly red from tiredness. Barbershop background blurred. 
Still camera, no movement. Dramatic lighting — side light, slight shadow. 
Cinematic. Slow motion feel.

Duration: 3 seconds
Aspect ratio: 16:9
Style: dramatic, cinematic, high contrast
```

- [ ] **Step 2: Revisar resultado**

Verificar:
- Close no rosto é impactante
- Olhar direto na câmera cria conexão emocional
- Expressão transmite limite e exaustão genuína

- [ ] **Step 3: Salvar e commitar**

```bash
git add artifacts/commercial/scenes/03-limite.mp4
git commit -m "feat: add commercial scene 03 - breaking point"
```

---

## Task 7: Gerar Cena 04 — O Campo / A Paz (Ato 3, ~7s)

**Files:**
- Create: `artifacts/commercial/scenes/04-campo.mp4`

**Objetivo da cena:** Transição onírica. O barbeiro caminha em campo verde aberto. Luz suave. Paz total. Representa o que ele deseja — não a realidade.

- [ ] **Step 1: Gerar vídeo da cena**

Usar `mcp__claude_ai_higgsfield__generate_video` com:

```
Prompt:
A Brazilian male barbershop owner (38-42, Latino, wearing a simple white 
t-shirt, no apron) walking peacefully through a vast open green field. 
Bright natural daylight, soft golden hour lighting. Wind gently moves 
the grass. Birds chirping ambiance. He walks slowly, relaxed, a small 
peaceful smile. Camera follows from behind and then circles to show 
his face — serene, calm, free. No phone. No noise. Dreamy, slightly 
cinematic look. Wide open sky.

Duration: 7 seconds
Aspect ratio: 16:9
Style: dreamy, cinematic, natural, bright greens and soft yellows
```

- [ ] **Step 2: Revisar resultado**

Verificar:
- Contraste visual com as cenas anteriores é evidente (campo vs barbearia)
- Tom onírico está presente (não hiper-realista)
- Personagem parece relaxado e em paz
- Sem aparência de barbearia ou elementos urbanos

- [ ] **Step 3: Salvar e commitar**

```bash
git add artifacts/commercial/scenes/04-campo.mp4
git commit -m "feat: add commercial scene 04 - peaceful field"
```

---

## Task 8: Gerar Cena 05 — Barbearia Organizada + UI (Ato 4, ~10s)

**Files:**
- Create: `artifacts/commercial/scenes/05-barbearia-paz.mp4`

**Objetivo da cena:** Mesma barbearia do Ato 1, mas agora organizada. O dono está calmo, usando tablet com o Barber OS aberto. Interface aparece na tela.

- [ ] **Step 1: Gerar vídeo da cena**

Usar `mcp__claude_ai_higgsfield__generate_video` com:

```
Prompt:
A neat, organized barbershop interior. A Brazilian male barbershop owner 
(38-42, Latino, black apron) stands calmly behind the counter, holding 
a tablet. He smiles slightly, looking at the screen confidently. 
The barbershop is clean, orderly, well-lit. Barbers work in the background 
with clients. The camera slowly pushes in toward the tablet screen 
(screen stays black — will be composited later). Warm, clean, professional 
lighting. Cinematic, steady camera. Confident mood.

Duration: 10 seconds
Aspect ratio: 16:9
Style: clean, warm, professional, cinematic
```

- [ ] **Step 2: Revisar resultado**

Verificar:
- Ambiente é reconhecivelmente a mesma barbearia mas organizada
- Personagem transmite confiança e calma
- Espaço na tela do tablet para composição de UI

- [ ] **Step 3: Salvar e commitar**

```bash
git add artifacts/commercial/scenes/05-barbearia-paz.mp4
git commit -m "feat: add commercial scene 05 - organized barbershop"
```

---

## Task 9: Gerar Narração em Off

**Files:**
- Create: `artifacts/commercial/audio/narracao.mp3`

- [ ] **Step 1: Listar vozes disponíveis**

Usar `mcp__claude_ai_higgsfield__list_voices` para ver vozes disponíveis. Selecionar uma voz masculina adulta, brasileira ou neutra em português.

- [ ] **Step 2: Gerar narração completa**

Usar `mcp__claude_ai_higgsfield__generate_audio` com o roteiro completo do arquivo `artifacts/commercial/narracao.md`.

Texto a gerar (em sequência, um por ato):

```
Ato 1A: "Todo dia começa igual... Antes mesmo de levantar... o caos já começou."

Ato 1B: "Quem pagou? Quem faltou? Quanto entrou hoje? Você trabalha o dia inteiro... mas nunca sabe onde está."

Ato 3: "E se existisse uma forma de ter controle de verdade?"

Ato 4: "Com o Barber OS, você vê tudo. Agenda. Equipe. Caixa. Em tempo real."

Ato 5: "Agenda inteligente. Confirmação automática. Controle financeiro. Gestão completa da sua barbearia — na palma da mão."

Encerramento: "Barber OS. Do caos ao controle."
```

- [ ] **Step 3: Revisar qualidade**

Verificar:
- Tom da voz é masculino, profissional, brasileiro
- Ritmo é adequado para cada ato (pesado no início, aliviado no fim)
- Qualidade de áudio é alta (sem ruídos)

- [ ] **Step 4: Salvar e commitar**

```bash
git add artifacts/commercial/audio/narracao.mp3
git commit -m "feat: add commercial voiceover audio"
```

---

## Task 10: Criar Ato 5 + Encerramento (Motion Graphics)

**Files:**
- Create: `artifacts/commercial/scenes/06-encerramento.mp4`

Este é o único ato que não usa cena live-action. É inteiramente motion graphics com a UI do Barber OS, funcionalidades destacadas e encerramento com logo.

- [ ] **Step 1: Verificar se Gamma pode gerar vídeo exportável**

Usar `mcp__claude_ai_Gamma__export_gamma` se já existir um Gamma com a apresentação do produto. Caso contrário, o Ato 5 será produzido em ferramenta externa (CapCut, After Effects, DaVinci Resolve).

- [ ] **Step 2: Definir sequência de textos do Ato 5**

Sequência de cards animados (~2s cada):

```
Card 1: "Agenda inteligente"
         + ícone de calendário + tela do Barber OS

Card 2: "Confirmação automática"
         + ícone de check + notificação animada

Card 3: "Controle financeiro"
         + ícone de gráfico + números subindo

Card 4: "Fidelização de clientes"
         + ícone de estrela + pontos de loyalty

Card 5: "Relatórios em tempo real"
         + dashboard animado

Card 6: [tela limpa] BARBER OS
         "Do caos ao controle."
```

- [ ] **Step 3: Exportar screenshots reais da UI**

Rodar o Barber OS localmente:
```bash
npm run dev
```
Acessar `http://localhost:3000` e tirar screenshots de:
- Dashboard principal
- Tela de agenda
- Tela de clientes
- Tela de financeiro

Salvar em `artifacts/commercial/ui-screenshots/`.

- [ ] **Step 4: Montar sequência em editor externo**

Usar CapCut, After Effects ou DaVinci Resolve para:
1. Animar cada card com fade in/out (0.3s)
2. Inserir screenshots reais da UI como fundo
3. Adicionar texto em tipografia moderna (sans-serif bold, branca sobre fundo escuro)
4. Exportar como `artifacts/commercial/scenes/06-encerramento.mp4` (15s, H.264, 1080p)

- [ ] **Step 5: Commit**

```bash
git add artifacts/commercial/scenes/06-encerramento.mp4
git commit -m "feat: add commercial scene 06 - product showcase and closing"
```

---

## Task 11: Checklist Final de Revisão

Antes de montar o vídeo final, revisar todos os assets:

- [ ] **Step 1: Verificar todos os arquivos existem**

```bash
ls -la artifacts/commercial/scenes/
ls -la artifacts/commercial/audio/
```

Confirmar que existem:
- `01-despertar.mp4` (~8s)
- `02-barbearia-caos.mp4` (~10s)
- `03-limite.mp4` (~3s)
- `04-campo.mp4` (~7s)
- `05-barbearia-paz.mp4` (~10s)
- `06-encerramento.mp4` (~15s)
- `narracao.mp3`

- [ ] **Step 2: Verificar consistência do personagem**

Assistir cenas 01 a 05 e confirmar:
- Mesmo ator/aparência nas cenas 01, 02, 03, 05
- Progressão emocional está clara: cansado → no limite → em paz → confiante
- Transição do campo (cena 04) está visualmente distinta

- [ ] **Step 3: Instruções para montagem final**

Ordem de edição no software externo:
```
[01-despertar.mp4] → [02-barbearia-caos.mp4] → [03-limite.mp4]
→ [CORTE BRUSCO + SILÊNCIO] → [04-campo.mp4] → [05-barbearia-paz.mp4]
→ [06-encerramento.mp4]
```

Áudio:
- Trilha musical: tensa (Ato 1–2) → fade out (Ato 2 corte) → calma (Ato 3) → confiante (Ato 4–5)
- Narração em off: sobrepor `narracao.mp3` nos momentos definidos no roteiro
- Notificações sonoras em Ato 1A: efeito de som de WhatsApp em cascata

Formato de entrega:
- Resolução: 1920×1080 (16:9)
- Codec: H.264
- Taxa de bits: 8 Mbps
- Formato: MP4

- [ ] **Step 4: Commit final**

```bash
git add artifacts/
git commit -m "feat: complete commercial video production assets"
```

---

## Referências

- Spec: `docs/superpowers/specs/2026-07-23-commercial-video-design.md`
- Roteiro: `artifacts/commercial/narracao.md`
- Personagem: `artifacts/commercial/character/reference.png`
