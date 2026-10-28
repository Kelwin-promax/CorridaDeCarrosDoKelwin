# Grand Prix do Kelwin

Jogo de corrida 3D multiplayer no navegador (Three.js). Cada pista é uma **sala**: quem entra na mesma sala corre junto.

## Estrutura

```
server.js        servidor Node: entrega public/ e sincroniza os pilotos via WebSocket
package.json     dependências (express, ws) e script "npm start"
render.yaml      configuração do deploy no Render
public/
  index.html     o jogo (telas, pista, física, HUD)
  *.glb          modelos dos carros
```

## Rodar no computador

Requer Node 18 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000. Para testar o multiplayer, abra duas abas, entre na mesma sala e o anfitrião (o primeiro a entrar) clica em **Iniciar corrida**.

## Como funciona uma corrida

1. Os jogadores entram numa sala (pista). O primeiro vira anfitrião.
2. O anfitrião clica em **Iniciar corrida**; todos carregam os carros.
3. Quando todos estão prontos, o semáforo acende (vermelho) e o servidor manda o **verde** ao mesmo tempo para todos.
4. Cada jogador simula o próprio carro e envia a posição 20 vezes por segundo; o servidor repassa para a sala.
5. Quando todos completam as 3 voltas (ou 45 s depois do primeiro chegar), o servidor manda o resultado e aparece o pódio com os 3 melhores.

## Publicar no Render

1. Crie um repositório no GitHub e envie esta pasta (o `.gitignore` já ignora `node_modules`):

   ```bash
   git init
   git add .
   git commit -m "Grand Prix do Kelwin"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/grand-prix-do-kelwin.git
   git push -u origin main
   ```

2. No Render, use **New > Blueprint** e escolha o repositório: o `render.yaml` cria o Web Service sozinho.
   Ou use **New > Web Service** com:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/healthz`

3. Depois do deploy, o jogo fica em `https://<nome-do-serviço>.onrender.com`. O WebSocket usa o mesmo endereço (`wss://`), não precisa configurar nada.

### Observações

- O Render define a porta pela variável `PORT`; o servidor já usa ela.
- No plano gratuito, o serviço "dorme" após 15 minutos sem acesso; o primeiro acesso depois disso demora cerca de 1 minuto.
- Os modelos `.glb` somam cerca de 370 MB (o maior tem 95 MB, abaixo do limite de 100 MB por arquivo do GitHub).
  Eles demoram para baixar na primeira vez; depois ficam no cache do navegador por 7 dias.
  Para deixar o jogo bem mais leve, dá para comprimir os modelos (por exemplo com `npx @gltf-transform/cli optimize`).
