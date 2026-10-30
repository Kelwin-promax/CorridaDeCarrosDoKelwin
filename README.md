# Overdrive Rivals

Jogo de corrida 3D multiplayer no navegador (Three.js). Crie uma **sala**, escolha a pista e passe o código para os amigos correrem junto.

## Estrutura

```
server.js            servidor Node: entrega public/ e sincroniza as salas e os pilotos via WebSocket
package.json         dependências (express, ws) e script "npm start"
render.yaml          configuração do deploy no Render
public/
  index.html         página base (só carrega o CSS e o JavaScript)
  css/style.css      visual de todas as telas
  js/                o jogo, em módulos JavaScript
    main.js          ponto de entrada e loop de desenho
    ui.js            monta as telas (intro, início, garagem, salas, sala de espera, HUD)
    menus.js         intro, tela inicial, garagem, nome do piloto, criar/entrar numa sala
    lobby.js         sala de espera
    race.js          corrida: física, câmera, HUD
    results.js       pódio
    data.js          lista de carros e pistas
    tracks.js        pistas 3D e traçado
    surface.js       física contra a malha da pista: altura do chão e muros
    cars.js          carregamento dos carros
    showroom.js      palco 3D dos menus
    engine.js        renderizador, cena e luzes
    state.js         estado, navegação e conexão
    util.js          utilidades
  media/intro.mp4    vídeo de abertura
  *.glb, NewCars/    modelos dos carros
  RaceTracks/        modelos das pistas (Motegi, HG Circuit)
  tracks/*.json      traçado de cada pista (gerado por tools/track-centerline.js)
  thumbs/*.webp      miniaturas da garagem (geradas por tools/make-thumbs.js)
tools/               ferramentas para gerar traçados e miniaturas
```

## Rodar no computador

Requer Node 18 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000. Para testar o multiplayer, abra duas abas: numa delas **Criar sala**, na outra **Entrar numa sala** (pela lista ou pelo código de 4 letras). O anfitrião clica em **Iniciar corrida**.

## Controles

| Tecla | Ação |
|---|---|
| ↑ / W | acelerar |
| ↓ / S | frear / ré |
| ← → / A D | virar |
| V | alterna a câmera: olhar para trás / para frente |
| Esc | sair da corrida |

## Como funciona uma corrida

1. Um jogador cria a sala escolhendo a pista e vira anfitrião; os outros entram pela lista de salas ou pelo código.
2. O anfitrião clica em **Iniciar corrida**; todos carregam a pista e os carros.
3. Quando todos estão prontos, o semáforo acende (vermelho) e o servidor manda o **verde** ao mesmo tempo para todos.
4. Cada jogador simula o próprio carro e envia a posição 20 vezes por segundo; o servidor repassa para a sala.
5. Quando todos completam as voltas (ou 45 s depois do primeiro chegar), aparece o pódio com os 3 melhores.

## Adicionar carros ou pistas

- **Carro:** coloque o `.glb` em `public/NewCars/`, adicione uma linha em `CARS` (`public/js/data.js`) e gere a miniatura:
  `node tools/make-thumbs.js` e abra http://localhost:3001/__thumbs/?only=nome-do-arquivo
- **Pista:** coloque o `.glb` em `public/RaceTracks/`, configure as malhas do asfalto e os pontos de passagem em
  `tools/track-centerline.js`, rode `node tools/track-centerline.js <id> --debug` (confira a imagem em `tools/out/`)
  e adicione a pista em `TRACKS` (`public/js/data.js`, com os materiais de asfalto, chão e muros) e no `server.js`.

## Publicar no Render

1. Envie esta pasta para um repositório no GitHub (o `.gitignore` já ignora `node_modules`).
2. No Render, use **New > Blueprint** e escolha o repositório: o `render.yaml` cria o Web Service sozinho.
   Ou use **New > Web Service** com Runtime **Node**, Build `npm install`, Start `npm start` e Health Check `/healthz`.
3. O WebSocket usa o mesmo endereço (`wss://`), não precisa configurar nada.

### Observações

- O Render define a porta pela variável `PORT`; o servidor já usa ela.
- No plano gratuito, o serviço "dorme" após 15 minutos sem acesso; o primeiro acesso depois disso demora cerca de 1 minuto.
- Os modelos `.glb` somam cerca de 640 MB. Cada carro só é baixado quando aparece na tela ou na corrida, e a pista só quando a corrida começa;
  depois ficam no cache do navegador por 7 dias. Para deixar o jogo mais leve, dá para comprimir os modelos (por exemplo com `npx @gltf-transform/cli optimize`).
