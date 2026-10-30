// Monta todas as telas do jogo (a página HTML só tem o contêiner #app)
import { html } from './util.js';

export const logo = (cls = '') => `
  <div class="logo ${cls}" aria-label="Overdrive Rivals">
    <div class="logo-top"><i class="flag"></i><span>OVERDRIVE</span></div>
    <div class="logo-bar"></div>
    <div class="logo-bot"><i class="flag"></i><span>RIVALS</span></div>
  </div>`;

const statBars = prefix => `
  <div class="stat"><span>Velocidade</span><div class="bar"><i id="${prefix}Spd"></i></div></div>
  <div class="stat"><span>Aceleração</span><div class="bar"><i id="${prefix}Acc"></i></div></div>
  <div class="stat"><span>Controle</span><div class="bar"><i id="${prefix}Ctl"></i></div></div>`;

const SCREENS = `
<!-- Intro em vídeo -->
<section id="intro" class="screen">
  <video id="introVideo" src="media/intro.mp4" muted playsinline preload="auto"></video>
  <div class="intro-shade"></div>
  <div class="intro-logo">${logo('xl')}</div>
  <button class="intro-start" id="introStart" hidden>▶ Clique para começar</button>
  <div class="intro-ctrl">
    <button class="chip" id="introSound">🔇 Ativar som</button>
    <button class="chip" id="introSkip">Pular ▸▸</button>
  </div>
</section>

<!-- Tela inicial -->
<section id="home" class="screen">
  <div class="home-fx"><i></i><i></i><i></i></div>
  <canvas id="sparks"></canvas>
  <header class="topbar">
    <div class="pilot"><span class="helmet">⛑</span><div><small>Piloto</small><b id="homePilot">Visitante</b></div></div>
    <span class="netStatus off">○ Conectando...</span>
  </header>
  <div class="home-left">
    ${logo()}
    <p class="tagline">Corridas multiplayer em tempo real. Crie uma sala, chame os amigos e acelere.</p>
    <nav class="menu">
      <button class="mbtn primary" id="btnPlay"><b>Jogar</b><small>Criar ou entrar numa sala</small></button>
      <button class="mbtn" id="btnGarage"><b>Garagem</b><small><span id="carCount"></span> carros disponíveis</small></button>
      <button class="mbtn" id="btnHow"><b>Como jogar</b><small>Controles e regras</small></button>
    </nav>
  </div>
  <aside class="home-car">
    <div class="hc-tier" id="hcTier"></div>
    <div class="hc-brand" id="hcBrand"></div>
    <div class="hc-model" id="hcModel"></div>
    <div class="hc-pr"><small>PR</small><b id="hcPr"></b><span class="stars" id="hcStars"></span></div>
    ${statBars('hc')}
    <button class="link" id="btnChange">Trocar carro ›</button>
  </aside>
  <div class="howto" id="howto" hidden>
    <div class="panel">
      <h2>Como jogar</h2>
      <div class="keys">
        <div><kbd>↑</kbd><kbd>W</kbd><span>Acelerar</span></div>
        <div><kbd>↓</kbd><kbd>S</kbd><span>Frear / ré</span></div>
        <div><kbd>←</kbd><kbd>→</kbd><span>Virar</span></div>
        <div><kbd>V</kbd><span>Olhar para trás</span></div>
        <div><kbd>Esc</kbd><span>Sair da corrida</span></div>
      </div>
      <p class="sub">Crie uma sala, passe o código para os amigos e o anfitrião larga quando todos estiverem prontos. Vence quem completar as voltas primeiro.</p>
      <div class="row"><button class="btn" id="howClose">Entendi</button></div>
    </div>
  </div>
</section>

<!-- Garagem -->
<section id="garage" class="screen">
  <header class="gbar">
    <button class="back" data-back>‹</button>
    <div><div class="kicker">Overdrive Rivals</div><h2>Garagem</h2></div>
    <div class="filters" id="brandFilters"></div>
  </header>
  <div class="gwrap">
    <button class="garrow left" id="gLeft">‹</button>
    <div class="ggrid" id="carGrid"></div>
    <button class="garrow right" id="gRight">›</button>
  </div>
  <footer class="gfoot">
    <div class="gsel">
      <div class="kicker" id="gsBrand"></div>
      <div class="gs-model" id="gsModel"></div>
      <div class="gs-meta"><span class="stars" id="gsStars"></span><span class="pr">PR <b id="gsPr"></b></span></div>
    </div>
    <div class="gstats">${statBars('gs')}</div>
    <div class="gactions">
      <button class="btn ghost" id="btnInspect">Ver em 3D</button>
      <button class="btn big" id="btnPick">Escolher</button>
    </div>
  </footer>
  <div class="inspect-ui">
    <button class="btn ghost small" id="btnInspectBack">‹ Voltar à garagem</button>
    <div class="ins-hint">O carro gira sozinho · clique em Escolher para usar</div>
  </div>
</section>

<!-- Nome do piloto -->
<section id="name" class="screen">
  <div class="panel name-panel">
    <div class="kicker">Passo 1 de 2</div>
    <h2>Nome do piloto</h2>
    <p class="sub">Ele aparece acima do seu carro durante a corrida.</p>
    <input id="playerName" maxlength="16" placeholder="Seu nome" autocomplete="off">
    <div class="row">
      <button class="btn" id="nameOk">Continuar</button>
      <button class="btn ghost small" data-back>Voltar</button>
    </div>
  </div>
</section>

<!-- Criar ou entrar numa sala -->
<section id="mode" class="screen">
  <div class="mode-head">
    <div class="kicker">Passo 2 de 2</div>
    <h2>Olá, <span id="modeName"></span>!</h2>
    <p class="sub">Como você quer correr?</p>
  </div>
  <div class="mode-cards">
    <button class="mcard" id="btnCreate">
      <span class="mc-icon">＋</span>
      <b>Criar sala</b>
      <small>Escolha a pista e convide os amigos com o código da sala. Você será o anfitrião.</small>
      <span class="mc-go">Criar ›</span>
    </button>
    <button class="mcard" id="btnJoin">
      <span class="mc-icon">⇢</span>
      <b>Entrar numa sala</b>
      <small>Veja as salas abertas agora ou digite o código que um amigo te passou.</small>
      <span class="mc-go">Procurar ›</span>
    </button>
  </div>
  <button class="btn ghost small" data-back>Voltar</button>
</section>

<!-- Criar sala: escolha da pista -->
<section id="create" class="screen">
  <div class="wide-panel">
    <div class="kicker">Criar sala</div>
    <h2>Escolha a pista</h2>
    <p class="sub">Pistas reais em 3D. Depois de criar, passe o código da sala para os amigos.</p>
    <div class="tgrid" id="trackGrid"></div>
    <div class="row"><button class="btn ghost small" data-back>Voltar</button></div>
  </div>
</section>

<!-- Entrar numa sala -->
<section id="join" class="screen">
  <div class="wide-panel">
    <div class="kicker">Entrar numa sala</div>
    <h2>Salas abertas</h2>
    <div class="code-row">
      <input id="joinCode" maxlength="4" placeholder="CÓDIGO" autocomplete="off">
      <button class="btn" id="joinGo">Entrar</button>
    </div>
    <div class="rlist" id="roomList"></div>
    <div class="row"><button class="btn ghost small" data-back>Voltar</button></div>
  </div>
</section>

<!-- Sala de espera -->
<section id="lobby" class="screen">
  <div class="lobby">
    <div class="lb-track">
      <div class="kicker" id="lbKicker"></div>
      <h2 id="lbTitle"></h2>
      <canvas id="lbMap" width="520" height="360"></canvas>
      <div class="lb-facts" id="lbFacts"></div>
      <div class="lb-mode">
        <small>Horário da corrida</small>
        <div class="lb-seg" id="lbMode">
          <button class="chip" data-night="0">Dia</button>
          <button class="chip" data-night="1">Noite</button>
        </div>
      </div>
      <div class="lb-code">
        <small>Código da sala</small>
        <b id="lbCode">----</b>
        <button class="chip" id="btnCopy">Copiar</button>
      </div>
    </div>
    <div class="lb-main">
      <div class="lb-head"><h3>Pilotos</h3><span id="lbCount"></span></div>
      <div class="slots" id="lbPlayers"></div>
      <div class="lb-foot">
        <div class="lb-status" id="lbSub"></div>
        <button class="btn big" id="btnStart">Iniciar corrida</button>
        <button class="btn ghost small" id="btnLeave">Sair da sala</button>
      </div>
    </div>
  </div>
</section>

<!-- Resultado: pódio com os 3 melhores -->
<section id="results" class="screen">
  <div class="resWrap">
    <div class="kicker" id="resTrack"></div>
    <h2 id="resTitle">Resultado</h2>
    <p class="sub" id="resSub"></p>
    <div class="podium" id="podium"></div>
    <div class="row center">
      <button class="btn" id="btnBackLobby">Voltar à sala</button>
      <button class="btn ghost small" id="btnMenu">Menu inicial</button>
    </div>
  </div>
</section>

<!-- HUD da corrida -->
<section id="race" class="hud">
  <div class="hbox" id="hudTL">
    <div class="lbl">Volta</div><div class="val" id="hudLap">1 / 3</div>
    <div class="lbl" style="margin-top:6px">Tempo</div><div class="val sm" id="hudTime">0:00.00</div>
    <div class="lbl" style="margin-top:6px">Melhor volta</div><div class="val sm" id="hudBest">--</div>
  </div>
  <div id="hudPos"><div class="p" id="hudP">P1<small>/6</small></div></div>
  <div class="hbox" id="board"></div>
  <div class="hbox" id="speedo"><div class="num" id="hudSpeed">0</div><div class="unit">KM/H</div><div id="rev"><i></i></div></div>
  <div class="hbox" id="mini"><canvas id="miniCv" width="340" height="340"></canvas></div>
  <div id="help">↑ acelerar · ↓ frear/ré · ← → virar · <b>V</b> olhar para trás</div>
  <div id="rearTag">◀ VISÃO TRASEIRA</div>
  <div id="warn">CONTRAMÃO!</div>
  <div id="finishMsg">BANDEIRADA! Aguardando os outros pilotos...</div>
  <div id="sema">
    <div class="gantry">${'<div class="col"><div class="light"></div><div class="light"></div></div>'.repeat(5)}</div>
    <div id="semaText">PREPARE-SE</div>
  </div>
  <button class="btn ghost small" id="btnSair">Sair da sala (Esc)</button>
</section>

<div id="labels"></div>
<div id="loading"><div class="spinner"></div><div id="loadingText">Carregando...</div><div id="loadingBar"><i></i></div></div>
<div id="msg"></div>
<span class="netStatus off" id="net">○ Conectando...</span>
`;

export function mountUI() {
  document.querySelector('#app').append(html(SCREENS));
}
