# GDD — THE PARTY
Version: 5 · Date: 2026-09-28 · Status: draft
Reader profile: hobbyist — termos técnicos recebem uma definição de até 5 palavras no primeiro uso

## G-1 Identity
- One-sentence pitch: Seja um vampiro procurando uma festa numa cidade de Halloween antes de 6 minutos terminarem [PROPOSED].
- Player fantasy: Ser um vampiro procurando a festa antes do amanhecer.
- Aesthetic targets: Challenge (desafio) e Discovery (descoberta).
- Genre: aventura de exploração e dedução em tempo real.
- 5 keywords: Halloween, monstros, vampiro, pistas, festa.
- Reference games: Among Us — informação social incompleta [PROPOSED]; Overcooked! — pressão de sessão curta [PROPOSED]; Luigi's Mansion 3 — Halloween sem violência [PROPOSED].

## G-2 Platform and audience
- Platform: web desktop; embed itch.io em 1280×720; mobile desativado.
- Target engine: HTML5 Canvas + ES modules, sem dependências e sem etapa de build.
- Verify command: `./package.sh`.
- Run command: `python3 -m http.server 8080` e abrir `http://localhost:8080`.
- Input devices: keyboard+mouse.
- Performance tier: web [PROPOSED].
- Audience: 10+ · jogadores casuais · familiaridade baixa com jogos de exploração.
- Session length target: 6–6 minutos.
- Total playtime target: 0,5–2 horas (5–20 partidas).

## G-3 Core loop and controls
- Core loop: uma volta = 45–90 s: 1. Percorrer calçadas e faixas. 2. Encontrar um monstro ou gato-guia. 3. Receber e comparar 1 carta de pista. 4. Escolher rota, forma e porta. 5. Bater na porta ou continuar buscando.
- Camera: projeção ortográfica 2D top-down fixa; área visível de 1.920×1.080 unidades; zoom de 0,75× a 1,25×.
- Player-controlled entities: 1 vampiro.
- Movement: andar a 180 unidades/s; forma de morcego a 300 unidades/s; transformação leva 250 ms; morcego consome 1 NIGHT/s.
- Control map:

  | Entrada | Ação |
  |---|---|
  | `WASD` / setas | Andar por calçadas e faixas |
  | `SPACE` | Alternar forma de morcego |
  | `E` | Bater em porta ou falar com monstro visível |
  | `Q` | Derramar doces e encerrar seguidores |
  | `ENTER` | Pausar; `ENTER` + `R` reinicia a noite |
  | `M` | Alternar mudo |
  | `[` / `]` | Diminuir / aumentar zoom |
  | Clique em carta | Trazer carta de pista à frente |

## G-4 Systems
- World generation: procedural — BSP (cortes recursivos) gera 70–90 blocos, 110–140 portas e 1 porta de festa; `CITY_SEED` mantém ruas entre noites e a seed da noite muda a porta da festa e NPCs.
- Combat (or "none"): none — não há dano ofensivo nem ataques do jogador.
- Enemy AI: Criança: Wander → Block → Recover; detecta o jogador a 48 unidades, colisão remove 10 Blood e interrompe movimento por 600 ms; ao carregar mais de 5 doces, muda de Wander ou Block para Follow e segue a 140 unidades/s até `Q` derramar os doces. Abóbora: Static; ocupa espaço sem causar dano. Monstro informante: Idle → Talked; `E` a até 48 unidades entrega 1 carta, até o máximo global de 5. Gato-guia: Roam → Point → Cooldown; a cada 90 s aponta por 4 s para 1 monstro não consultado a até 960 unidades.
- Puzzles (or "none"): 1 tipo — cruzamento manual de até 5 cartas de pista sobre distrito, avenida, rua e decoração. Cerca de 50% das pistas são mentiras; o jogador compara contradições e sobreposições no mapa, infere quais cartas podem ser falsas e escolhe portas sem confirmação automática. Não há punição específica pelo raciocínio incorreto; bater em porta errada aplica os custos e recompensas de Other systems.
- Other systems: Pistas — até 5 cartas por partida; cada carta declara 1 de 4 fatos (distrito, avenida, rua ou decoração), e cada monstro é honesto ou mentiroso com probabilidade de 50%. Blood — intervalo 0–100; colisão com criança remove 10; porta errada adiciona 12. NIGHT — intervalo 0–100; forma de morcego consome 1/s e, em 0, consome Blood a 1/s. Doces — intervalo 0–15; porta errada adiciona 3; acima de 5, crianças seguem o jogador; `Q` zera doces e seguidores. Cartas — intervalo 0–5; o mapa soma a opacidade de todas as áreas compatíveis e não elimina portas.
- Feedback loops: Blood: negativo — cada porta errada restaura 12 Blood, com freio de 6 minutos e +3 doces por porta. NIGHT: negativo — voo reduz NIGHT e, em 0, reduz Blood a 1/s; estabiliza o uso de atalho. Doces: positivo — cada porta errada concede +3 doces e, acima de 5, seguidores a 140 unidades/s reduzem mobilidade; freio: `Q` zera os 0–15 doces e seguidores. Cartas: positivo — cada carta adicional aumenta áreas de concordância no mapa; freio: limite de 5 cartas e aproximadamente 50% de mentiras.

## G-5 Content inventory
- Levels/zones: 1 × 6 minutos.
- Biomes/environment sets: 1; cidade urbana de Halloween com ruas, calçadas, casas e portas; a mecânica exclusiva é localizar uma porta por endereço e decoração.
- Enemy types: 3; tabela:

  | nome | HP | dano/acerto | velocidade (unidades/s) | arquétipo de comportamento (G-4) | encontrado em |
  |---|---:|---|---:|---|---|
  | Criança | não aplicável | -10 Blood por colisão; interrupção de 600 ms | 140 em Follow | Wander → Block → Recover → Follow | cidade urbana de Halloween |
  | Abóbora | não aplicável | 0; bloqueio físico | 0 | Static | cidade urbana de Halloween |
  | Monstro informante | não aplicável | 0; entrega 1 carta em interação | 0 | Idle → Talked; distância de interação de 48 unidades; máximo global de 5 cartas | cidade urbana de Halloween |
- Bosses: 0.
- Player progression items: 0 armas, 1 habilidade, 0 melhorias passivas, 0 colecionáveis — Forma de morcego: 300 unidades/s; 1 NIGHT/s; transformação de 250 ms.
- NPCs (or "none"): 2 papéis — monstros informantes: 4 arquétipos visuais e até 5 pistas por partida; gato-guia: 1 gato, aponta 1 monstro ainda não consultado a cada 90 s.
- Obstáculos visuais: 15 variações de criança e 4 variações de abóbora.

## G-6 Win, lose, progression
- Victory condition: `E` a até 48 unidades da única porta da festa antes de o temporizador chegar a 0:00; abre o estado `YOU FOUND THE PARTY`.
- Defeat condition: Blood chega a 0 e abre `DEAD`, ou temporizador chega a 0:00 e abre `ASH`; ambos reiniciam a rodada atual de 6 minutos, sem perda entre sessões.
- Difficulty curve: 0–2 min: 0–1 criança em Follow e 0–2 abóboras por bloco visível; 2–4 min: 1–2 crianças em Follow e 1–3 abóboras por bloco visível; 4–6 min: 2–3 crianças em Follow e 2–4 abóboras por bloco visível. Um padrão é apresentado aos 0 min (andar e porta), 1,5 min (forma de morcego), 3 min (doces e Follow) e 4,5 min (pistas contraditórias); os últimos 1,5 min combinam os 4 padrões e não introduzem regras.
- Replay factor: reruns procedurais com mesma cidade — ruas persistem; seed da noite muda porta da festa, NPCs, decoração e quais cartas são verdadeiras ou falsas.

## G-7 Scope guards
- Explicitly OUT of scope: multiplayer online; chat por voz ou texto; compra de itens; progressão permanente; contas de usuário; versão mobile; localização além de português; combate ofensivo; chefes; geração de conteúdo por usuários.
- Content cut order: 1. Cortar gato-guia (G-5: 1 NPC). 2. Reduzir arquétipos visuais de monstro de 4 para 2 (G-5). 3. Reduzir variações de criança de 15 para 8 e abóboras de 4 para 2 (G-5). 4. Reduzir blocos de 70–90 para 50–60 (G-4). Não cortar o limite de 5 cartas, a porta de festa ou a sessão de 6 minutos.

## G-8 Art and audio direction
- Visual style: ilustração 2D Canvas com contorno desenhado à mão e preenchimento opaco; canvas interno de 1280×720 px; sprites de personagem com no máximo 128×128 px; 4 estados visuais por tipo de entidade.
- Palette: 4 cores principais — preto `#000000`, vermelho-sangue `#cf1206`, cinza-claro `#c8c8c8` e cinza-escuro `#303030`.
- Guidance language:

  | classe de sinal | código visual fixo |
  |---|---|
  | interagível — porta | porta vermelha com aro preto; `E` a até 48 unidades |
  | interagível — monstro | silhueta de monstro com ícone de carta branco; `E` a até 48 unidades |
  | fonte de dano | criança em movimento com contorno preto e balão de alerta vermelho |
  | bloqueio sem dano | abóbora laranja/cinza com contorno preto; sem ícone de alerta |
  | objetivo | única porta de festa permanece visualmente indistinta até `E`; carta e som de vitória após interação |
  | recurso | Blood em vermelho, NIGHT em roxo, doces em amarelo e cartas em branco |
- Audio: música: 2 faixas em loop de 6 minutos; SFX: 18 one-shots; fonte: assets licenciados ou com licença de uso comercial verificada antes do empacotamento. `M` alterna mudo.

## Assumptions log
- G-1 pitch → formulação baseada no brief e no README → 2026-09-28 [PROPOSED].
- G-1 referências → Among Us, Overcooked! e Luigi's Mansion 3 como comparadores de direção → 2026-09-28 [PROPOSED].
- G-2 performance tier → orçamento web → 2026-09-28 [PROPOSED].
- G-6 curva de dificuldade → escalonamento de 0–6 min e cadência de 1,5 min → 2026-09-28 [PROPOSED].
- G-7 guardas de escopo e G-8 arte/áudio → limites de entrega web a 1280×720 → 2026-09-28 [PROPOSED].
