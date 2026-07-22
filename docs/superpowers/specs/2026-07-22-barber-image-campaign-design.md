# Barber OS — campanha fotográfica Grafite Editorial

## Objetivo

Criar um pacote coeso de 20 imagens para tornar a demonstração pública da AS Barber Club visualmente completa, comercial e convincente. O conjunto deve parecer produzido na mesma barbearia, no mesmo dia e com os mesmos quatro profissionais fictícios.

## Direção aprovada

- Tratamento: Grafite editorial, quase monocromático, com tons frios discretos e pele natural.
- Ambiente: barbearia contemporânea minimalista, concreto cinza, aço escovado, espelhos amplos e couro preto.
- Figurino: roupas pretas minimalistas, sem marcas, uniformes ou textos.
- Luz: lateral suave, contraste controlado, sombras profundas com detalhes preservados.
- Fotografia: hiper-realista, textura real de pele, cabelo, tecido e materiais; acabamento de campanha premium sem aparência artificial.
- Paleta: carvão `#111315`, grafite `#292D30`, aço `#747B80`, névoa `#D8DADD` e branco `#F4F5F5`.
- Restrições globais: nenhum texto, logotipo, marca, watermark, anatomia deformada, pele plástica, excesso de HDR ou estética genérica de banco de imagens.

## Elenco consistente

Os mesmos quatro profissionais devem aparecer nos retratos individuais, na foto de equipe e em cenas de atendimento:

1. Lucas Moreira — brasileiro, 31 anos, pele morena clara, cabelo preto ondulado médio, barba curta alinhada, expressão calma; especialista em cortes clássicos.
2. Diego Santos — brasileiro negro, 29 anos, cabelo crespo baixo com degradê, barba curta desenhada, postura segura; especialista em fade e textura.
3. Marco Almeida — brasileiro descendente de asiáticos, 34 anos, cabelo preto penteado para trás, bigode e cavanhaque discretos, antebraços tatuados; especialista em barba.
4. André Costa — brasileiro, 27 anos, pele clara, cabelo cacheado curto, barba média bem cuidada, pequena argola prateada; especialista em estilo contemporâneo.

## Pacote de imagens

| # | Arquivo | Uso | Proporção | Conteúdo |
|---|---|---|---|---|
| 1 | `barber-hero-v2.png` | Hero público | 16:10 | Lucas atendendo um cliente em perfil, ação com pente e tesoura, personagens no lado direito e espaço negativo à esquerda. |
| 2 | `barber-detail-v2.png` | Destaque de serviço | 4:3 | Macro de acabamento de barba com navalha, luvas pretas e textura natural de pele e pelos. |
| 3 | `barber-team-v2.png` | Equipe | 3:2 | Os quatro profissionais no salão, composição editorial confiante, poses naturais e identidades preservadas. |
| 4 | `staff-lucas-moreira.png` | Perfil/agendamento | 4:5 | Retrato de Lucas, meio corpo, fundo do salão desfocado. |
| 5 | `staff-diego-santos.png` | Perfil/agendamento | 4:5 | Retrato de Diego, meio corpo, fundo do salão desfocado. |
| 6 | `staff-marco-almeida.png` | Perfil/agendamento | 4:5 | Retrato de Marco, meio corpo, fundo do salão desfocado. |
| 7 | `staff-andre-costa.png` | Perfil/agendamento | 4:5 | Retrato de André, meio corpo, fundo do salão desfocado. |
| 8 | `work-haircut-texture.png` | Galeria/serviços | 4:3 | Diego finalizando textura e fade com pente e tesoura. |
| 9 | `work-beard-finish.png` | Galeria/serviços | 4:3 | Marco alinhando a barba com trimmer, enquadramento lateral. |
| 10 | `work-razor-chair.png` | Galeria/serviços | 4:3 | Cliente reclinado recebendo acabamento com navalha e toalha quente. |
| 11 | `work-wash-hair.png` | Galeria/serviços | 4:3 | Lavagem capilar em cuba preta, mãos naturais e água controlada. |
| 12 | `product-pomade-matte-club.png` | Produtos | 1:1 | Pote genérico de pomada matte preto, fotografia de catálogo sem rótulo legível. |
| 13 | `product-beard-oil-n7.png` | Produtos | 1:1 | Frasco âmbar de óleo para barba com conta-gotas preto, sem marca. |
| 14 | `product-shampoo-daily-clean.png` | Produtos | 1:1 | Frasco cilíndrico preto de shampoo, acabamento fosco, sem marca. |
| 15 | `product-comb-carbon-pro.png` | Produtos | 1:1 | Pente profissional de carbono sobre base de aço escovado. |
| 16 | `products-shelf.png` | Vitrine/estoque | 3:2 | Prateleira minimalista com os quatro produtos organizados no salão. |
| 17 | `booking-experience.png` | Experiência digital | 3:2 | Cliente usando smartphone durante uma pausa, interface não legível e ambiente da barbearia ao fundo. |
| 18 | `shop-interior-wide.png` | Sobre/ambiente | 16:9 | Plano amplo do salão vazio, quatro estações, concreto, aço e couro preto. |
| 19 | `reception-counter.png` | Contato/ambiente | 3:2 | Balcão de recepção minimalista com luz suave, sem logotipo ou textos. |
| 20 | `client-before-after-neutral.png` | Resultado | 2:1 | Díptico coerente do mesmo cliente antes e depois, mesma câmera, luz e expressão; resultado natural. |

## Estratégia de consistência

Primeiro serão criados e aprovados os quatro retratos-base. Esses retratos serão usados como referências visuais nas imagens coletivas e nas cenas de serviço para preservar rosto, cabelo, tom de pele e aparência geral. Ambientes, ferramentas e produtos seguirão um único vocabulário material e a mesma gradação Grafite editorial.

## Integração e segurança

- Os três arquivos atuais não serão sobrescritos; as novas versões usarão o sufixo `-v2`.
- Todos os arquivos finais serão copiados para `public/images/`.
- As imagens serão inspecionadas individualmente antes de serem conectadas ao site.
- A integração deve manter fallback por iniciais quando uma foto profissional estiver ausente.
- A campanha é fictícia e não deve sugerir que os personagens são pessoas reais ou clientes identificáveis.

## Critérios de aceite

- As 20 imagens existem nos nomes e proporções definidos.
- Os quatro profissionais permanecem reconhecíveis entre retratos, equipe e atendimentos.
- Não há textos acidentais, logotipos, marcas, watermark ou deformações visíveis.
- A paleta, iluminação, materiais e contraste formam um conjunto visual uniforme.
- Os cortes principais funcionam em desktop e mobile sem ocultar mãos, ferramentas ou rostos importantes.
- Os arquivos finais ficam dentro do projeto e podem ser usados diretamente pelo Next.js.
