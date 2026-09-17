import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ---------- state ---------- */
let WORDS = [];
let currentUser = null;
let progress = { strength: {}, streak: 0, lastDay: null }; // strength: { wordId(string): 0-5 }

let flashHistory = [];   // history stack of word objects for flashcard prev/next
let flashPointer = -1;

let quizWord = null;
let quizAnswered = false;
let quizScore = 0;
let quizCount = 0;
const QUIZ_SESSION_LENGTH = 20;
let retryQueue = []; // [{ id, dueAt }] — dueAt is a quizCount value

const MASTERED_AT = 4; // strength >= this counts as "known" for stats

/* ---------- auth gate ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user){
    window.location.href = "login.html";
    return;
  }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() && snap.data().banned){
    await signOut(auth);
    alert("তোমার অ্যাকাউন্ট নিষিদ্ধ (ব্যান) করা হয়েছে। সাহায্যের জন্য অ্যাডমিনের সাথে যোগাযোগ করো।");
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  await init();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

/* ---------- boot ---------- */
async function init(){
  const res = await fetch("words.json");
  WORDS = await res.json();

  await loadProgress();
  bumpStreak();
  await saveProgress();
  renderStats();

  setupTabs();
  setupFlashcard();
  setupQuiz();

  goToNextFlashcard();
  startNewQuizQuestion();
}

function progressDocRef(){
  return doc(db, "users", currentUser.uid, "progress", "data");
}

async function loadProgress(){
  const snap = await getDoc(progressDocRef());
  if (snap.exists()){
    const data = snap.data();
    progress = {
      strength: data.strength || {},
      streak: data.streak || 0,
      lastDay: data.lastDay || null
    };
  } else {
    progress = { strength: {}, streak: 0, lastDay: null };
  }
}

async function saveProgress(){
  await setDoc(progressDocRef(), progress);
}

function bumpStreak(){
  const today = new Date().toDateString();
  if (progress.lastDay !== today){
    progress.streak = (progress.lastDay === yesterdayStr()) ? (progress.streak || 0) + 1 : 1;
    progress.lastDay = today;
  }
}
function yesterdayStr(){
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

function renderStats(){
  const masteredCount = WORDS.filter(w => getStrength(w.id) >= MASTERED_AT).length;
  document.getElementById("streakStat").textContent = `🔥 ${toBn(progress.streak)}`;
  document.getElementById("countStat").textContent = `${toBn(masteredCount)} / ${toBn(WORDS.length)}`;
}

function toBn(n){
  const digits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).split("").map(c => /[0-9]/.test(c) ? digits[c] : c).join("");
}

/* ---------- mastery helpers ---------- */
function getStrength(id){
  return progress.strength[String(id)] || 0;
}
function bumpStrength(id, delta){
  const cur = getStrength(id);
  progress.strength[String(id)] = Math.max(0, Math.min(5, cur + delta));
}

/* ---------- weighted adaptive pick ---------- */
// দুর্বল (কম strength) শব্দ বেশিবার সামনে আসবে, একদম শেষেরটা আবার এড়ানো হবে
function weightedPick(excludeId){
  const pool = WORDS.filter(w => w.id !== excludeId);
  const weights = pool.map(w => 6 - getStrength(w.id)); // strength 0 → weight 6, strength 5 → weight 1
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++){
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
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
      if (mode === "quiz") document.getElementById("quizView").classList.remove("is-hidden");
    });
  });
}

/* ---------- flashcards ---------- */
function setupFlashcard(){
  const card = document.getElementById("flashcard");
  card.addEventListener("click", () => card.classList.toggle("is-flipped"));

  document.getElementById("flashPrev").addEventListener("click", (e) => {
    e.stopPropagation();
    if (flashPointer > 0){
      flashPointer--;
      renderFlashcard(flashHistory[flashPointer]);
    }
  });
  document.getElementById("flashNext").addEventListener("click", (e) => {
    e.stopPropagation();
    goToNextFlashcard();
  });

  document.getElementById("btnKnow").addEventListener("click", () => markWord(true));
  document.getElementById("btnDontKnow").addEventListener("click", () => markWord(false));
}

function goToNextFlashcard(){
  if (flashPointer < flashHistory.length - 1){
    flashPointer++;
    renderFlashcard(flashHistory[flashPointer]);
    return;
  }
  const prevId = flashHistory[flashPointer] ? flashHistory[flashPointer].id : null;
  const w = weightedPick(prevId);
  flashHistory.push(w);
  flashPointer = flashHistory.length - 1;
  renderFlashcard(w);
}

function markWord(knowsIt){
  const w = flashHistory[flashPointer];
  bumpStrength(w.id, knowsIt ? 1 : -1);
  saveProgress();
  renderStats();
  goToNextFlashcard();
}

function renderFlashcard(w){
  document.getElementById("flashcard").classList.remove("is-flipped");
  document.getElementById("frontPos").textContent = w.pos;
  document.getElementById("frontWord").textContent = w.word;
  document.getElementById("backBn").textContent = w.bn;
  document.getElementById("backExample").textContent = w.example;
  document.getElementById("flashProgress").textContent = `শব্দ ${toBn(flashPointer + 1)}`;

  const dotsEl = document.getElementById("strengthDots");
  const strength = getStrength(w.id);
  dotsEl.innerHTML = "";
  for (let i = 0; i < 5; i++){
    const dot = document.createElement("span");
    dot.className = "dot" + (i < strength ? " filled" : "");
    dotsEl.appendChild(dot);
  }
}

/* ---------- quiz ---------- */
function setupQuiz(){
  document.getElementById("quizNextBtn").addEventListener("click", () => {
    if (quizCount >= QUIZ_SESSION_LENGTH){
      showDone();
      return;
    }
    startNewQuizQuestion();
  });
  document.getElementById("restartBtn").addEventListener("click", () => {
    quizCount = 0;
    quizScore = 0;
    retryQueue = [];
    document.getElementById("doneView").classList.add("is-hidden");
    document.getElementById("quizView").classList.remove("is-hidden");
    startNewQuizQuestion();
  });
}

function pickQuizWord(){
  // আগে চেক করো রিট্রাই-কিউতে কোনো শব্দ এখন ফেরত আনার সময় হয়েছে কিনা
  const dueIndex = retryQueue.findIndex(item => item.dueAt <= quizCount);
  if (dueIndex !== -1){
    const item = retryQueue.splice(dueIndex, 1)[0];
    const w = WORDS.find(x => x.id === item.id);
    if (w) return w;
  }
  return weightedPick(quizWord ? quizWord.id : null);
}

function startNewQuizQuestion(){
  quizCount++;
  quizAnswered = false;
  quizWord = pickQuizWord();

  document.getElementById("quizProgress").textContent = `প্রশ্ন ${toBn(quizCount)} / ${toBn(QUIZ_SESSION_LENGTH)}`;
  document.getElementById("quizWord").textContent = quizWord.word;
  document.getElementById("quizFeedback").textContent = "";
  document.getElementById("quizNextBtn").disabled = true;

  const distractors = WORDS.filter(x => x.id !== quizWord.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(x => x.bn);
  const options = [...distractors, quizWord.bn].sort(() => Math.random() - 0.5);
  const letters = ["ক","খ","গ","ঘ"];

  const list = document.getElementById("quizOptions");
  list.innerHTML = "";
  options.forEach((opt, i) => {
    const li = document.createElement("li");
    li.className = "option";
    li.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt}</span>`;
    li.addEventListener("click", () => handleAnswer(li, opt));
    list.appendChild(li);
  });
}

function handleAnswer(li, chosen){
  if (quizAnswered) return;
  quizAnswered = true;

  const correctBn = quizWord.bn;
  document.querySelectorAll(".option").forEach(el => {
    if (el.textContent.includes(correctBn)) el.classList.add("correct");
  });

  if (chosen === correctBn){
    quizScore++;
    bumpStrength(quizWord.id, 1);
    document.getElementById("quizFeedback").textContent = "দারুন! উত্তরটি সঠিক হয়েছে।";
    document.getElementById("quizFeedback").style.color = "var(--leaf)";
  } else {
    li.classList.add("wrong");
    bumpStrength(quizWord.id, -1);
    retryQueue.push({ id: quizWord.id, dueAt: quizCount + 3 });
    document.getElementById("quizFeedback").textContent = "উত্তরটি সঠিক হয়নি, সঠিক উত্তরটি দেখো।";
    document.getElementById("quizFeedback").style.color = "var(--terracotta)";
  }

  saveProgress();
  renderStats();
  document.getElementById("quizNextBtn").disabled = false;
}

function showDone(){
  document.getElementById("quizView").classList.add("is-hidden");
  document.getElementById("doneView").classList.remove("is-hidden");
  document.getElementById("doneScore").textContent = toBn(quizScore);
}
