const GRID_SIZE = 6;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

const settings = {
  easy:   { litCount: 1, litMs: 1600 },
  medium: { litCount: 2, litMs: 1300 },
  hard:   { litCount: 2, litMs: 900 },
};

const gridEl = document.getElementById("grid");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");

let cells = [];
let score = 0;

let running = false;
let gameStart = 0;
let rafId = null;

let activeSet = new Set();
let activeTimeouts = new Map();
let spawnerTimeout = null;

let currentDifficulty = "easy";

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function buildGrid(){
  gridEl.innerHTML = "";
  cells = [];

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
  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;

  // trava a dificuldade durante a partida
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
  const left = 30 - elapsed;

  const shown = left > 0 ? left : 0;
  timeLeftEl.textContent = shown.toFixed(1);

  timeLeftEl.classList.toggle("time-warning", left <= 5);

  if(left <= 0){
    stopGame();
    return;
  }
  rafId = requestAnimationFrame(updateTimer);
}

function startGame(){
  score = 0;
  scoreEl.textContent = "0";

  // limpa ativos
  for(const idx of Array.from(activeSet)) deactivateCell(idx);
  for(const t of activeTimeouts.values()) clearTimeout(t);
  activeTimeouts.clear();
  activeSet.clear();

  if(spawnerTimeout) clearTimeout(spawnerTimeout);
  if(rafId) cancelAnimationFrame(rafId);

  running = true;
  setRunningUI(true);

  gameStart = performance.now();
  timeLeftEl.textContent = "30.0";
  timeLeftEl.classList.remove("time-warning");

  spawnWave();
  rafId = requestAnimationFrame(updateTimer);
}

function stopGame(){
  if(!running) return;

  running = false;
  setRunningUI(false);

  if(spawnerTimeout) clearTimeout(spawnerTimeout);
  spawnerTimeout = null;

  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;

  for(const idx of Array.from(activeSet)) deactivateCell(idx);
}

startBtn.addEventListener("click", startGame);
stopBtn.addEventListener("click", stopGame);

/* Dificuldade (botões) */
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (running) return;

    document.querySelectorAll(".diff-btn")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
    currentDifficulty = btn.dataset.diff;
  });
});

buildGrid();

