let GRID_SIZE = 6;
let TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// Tempo total do jogo
const GAME_TIME = 30;

// Quantidade e Tempo que leva para aparecer os quadrados vermelhos
const settings = {
  easy:   { litCount: 2, litMs: 900 },
  medium: { litCount: 3, litMs: 750 },
  hard:   { litCount: 2, litMs: 500 },
};

// Escalas (menu/fim e jogo). O jogo tem base 0.85, mas pode reduzir em telas menores (iPhone).
let menuScale = 1;
let gameScale = 0.85;

const i18n = {
  pt: {
    title: "Reaction Grid",
    start_desc:
      "Clique (ou toque) somente nos quadrados vermelhos antes que desapareçam.\nCada acerto soma pontos. Errar tira pontos.\nVocê tem 30 segundos para marcar o maior número de pontos possível.",
    grid_size_label: "TAMANHO DO GRID",
    diff_easy: "FÁCIL",
    diff_medium: "MÉDIO",
    diff_hard: "DIFÍCIL",
    difficulty_label: "DIFICULDADE",
    start_btn: "INICIAR",
    stop_btn: "PARAR",
    menu_btn: "MENU",
    time_label: "TEMPO",
    points_label: "PONTOS",
    developed_by: "Developed by Mach One Planalto.",
    game_over: "Fim de jogo",
    your_score: "SUA PONTUAÇÃO",
    local_best: "RECORDE (LOCAL)",
    play_again: "JOGAR DE NOVO",
    best_on_menu: (v) => `Recorde atual: ${v === null ? "—" : v}`,
    best_meta: (grid, diff, isNew) => `${grid}x${grid} • ${diff}${isNew ? " • NOVO RECORDE" : ""}`,
  },
  en: {
    title: "Reaction Grid",
    start_desc:
      "Click (or tap) only the red squares before they disappear.\nEach correct hit earns points. Each mistake costs points.\nYou have 30 seconds to score as many points as possible.",
    grid_size_label: "GRID SIZE",
    difficulty_label: "DIFFICULTY",
    start_btn: "START",
    diff_easy: "EASY",
    diff_medium: "MEDIUM",
    diff_hard: "HARD",
    stop_btn: "STOP",
    menu_btn: "MENU",
    time_label: "TIME",
    points_label: "POINTS",
    developed_by: "Developed by Mach One Planalto.",
    game_over: "Game Over",
    your_score: "YOUR SCORE",
    local_best: "LOCAL BEST",
    play_again: "PLAY AGAIN",
    best_on_menu: (v) => `Current best: ${v === null ? "—" : v}`,
    best_meta: (grid, diff, isNew) => `${grid}x${grid} • ${diff}${isNew ? " • NEW BEST" : ""}`,
  }
};

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");

const gridEl = document.getElementById("grid");

const stopBtn = document.getElementById("stopBtn");
const backBtn = document.getElementById("backBtn");

const startFromScreenBtn = document.getElementById("startFromScreenBtn");
const gridSizeInput = document.getElementById("gridSize");
const gridSizeLabel = document.getElementById("gridSizeLabel");
const gridSizeLabel2 = document.getElementById("gridSizeLabel2");
const bestOnMenu = document.getElementById("bestOnMenu");

const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");

const finalScoreEl = document.getElementById("finalScore");
const bestScoreEl = document.getElementById("bestScore");
const bestMetaEl = document.getElementById("bestMeta");
const playAgainBtn = document.getElementById("playAgainBtn");
const menuFromEndBtn = document.getElementById("menuFromEndBtn");

// Elementos auxiliares para cálculo de layout
const topImageEl = document.querySelector('.top-image');
const gameTopBarEl = document.querySelector('#gameScreen .top');

let cells = [];
let score = 0;

let running = false;
let gameStart = 0;
let rafId = null;

let activeSet = new Set();
let activeTimeouts = new Map();
let spawnerTimeout = null;

let currentDifficulty = "easy";

let currentLang = loadLang();

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function getViewportSize(){
  const vv = window.visualViewport;
  return {
    w: vv ? vv.width : window.innerWidth,
    h: vv ? vv.height : window.innerHeight
  };
}

function setCssVar(name, value){
  document.documentElement.style.setProperty(name, String(value));
}

/**
 * Ajusta escala do menu/fim e do jogo de forma adaptativa.
 * - Menu/Fim: 1.0 sempre que possível, reduz em telas pequenas (iPhone/SE).
 * - Jogo: base 0.85, mas também reduz se necessário para evitar corte.
 */
function applyResponsiveUIScaling(){
  const { w, h } = getViewportSize();

  // Base aproximada do painel (menu/fim). Reduz apenas quando faltar espaço.
  const ms = Math.min(1, w / 520, h / 880);
  menuScale = clamp(ms, 0.82, 1);

  // Jogo: nunca passa de 0.85; acompanha a redução quando a tela apertar.
  const gs = Math.min(0.85, menuScale * 0.92);
  gameScale = clamp(gs, 0.70, 0.85);

  setCssVar("--menu-scale", menuScale);
  setCssVar("--end-scale", menuScale);
  setCssVar("--game-scale", gameScale);
}

/**
 * Ajusta --cell-size e --gap para o grid CABER na área disponível.
 * Resolve corte no iPhone (Safari) em grids grandes (ex: 6x6).
 */
function applyResponsiveGridSizing(){
  if(!gridEl) return;

  const { w: viewportW, h: viewportH } = getViewportSize();

  const topImageH = topImageEl ? topImageEl.getBoundingClientRect().height : 0;
  const topBarH = gameTopBarEl ? gameTopBarEl.getBoundingClientRect().height : 0;

  // Folgas/paddings aproximados
  const paddingY = 12 * 2; // main padding (top+bottom)
  const paddingX = 12 * 2;
  const extraSlack = 18;

  // A área do stage é escalada (gameScale). Convertendo para o tamanho "pré-escala":
  const usableW = (viewportW - paddingX - extraSlack) / gameScale;
  const usableH = (viewportH - topImageH - topBarH - paddingY - extraSlack) / gameScale;

  // Gap adaptativo
  const gap = clamp(Math.floor(Math.min(usableW, usableH) * 0.015), 6, 12);

  const maxCellW = Math.floor((usableW - gap * (GRID_SIZE - 1)) / GRID_SIZE);
  const maxCellH = Math.floor((usableH - gap * (GRID_SIZE - 1)) / GRID_SIZE);

  // Limites para não ficar ridículo
  const cell = clamp(Math.min(maxCellW, maxCellH), 34, 72);

  setCssVar("--gap", `${gap}px`);
  setCssVar("--cell-size", `${cell}px`);
}

function loadLang(){
  const raw = localStorage.getItem("rg_lang");
  return raw === "en" ? "en" : "pt";
}

function setLang(lang){
  currentLang = (lang === "en") ? "en" : "pt";
  localStorage.setItem("rg_lang", currentLang);

  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });

  document.documentElement.lang = currentLang === "pt" ? "pt-br" : "en";

  renderI18nTexts();
  updateMenuBestLabel();
}

function renderI18nTexts(){
  const dict = i18n[currentLang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const v = dict[key];
    if(typeof v === "string") el.textContent = v;
  });
}

function bestKey(){
  return `rg_best_${GRID_SIZE}x${GRID_SIZE}_${currentDifficulty}`;
}

function getBest(){
  const raw = localStorage.getItem(bestKey());
  const n = raw === null ? null : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function setBest(val){
  localStorage.setItem(bestKey(), String(val));
}

function updateMenuBestLabel(){
  const dict = i18n[currentLang];
  const b = getBest();
  bestOnMenu.textContent = dict.best_on_menu(b);
}

function showStartScreen(){
  applyResponsiveUIScaling();

  gameScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");

  document.querySelectorAll(".diff-btn").forEach(b => b.disabled = false);
  updateMenuBestLabel();
}

function showGameScreen(){
  applyResponsiveUIScaling();
  // Após renderizar, recalcula tamanhos para caber no viewport (iPhone)
  requestAnimationFrame(() => applyResponsiveGridSizing());

  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function showEndScreen(){
  applyResponsiveUIScaling();

  startScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  endScreen.classList.remove("hidden");
}

function applyGridSize(size){
  GRID_SIZE = size;
  TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

  gridEl.style.setProperty("--grid-size", String(GRID_SIZE));
  buildGrid();
  updateMenuBestLabel();
  applyResponsiveGridSizing();
}

function buildGrid(){
  gridEl.innerHTML = "";
  cells = [];

  activeSet.clear();
  for(const t of activeTimeouts.values()) clearTimeout(t);
  activeTimeouts.clear();

  for(let i=0;i<TOTAL_CELLS;i++){
    const div = document.createElement("div");
    div.className = "cell";
    div.dataset.idx = String(i);
    div.addEventListener("pointerdown", onCellClick);
    gridEl.appendChild(div);
    cells.push(div);
  }
}

function setScore(delta){
  score += delta;
  scoreEl.textContent = String(score);
}

function setRunningUI(isRunning){
  stopBtn.disabled = !isRunning;
  backBtn.disabled = isRunning;

  // trava a dificuldade durante a partida (fica só no menu)
  document.querySelectorAll(".diff-btn").forEach(b => {
    b.disabled = isRunning;
  });
}

function activateCell(idx, litMs){
  if(activeSet.has(idx)) return;

  activeSet.add(idx);
  cells[idx].classList.add("active");

  const t = setTimeout(() => {
    deactivateCell(idx);
  }, litMs);

  activeTimeouts.set(idx, t);
}

function deactivateCell(idx){
  if(!activeSet.has(idx)) return;

  activeSet.delete(idx);
  cells[idx].classList.remove("active");

  const t = activeTimeouts.get(idx);
  if(t) clearTimeout(t);
  activeTimeouts.delete(idx);
}

function pickRandomInactive(count){
  const available = [];
  for(let i=0;i<TOTAL_CELLS;i++){
    if(!activeSet.has(i)) available.push(i);
  }
  if(available.length === 0) return [];

  const chosen = [];
  const target = clamp(count, 0, available.length);

  for(let k=0;k<target;k++){
    const r = Math.floor(Math.random() * available.length);
    chosen.push(available[r]);
    available.splice(r, 1);
  }
  return chosen;
}

function spawnWave(){
  if(!running) return;

  const { litCount, litMs } = settings[currentDifficulty];

  const picks = pickRandomInactive(litCount);
  for(const idx of picks){
    activateCell(idx, litMs);
  }

  spawnerTimeout = setTimeout(spawnWave, litMs);
}

function onCellClick(e){
  if(!running) return;

  const idx = Number(e.currentTarget.dataset.idx);

  if(activeSet.has(idx)){
    deactivateCell(idx);
    setScore(+5);
  } else {
    setScore(-2);
  }
}

function updateTimer(){
  if(!running) return;

  const elapsed = (performance.now() - gameStart) / 1000;
  const left = GAME_TIME - elapsed;

  const shown = left > 0 ? left : 0;
  timeLeftEl.textContent = shown.toFixed(1);

  timeLeftEl.classList.toggle("time-warning", left <= 5);

  if(left <= 0){
    finishGame();
    return;
  }
  rafId = requestAnimationFrame(updateTimer);
}

function resetRunState(){
  for(const idx of Array.from(activeSet)) deactivateCell(idx);
  for(const t of activeTimeouts.values()) clearTimeout(t);
  activeTimeouts.clear();
  activeSet.clear();

  if(spawnerTimeout) clearTimeout(spawnerTimeout);
  spawnerTimeout = null;

  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function startGame(){
  resetRunState();

  score = 0;
  scoreEl.textContent = "0";

  running = true;
  setRunningUI(true);

  gameStart = performance.now();
  applyResponsiveUIScaling();
  applyResponsiveGridSizing();

  timeLeftEl.textContent = `${GAME_TIME.toFixed(1)}`;
  timeLeftEl.classList.remove("time-warning");

  spawnWave();
  rafId = requestAnimationFrame(updateTimer);
}

function stopGame(){
  if(!running) return;
  running = false;
  setRunningUI(false);
  resetRunState();
}

function finishGame(){
  if(!running) return;

  running = false;
  setRunningUI(false);
  resetRunState();

  const prev = getBest();
  const isNew = prev === null || score > prev;
  if(isNew) setBest(score);

  const bestNow = getBest();

  finalScoreEl.textContent = String(score);
  bestScoreEl.textContent = String(bestNow ?? 0);

  const dict = i18n[currentLang];
  bestMetaEl.textContent = dict.best_meta(GRID_SIZE, currentDifficulty.toUpperCase(), isNew);

  showEndScreen();
}

/* Botões do jogo */
stopBtn.addEventListener("click", stopGame);
backBtn.addEventListener("click", () => {
  if(running) return;
  showStartScreen();
});

/* Botão START da tela inicial */
startFromScreenBtn.addEventListener("click", () => {
  showGameScreen();
  startGame();
});

/* Tela final */
playAgainBtn.addEventListener("click", () => {
  showGameScreen();
  startGame();
});
menuFromEndBtn.addEventListener("click", () => {
  showStartScreen();
});

/* Dificuldade (só no menu) */
function wireDifficultyButtons(){
  document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (running) return;

      document.querySelectorAll(".diff-btn")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
      currentDifficulty = btn.dataset.diff;

      updateMenuBestLabel();
    });
  });
}

/* Slider de tamanho do grid */
function wireGridSize(){
  const syncLabel = () => {
    const v = Number(gridSizeInput.value);
    gridSizeLabel.textContent = String(v);
    gridSizeLabel2.textContent = String(v);
  };

  gridSizeInput.addEventListener("input", () => {
    syncLabel();
    applyGridSize(Number(gridSizeInput.value));
  });

  syncLabel();
  applyGridSize(Number(gridSizeInput.value));
}

/* Idioma */
function wireLanguageButtons(){
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if(running) return;
      setLang(btn.dataset.lang);
    });
  });

  setLang(currentLang);
}

// Recalcula layout quando o viewport muda (iPhone Safari muda bastante com barras/teclado)
window.addEventListener("resize", () => {
  applyResponsiveUIScaling();
  applyResponsiveGridSizing();
});

if(window.visualViewport){
  window.visualViewport.addEventListener("resize", () => {
    applyResponsiveUIScaling();
    applyResponsiveGridSizing();
  });
  window.visualViewport.addEventListener("scroll", () => {
    applyResponsiveUIScaling();
    applyResponsiveGridSizing();
  });
}

wireDifficultyButtons();
wireGridSize();
wireLanguageButtons();
setRunningUI(false);
applyResponsiveUIScaling();
applyResponsiveGridSizing();
showStartScreen();
