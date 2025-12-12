const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart');
const pauseBtn = document.getElementById('pause');
const startMenu = document.getElementById('startMenu');
const startBtn = document.getElementById('startBtn');
const startFullscreenCheckbox = document.getElementById('startFullscreen');
const touchControls = document.getElementById('touch-controls');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const canvasWrapper = document.querySelector('.canvas-wrapper');

function startGameWithDifficulty(diff){
  // set baseSpeed directly from difficulty preset
  if(diff in DIFFICULTY_PRESETS){
    baseSpeed = DIFFICULTY_PRESETS[diff];
  } else {
    baseSpeed = DIFFICULTY_PRESETS['normal'];
  }
  if(startMenu) startMenu.classList.add('hidden');
  // animate a fruit dropping into the initial food position, then reset/start game
  const initialFood = food; // placeFood was called during preview init (food.type present)
  animateFruitDrop(initialFood, ()=>{ reset(); });
}

// animate a fruit dropping from top-center into the given cell position
function animateFruitDrop(cellPos, cb){
  if(!cellPos) { if(cb) cb(); return; }
  // ensure image loaded
  const startAnim = ()=>{
    const canvasRect = canvas.getBoundingClientRect();
    const displayCell = canvasRect.width / GRID;
    const largeFruitsSet = new Set(['grape','banana','strawberry']);
    const fruitType = cellPos.type || 'mandarin';
    let size = Math.max(36, Math.min(80, Math.floor(displayCell * 1.15)));
    if(largeFruitsSet.has(fruitType)){
      // increase visual pixel size by 100% (2x) for these fruits
      size = Math.min(Math.floor(canvasRect.width * 0.9), Math.floor(size * 2));
    }
    const startX = canvasRect.left + canvasRect.width/2 - size/2;
    const startY = canvasRect.top - size - 8;
    const destX = canvasRect.left + (cellPos.x * displayCell) + (displayCell - size)/2;
    const destY = canvasRect.top + (cellPos.y * displayCell) + (displayCell - size)/2;

    const img = document.createElement('img');
    img.src = fruitDataUrls[fruitType] || fruitDataUrls['mandarin'];
    img.className = 'drop-fruit';
    img.style.position = 'fixed';
    img.style.left = startX + 'px';
    img.style.top = startY + 'px';
    img.style.width = size + 'px';
    img.style.height = size + 'px';
    img.style.transition = 'transform 560ms cubic-bezier(.2,.9,.2,1), top 560ms cubic-bezier(.2,.9,.2,1), left 560ms cubic-bezier(.2,.9,.2,1)';
    img.style.zIndex = 4000;
    img.style.pointerEvents = 'none';
    document.body.appendChild(img);

    // small rotate/scale during flight
    requestAnimationFrame(()=>{
      img.style.transform = 'translate(' + (destX - startX) + 'px,' + (destY - startY) + 'px) scale(1) rotate(10deg)';
    });

    function done(){
      img.remove();
      if(cb) cb();
    }
    img.addEventListener('transitionend', done, {once:true});
    // safety fallback
    setTimeout(()=>{ if(document.body.contains(img)) { img.remove(); if(cb) cb(); } }, 900);
  };

  // ensure at least one fruit image has loaded; check the specific fruit if possible
  const checkImg = (()=>{
    try{ const t = cellPos && cellPos.type ? fruitImgs[cellPos.type] : null; return t || Object.values(fruitImgs)[0]; }catch(e){ return Object.values(fruitImgs)[0]; }
  })();
  if(checkImg && checkImg.complete && checkImg.naturalWidth){ startAnim(); }
  else if(checkImg) checkImg.onload = startAnim;
}

// helper to attempt entering native fullscreen or fallback to pseudo
async function maybeEnterFullscreenBeforeStart(){
  if(startFullscreenCheckbox && startFullscreenCheckbox.checked){
    if(!isFullscreen()){
      const target = canvasWrapper || canvas;
      try{
        const r = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
        if(r) await r.call(target);
        else enterPseudoFullscreen();
      }catch(e){
        // fallback
        enterPseudoFullscreen();
      }
    }
  }
}
const difficultyEl = document.getElementById('difficulty');

// difficulty presets map to baseSpeed (ms per step)
const DIFFICULTY_PRESETS = {
  easy: 200,
  normal: 120,
  hard: 70
};

// grid size
const GRID = 20;

// WebAudio for short effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
let audioUnlocked = false;
let eatBuffer = null;
let eatAudio = null;
let eatAudioReady = false;

function loadEatSound(){
  // Audio file loading disabled due to server range request issues
  // Falling back to synthesized sound in playSound()
}
// begin game initialization
loadEatSound();

// fruit SVGs and preloaded images for variety of food drops
const FRUIT_TYPES = ['mandarin','grape','apple','strawberry','kiwifruit','watermelon','banana'];
const fruitSvgs = {
  mandarin: `<?xml version="1.0" encoding="utf-8"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='#ff9f43' stroke='#e86a00' stroke-width='3'/><path d='M48 18c-1-6-8-9-11-7' fill='none' stroke='#2b7a00' stroke-width='3' stroke-linecap='round'/></svg>`,
  grape: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='#6f2da8'><circle cx='40' cy='50' r='12'/><circle cx='54' cy='40' r='12'/><circle cx='68' cy='52' r='12'/><circle cx='50' cy='64' r='12'/></g><path d='M48 28c4-6 10-8 14-6' fill='none' stroke='#2b7a00' stroke-width='3'/></svg>`,
  apple: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='54' r='18' fill='#d43d3d' stroke='#8b1f1f' stroke-width='2'/><path d='M54 28c-2-6-10-8-14-4' fill='none' stroke='#2b7a00' stroke-width='3'/></svg>`,
  strawberry: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 22c16 0 26 18 26 30 0 18-18 34-26 34s-26-16-26-34c0-12 10-30 26-30z' fill='#ff4d6d' stroke='#b22b47' stroke-width='2'/><g fill='#fff' opacity='0.9'><circle cx='46' cy='50' r='1.6'/><circle cx='54' cy='58' r='1.6'/></g></svg>`,
  kiwifruit: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='30' fill='#6fbf3f' stroke='#5a9a2f' stroke-width='3'/><circle cx='50' cy='50' r='18' fill='#fff1c8'/><circle cx='50' cy='50' r='12' fill='#7a4828'/></svg>`,
  watermelon: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='36' fill='#ff6b81' stroke='#1f8a3a' stroke-width='8'/><path d='M30 50c6-6 12-10 20-10s14 4 20 10' fill='none' stroke='#000' stroke-width='1'/></svg>`,
  banana: `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M20 54c8-18 36-30 60-22c-6 18-28 34-48 36c-8 1-12-6-12-14z' fill='#ffd24a' stroke='#d4a82a' stroke-width='2'/></svg>`
};
const fruitDataUrls = {};
const fruitImgs = {};
FRUIT_TYPES.forEach(k=>{
  fruitDataUrls[k] = 'data:image/svg+xml;utf8,' + encodeURIComponent(fruitSvgs[k]);
  const im = new Image(); im.src = fruitDataUrls[k]; fruitImgs[k] = im;
});

// game state variables
let snake = [];
let dir = {x:0, y:0};
let food = {x:0, y:0};
let timer = null;
let speed = 120;
let running = false;
let score = 0;
let baseSpeed = 120;
let CELL = 0;

function unlockAudio(){
  if(!audioCtx || audioUnlocked) return;
  // resume on first user gesture
  if(audioCtx.state === 'suspended'){
    audioCtx.resume().then(()=>{ audioUnlocked = true; }).catch(()=>{ audioUnlocked = true; });
  } else audioUnlocked = true;
}

function playSound(type){
  // Fruit eating sound effects
  if(type === 'eat'){
    // Generate synthesized fruit eating sound
    if(audioCtx && audioUnlocked){
      try{
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(800, now);
        o.frequency.linearRampToValueAtTime(400, now+0.15);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.2);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now);
        o.stop(now+0.2);
      }catch(e){ console.warn('playSound eat oscillator error', e); }
    }
    return;
  }

  // Non-eat effects: require WebAudio and unlocked state
  if(!audioCtx || !audioUnlocked) return;
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  if(type==='gameover'){
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, now);
    o.frequency.exponentialRampToValueAtTime(80, now+0.5);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.6);
    o.start(now); o.stop(now+0.62);
  } else if(type==='turn'){
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.05);
    o.start(now); o.stop(now+0.06);
  }
}

  // cheering phrases shown when player eats a fruit
  const CHEERS = [
    'Good job!',
    'Nice job!',
    'WOW!',
    'Amazing!',
    'Oh my god!'
  ];

  function showCheer(text){
    try{
      const el = document.createElement('div');
      el.className = 'cheer';
      el.textContent = text;
      const rect = canvas.getBoundingClientRect();
      el.style.opacity = '0';
      // prefer appending inside the canvas wrapper so it's always visible above canvas
      const container = canvasWrapper || document.body;
      if(container === canvasWrapper){
        el.style.position = 'absolute';
        const wrapRect = canvasWrapper.getBoundingClientRect();
        el.style.left = (wrapRect.width/2) + 'px';
        el.style.top = (wrapRect.height*0.12 + (Math.random()-0.5)*40) + 'px';
        el.style.transform = 'translateX(-50%) scale(0.85)';
        canvasWrapper.appendChild(el);
      } else {
        el.style.position = 'fixed';
        el.style.left = (rect.left + rect.width/2) + 'px';
        el.style.top = (rect.top + rect.height*0.12 + (Math.random()-0.5)*40) + 'px';
        el.style.transform = 'translateX(-50%) scale(0.85)';
        document.body.appendChild(el);
      }
      // animate in
      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) scale(1)';
      });
      // optional speech (respect browser autoplay/user gesture rules)
      try{
        if(window.speechSynthesis && Math.random() < 0.6){
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 1.05; u.pitch = 1.1;
          speechSynthesis.speak(u);
        }
      }catch(e){}
      // fade out and remove
      setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(-18px) scale(0.95)';
      }, 900);
      el.addEventListener('transitionend', ()=>{ if(el && el.parentNode) el.remove(); }, {once:true});
    }catch(e){ console.warn('showCheer error', e); }
  }

function computeSpeed(){
  // speed decreases (faster) by 8ms every 5 points, min 40
  return Math.max(40, baseSpeed - Math.floor(score/5)*8);
}


function reset(){
  snake = [{x: Math.floor(GRID/2), y: Math.floor(GRID/2)}];
  dir = {x:0,y:0};
  placeFood();
  speed = computeSpeed();
  score = 0;
  running = true;
  scoreEl.textContent = 'Score: 0';
  if(timer) clearInterval(timer);
  timer = setInterval(step, speed);
  draw();
}

function placeFood(){
  while(true){
    const pos = {x: Math.floor(Math.random()*GRID), y: Math.floor(Math.random()*GRID)};
    if(!snake.some(s => s.x===pos.x && s.y===pos.y)){
      const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      food = { x: pos.x, y: pos.y, type };
      break;
    }
  }
}

function step(){
  if(!running) return;
  // don't advance the game until the player sets a direction
  if(dir.x === 0 && dir.y === 0){ draw(); return; }
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  // wrap-around behavior
  head.x = (head.x + GRID) % GRID;
  head.y = (head.y + GRID) % GRID;

  // collision with self
  if(snake.some(s => s.x===head.x && s.y===head.y)){
    gameOver();
    return;
  }

  snake.unshift(head);
  if(head.x===food.x && head.y===food.y){
    score += 1;
    scoreEl.textContent = 'Score: ' + score;
    // recompute speed when score changes
    speed = computeSpeed();
    clearInterval(timer); timer = setInterval(step, speed);
    playSound('eat');
    // cheering commentary
    try{ const phrase = CHEERS[Math.floor(Math.random()*CHEERS.length)]; showCheer(phrase); }catch(e){}
    placeFood();
    // animate fruit drop for new food
    animateFruitDrop(food, ()=>{ /* animation complete */ });
  } else {
    snake.pop();
  }
  draw();
}

function gameOver(){
  running = false;
  clearInterval(timer);
  pauseBtn.textContent = 'Paused';
  setTimeout(()=>{
    const again = confirm('Game Over — score: '+score + "\n\nRestart to main menu?");
    if(again){
      if(startMenu) startMenu.classList.remove('hidden');
      snake = [{x: Math.floor(GRID/2), y: Math.floor(GRID/2)}];
      placeFood();
      draw();
      pauseBtn.textContent = 'Pause';
    }
  }, 50);
}

// Fullscreen handlers
function isFullscreen(){
  return document.fullscreenElement != null || document.webkitFullscreenElement != null;
}

function updateFullscreenButton(){
  if(!fullscreenBtn) return;
  fullscreenBtn.textContent = isFullscreen() ? '⤢' : '⤢';
}

if(fullscreenBtn){
  const requestFull = (el)=>{
    const r = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if(!r) return Promise.reject(new Error('requestFullscreen not supported'));
    return r.call(el);
  };
  const exitFull = ()=>{
    const e = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if(!e) return Promise.reject(new Error('exitFullscreen not supported'));
    return e.call(document);
  };

  // keep reference to original parent so we can restore touch controls
  const originalTouchParent = touchControls ? touchControls.parentNode : null;
  const originalNextSibling = touchControls ? touchControls.nextSibling : null;

  fullscreenBtn.addEventListener('click', async (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    unlockAudio();
    try{
      if(!isFullscreen()){
        const target = canvasWrapper || canvas;
        try{
          await requestFull(target);
        }catch(err){
          // fallback to pseudo-fullscreen on mobile / restricted browsers
          enterPseudoFullscreen();
        }
      } else {
        await exitFull();
      }
    }catch(e){
      console.warn('Fullscreen toggle failed', e);
    }
  });

  // update the button icon when fullscreen state changes and move touch controls
  function onFullChange(){
    const fs = isFullscreen();
    fullscreenBtn.textContent = fs ? '⤡' : '⤢';
    fullscreenBtn.setAttribute('aria-pressed', fs ? 'true' : 'false');

    if(touchControls){
      if(fs){
        // move controls inside the wrapper so they overlay the canvas
        try{ canvasWrapper.appendChild(touchControls); }catch(e){}
        touchControls.classList.remove('touch-hidden');
        touchControls.setAttribute('aria-hidden', 'false');
      } else {
        // if we are in pseudo-fullscreen, do not restore yet
        if(canvasWrapper.classList.contains('pseudo-fullscreen')) return;
        // restore original position
        if(originalTouchParent){
          if(originalNextSibling) originalTouchParent.insertBefore(touchControls, originalNextSibling);
          else originalTouchParent.appendChild(touchControls);
        }
        // hide on non-coarse pointers
        if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches){
          touchControls.classList.remove('touch-hidden');
        } else {
          touchControls.classList.add('touch-hidden');
        }
        touchControls.setAttribute('aria-hidden', touchControls.classList.contains('touch-hidden') ? 'true' : 'false');
      }
    }
  }

  document.addEventListener('fullscreenchange', onFullChange);
  document.addEventListener('webkitfullscreenchange', onFullChange);
  document.addEventListener('mozfullscreenchange', onFullChange);
  document.addEventListener('MSFullscreenChange', onFullChange);
  // ensure initial label
  updateFullscreenButton();
}

let pseudoActive = false;
function enterPseudoFullscreen(){
  if(!canvasWrapper) return;
  if(pseudoActive) return;
  // prevent body scroll
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  canvasWrapper.classList.add('pseudo-fullscreen');
  // move touch controls inside wrapper
  if(touchControls) canvasWrapper.appendChild(touchControls);
  touchControls.classList.remove('touch-hidden');
  touchControls.setAttribute('aria-hidden','false');
  pseudoActive = true;
  fullscreenBtn.textContent = '⤡';
  fullscreenBtn.setAttribute('aria-pressed','true');
  // adjust canvas to fit available space (stacked controls)
  adjustCanvasForFullscreen();
}

function exitPseudoFullscreen(){
  if(!pseudoActive) return;
  canvasWrapper.classList.remove('pseudo-fullscreen');
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  // restore touch controls to original place
  if(originalTouchParent){
    if(originalNextSibling) originalTouchParent.insertBefore(touchControls, originalNextSibling);
    else originalTouchParent.appendChild(touchControls);
  }
  // hide on non-coarse pointers
  if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches){
    touchControls.classList.remove('touch-hidden');
  } else {
    touchControls.classList.add('touch-hidden');
  }
  touchControls.setAttribute('aria-hidden', touchControls.classList.contains('touch-hidden') ? 'true' : 'false');
  pseudoActive = false;
  fullscreenBtn.textContent = '⤢';
  fullscreenBtn.setAttribute('aria-pressed','false');
  // restore canvas sizing
  restoreCanvasSize();
}

// If native exit happens, also clear pseudo state
document.addEventListener('fullscreenchange', ()=>{ if(!isFullscreen() && pseudoActive) exitPseudoFullscreen(); });

// When fullscreen (native or pseudo) we want to size the canvas to available
// wrapper area minus controls. Use devicePixelRatio for crisp rendering.
function adjustCanvasForFullscreen(){
  if(!canvasWrapper || !canvas) return;
  // ensure controls are visible and inside wrapper
  if(touchControls && touchControls.parentNode !== canvasWrapper){
    try{ canvasWrapper.appendChild(touchControls); }catch(e){}
  }
  // compute available area inside wrapper
  const wrapRect = canvasWrapper.getBoundingClientRect();
  let controlsH = 0;
  if(touchControls){
    // make controls visible to measure
    touchControls.classList.remove('touch-hidden');
    const cr = touchControls.getBoundingClientRect();
    controlsH = cr.height || 0;
  }
  const availW = Math.max(100, Math.floor(wrapRect.width));
  const availH = Math.max(100, Math.floor(wrapRect.height - controlsH - 12));
  const dpr = window.devicePixelRatio || 1;
  // set CSS size and backing store size
  canvas.style.width = availW + 'px';
  canvas.style.height = availH + 'px';
  canvas.width = Math.max(100, Math.floor(availW * dpr));
  canvas.height = Math.max(100, Math.floor(availH * dpr));
  CELL = canvas.width / GRID;
  draw();
}

function restoreCanvasSize(){
  // revert to responsive behaviour
  resizeCanvas();
}

// call adjust when entering/exiting native fullscreen
document.addEventListener('fullscreenchange', ()=>{ if(isFullscreen()) adjustCanvasForFullscreen(); else restoreCanvasSize(); });
document.addEventListener('webkitfullscreenchange', ()=>{ if(isFullscreen()) adjustCanvasForFullscreen(); else restoreCanvasSize(); });

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // gradient background with colorful theme
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#FFB6C1');
  gradient.addColorStop(0.33, '#87CEEB');
  gradient.addColorStop(0.66, '#FFD700');
  gradient.addColorStop(1, '#FF69B4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw food (use selected fruit image when available)
  const ftype = (food && food.type) ? food.type : 'mandarin';
  const fimg = fruitImgs[ftype];
  if(fimg && fimg.complete && fimg.naturalWidth){
    const pad = Math.max(2, Math.floor(CELL*0.08));
    const base = Math.max(4, Math.floor(CELL - pad*2));
    const largeFruitsSet = new Set(['grape','banana','strawberry']);
    const fscale = largeFruitsSet.has(ftype) ? 2 : 1; // 2x for these fruits
    const w = Math.min(160, Math.max(4, Math.floor(base * 1.15 * fscale)));
    const xpx = Math.floor(food.x*CELL + (CELL - w)/2);
    const ypx = Math.floor(food.y*CELL + (CELL - w)/2);
    ctx.drawImage(fimg, xpx, ypx, w, w);
  } else {
    ctx.fillStyle = '#ff6666';
    drawCell(food.x, food.y);
  }

  // draw snake: head red, body random shades of green from very light to very dark
  for(let i=0;i<snake.length;i++){
    if(i===0){
      ctx.fillStyle = '#ff3b3b';
    } else {
      // Random green shade from light (80%) to dark (20%) lightness
      const lightness = 80 - Math.random() * 60;
      ctx.fillStyle = 'hsl(120,60%,' + Math.round(lightness) + '%)';
    }
    drawCell(snake[i].x, snake[i].y);
  }
}

function drawCell(x,y){
  ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
}

window.addEventListener('keydown', e=>{
  unlockAudio();
  if(e.key==='ArrowUp'){ setDirection(0,-1); playSound('turn'); }
  else if(e.key==='ArrowDown'){ setDirection(0,1); playSound('turn'); }
  else if(e.key==='ArrowLeft'){ setDirection(-1,0); playSound('turn'); }
  else if(e.key==='ArrowRight'){ setDirection(1,0); playSound('turn'); }
  else if(e.code==='Space'){ togglePause(); }
});

function setDirection(x,y){
  // prevent reversing directly
  if(dir.x === -x && dir.y === -y) return;
  dir = {x,y};
}

restartBtn.addEventListener('click', ()=>{ reset(); pauseBtn.textContent='Pause'; });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });

function togglePause(){
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
}

// touch/swipe controls
let tStartX=0, tStartY=0;
window.addEventListener('touchstart', e=>{
  if(e.touches && e.touches.length===1){
    tStartX = e.touches[0].clientX; tStartY = e.touches[0].clientY;
  }
}, {passive:true});
window.addEventListener('touchend', e=>{
  if(!tStartX && !tStartY) return;
  const touch = e.changedTouches && e.changedTouches[0];
  if(!touch) return;
  const dx = touch.clientX - tStartX;
  const dy = touch.clientY - tStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const threshold = 30; // px
  if(Math.max(absX, absY) < threshold) return;
  if(absX > absY){ // horizontal swipe
    setDirection(dx>0?1:-1, 0);
  } else {
    setDirection(0, dy>0?1:-1);
  }
  tStartX = 0; tStartY = 0;
}, {passive:true});

// on-screen buttons
if(touchControls){
  touchControls.querySelectorAll('.dir').forEach(btn=>{
    const cls = btn.classList;
    let d;
    if(cls.contains('up')) d = [0,-1];
    else if(cls.contains('down')) d = [0,1];
    else if(cls.contains('left')) d = [-1,0];
    else if(cls.contains('right')) d = [1,0];
    if(!d) return;
    const handler = (ev)=>{ ev.preventDefault(); unlockAudio(); setDirection(d[0], d[1]); playSound('turn'); };
    btn.addEventListener('touchstart', handler, {passive:false});
    btn.addEventListener('mousedown', handler, {passive:false});
    btn.addEventListener('pointerdown', handler, {passive:false});
  });
}

// initialize
// set initial slider display
// setup responsive canvas sizing
function resizeCanvas(){
  const padding = 32; // keep some margin
  const max = Math.min(480, Math.floor(window.innerWidth * 0.95));
  const size = Math.max(200, max - padding);
  canvas.width = size;
  canvas.height = size;
  CELL = canvas.width / GRID;
  draw();
}

window.addEventListener('resize', resizeCanvas);

// set initial slider display and unlock on first gesture
window.addEventListener('touchstart', ()=>unlockAudio(), {passive:true});
window.addEventListener('mousedown', ()=>unlockAudio(), {passive:true});

// initialize preview state before first draw
snake = [{x: Math.floor(GRID/2), y: Math.floor(GRID/2)}];
food = {x: 0, y: 0}; // placeholder, will be placed below
placeFood();

resizeCanvas();

// show start menu and prepare a preview (do not start until user picks)
if(startMenu){
  startMenu.classList.remove('hidden');
  console.log('Start menu displayed');
  // difficulty selection buttons in menu
  const menuBtns = Array.from(startMenu.querySelectorAll('.start-btn:not(.primary)'));
  // disable start button initially
  if(startBtn) startBtn.disabled = true;

  menuBtns.forEach(b=>{
    const diff = b.dataset.diff;
    const select = (ev)=>{
      if(ev && ev.preventDefault) ev.preventDefault();
      // highlight selection
      menuBtns.forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      // enable start button once a selection is made
      if(startBtn) startBtn.disabled = false;
      console.log('Difficulty selected (menu):', diff);
    };
    b.addEventListener('click', select);
    b.addEventListener('touchstart', select, {passive:false});
    b.addEventListener('pointerdown', select);
  });
  // start button: optionally request fullscreen first, then start
  if(startBtn){
    startBtn.addEventListener('click', async ()=>{
      const sel = menuBtns.find(x=>x.classList.contains('selected'));
      const diff = sel ? sel.dataset.diff : 'normal';
      console.log('Start pressed, selected difficulty:', diff);
      await maybeEnterFullscreenBeforeStart();
      startGameWithDifficulty(diff);
    });
  }
}