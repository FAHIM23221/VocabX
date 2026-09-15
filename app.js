/* ---------- state ---------- */
let WORDS = [];
let flashIndex = 0;
let quizIndex = 0;
let quizScore = 0;
let quizOrder = [];
let quizAnswered = false;

const STORAGE_KEY = "vocabo_progress_v1";

function loadProgress(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { known: {}, streak: 0, lastDay: null };
  }catch(e){
    return { known: {}, streak: 0, lastDay: null };
  }
}
function saveProgress(p){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
function bumpStreak(){
  const p = loadProgress();
  const today = new Date().toDateString();
  if (p.lastDay !== today){
    p.streak = (p.lastDay === yesterday()) ? p.streak + 1 : 1;
    p.lastDay = today;
    saveProgress(p);
  }
  return p;
}
function yesterday(){
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

/* ---------- boot ---------- */
async function init(){
  const res = await fetch("words.json");
  WORDS = await res.json();
  quizOrder = shuffledIndices(WORDS.length);

  const p = bumpStreak();
  renderStats(p);

  setupTabs();
  setupFlashcard();
  setupQuiz();

  renderFlashcard();
  renderQuizQuestion();
}

function renderStats(p){
  const knownCount = Object.values(p.known).filter(Boolean).length;
  document.getElementById("streakStat").textContent = `🔥 ${toBn(p.streak)}`;
  document.getElementById("countStat").textContent = `${toBn(knownCount)} / ${toBn(WORDS.length)}`;
}

function toBn(n){
  const digits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).split("").map(c => /[0-9]/.test(c) ? digits[c] : c).join("");
}

function shuffledIndices(n){
  const arr = Array.from({length:n}, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- tabs ---------- */
function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const mode = btn.dataset.mode;
      document.getElementById("flashView").classList.toggle("is-hidden", mode !== "flash");
      document.getElementById("quizView").classList.toggle("is-hidden", mode !== "quiz");
      document.getElementById("doneView").classList.add("is-hidden");
    });
  });
}

/* ---------- flashcards ---------- */
function setupFlashcard(){
  const card = document.getElementById("flashcard");
  card.addEventListener("click", () => card.classList.toggle("is-flipped"));

  document.getElementById("flashPrev").addEventListener("click", (e) => {
    e.stopPropagation();
    flashIndex = (flashIndex - 1 + WORDS.length) % WORDS.length;
    renderFlashcard();
  });
  document.getElementById("flashNext").addEventListener("click", (e) => {
    e.stopPropagation();
    flashIndex = (flashIndex + 1) % WORDS.length;
    renderFlashcard();
  });

  document.getElementById("btnKnow").addEventListener("click", () => markWord(true));
  document.getElementById("btnDontKnow").addEventListener("click", () => markWord(false));
}

function markWord(knowsIt){
  const w = WORDS[flashIndex];
  const p = loadProgress();
  p.known[w.id] = knowsIt;
  saveProgress(p);
  renderStats(p);
  flashIndex = (flashIndex + 1) % WORDS.length;
  renderFlashcard();
}

function renderFlashcard(){
  const w = WORDS[flashIndex];
  document.getElementById("flashcard").classList.remove("is-flipped");
  document.getElementById("frontPos").textContent = w.pos;
  document.getElementById("frontWord").textContent = w.word;
  document.getElementById("backBn").textContent = w.bn;
  document.getElementById("backExample").textContent = w.example;
  document.getElementById("flashProgress").textContent = `শব্দ ${toBn(flashIndex + 1)} / ${toBn(WORDS.length)}`;
}

/* ---------- quiz ---------- */
function setupQuiz(){
  document.getElementById("quizNextBtn").addEventListener("click", () => {
    if (quizIndex + 1 >= quizOrder.length){
      showDone();
      return;
    }
    quizIndex++;
    renderQuizQuestion();
  });
  document.getElementById("restartBtn").addEventListener("click", () => {
    quizIndex = 0;
    quizScore = 0;
    quizOrder = shuffledIndices(WORDS.length);
    document.getElementById("doneView").classList.add("is-hidden");
    document.getElementById("quizView").classList.remove("is-hidden");
    renderQuizQuestion();
  });
}

function renderQuizQuestion(){
  quizAnswered = false;
  const w = WORDS[quizOrder[quizIndex]];
  document.getElementById("quizProgress").textContent = `প্রশ্ন ${toBn(quizIndex + 1)} / ${toBn(quizOrder.length)}`;
  document.getElementById("quizWord").textContent = w.word;
  document.getElementById("quizFeedback").textContent = "";
  document.getElementById("quizNextBtn").disabled = true;

  const distractors = WORDS.filter(x => x.id !== w.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(x => x.bn);
  const options = [...distractors, w.bn].sort(() => Math.random() - 0.5);
  const letters = ["ক","খ","গ","ঘ"];

  const list = document.getElementById("quizOptions");
  list.innerHTML = "";
  options.forEach((opt, i) => {
    const li = document.createElement("li");
    li.className = "option";
    li.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt}</span>`;
    li.addEventListener("click", () => handleAnswer(li, opt, w.bn));
    list.appendChild(li);
  });
}

function handleAnswer(li, chosen, correctBn){
  if (quizAnswered) return;
  quizAnswered = true;

  document.querySelectorAll(".option").forEach(el => {
    if (el.textContent.includes(correctBn)) el.classList.add("correct");
  });

  if (chosen === correctBn){
    quizScore++;
    document.getElementById("quizFeedback").textContent = "দারুন! উত্তরটি সঠিক হয়েছে।";
    document.getElementById("quizFeedback").style.color = "var(--leaf)";
  } else {
    li.classList.add("wrong");
    document.getElementById("quizFeedback").textContent = "উত্তরটি সঠিক হয়নি, সঠিক উত্তরটি দেখো।";
    document.getElementById("quizFeedback").style.color = "var(--terracotta)";
  }
  document.getElementById("quizNextBtn").disabled = false;
}

function showDone(){
  document.getElementById("quizView").classList.add("is-hidden");
  document.getElementById("doneView").classList.remove("is-hidden");
  document.getElementById("doneScore").textContent = toBn(quizScore);
}

init();
