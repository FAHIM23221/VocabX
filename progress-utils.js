/* প্র্যাকটিসের হিসাব-নিকাশের শেয়ার্ড লজিক — লেসন, বাক্য, ফ্ল্যাশকার্ড, হোম, সেটিংস সবাই একই নিয়ম ব্যবহার করে */

export const CHALLENGE_DAYS = 60;

// স্থানীয় সময়ের তারিখ (YYYY-MM-DD) — UTC না, যাতে রাতের দিকে দিন গোলমাল না হয়
export function localIso(d){
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseIso(iso){ const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
export function daysBetween(aIso, bIso){
  return Math.round((parseIso(bIso) - parseIso(aIso)) / 86400000);
}

/* ---------- দৈনিক স্ট্রিক + চ্যালেঞ্জ ---------- */
// আজকের প্র্যাকটিস গুনে নেয়। progress অবজেক্ট বদলায় আর যে ফিল্ডগুলো বদলেছে সেগুলো ফেরত দেয় (Firestore-এ merge করার জন্য)।
export function markPracticeToday(progress, now){
  now = now || new Date();
  const today = now.toDateString();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (progress.lastDay !== today){
    progress.streak = (progress.lastDay === y.toDateString()) ? (progress.streak || 0) + 1 : 1;
    progress.lastDay = today;
  }
  const iso = localIso(now);
  if (!Array.isArray(progress.practiceDates)) progress.practiceDates = [];
  if (!progress.practiceDates.includes(iso)) progress.practiceDates.push(iso);
  progress.practiceDates = progress.practiceDates.slice(-14);

  const out = { streak: progress.streak, lastDay: progress.lastDay, practiceDates: progress.practiceDates };

  const ch = progress.challenge;
  if (ch && ch.start){
    const idx = daysBetween(ch.start, iso) + 1;
    if (idx >= 1 && idx <= (ch.days || CHALLENGE_DAYS)){
      if (!Array.isArray(ch.done)) ch.done = [];
      if (!ch.done.includes(iso)) ch.done.push(iso);
    }
    out.challenge = ch;
  }
  return out;
}

export function startChallenge(progress, now){
  const iso = localIso(now);
  const done = (Array.isArray(progress.practiceDates) && progress.practiceDates.includes(iso)) ? [iso] : [];
  progress.challenge = { start: iso, days: CHALLENGE_DAYS, done };
  return progress.challenge;
}

export function challengeInfo(progress, now){
  const ch = progress && progress.challenge;
  if (!ch || !ch.start) return { started:false };
  const iso = localIso(now);
  const days = ch.days || CHALLENGE_DAYS;
  const done = Array.isArray(ch.done) ? ch.done : [];
  const dayNo = daysBetween(ch.start, iso) + 1;
  const doneCount = Math.min(days, done.length);
  return {
    started: true, days, doneCount,
    percent: Math.round((doneCount / days) * 100),
    dayNo: Math.max(1, Math.min(dayNo, days)),
    todayDone: done.includes(iso),
    finished: doneCount >= days || dayNo > days
  };
}

/* ---------- দৈনিক লক্ষ্য (কতটা লেসন/সেশন আজ) ---------- */
export function sessionsToday(progress, now){
  const t = progress && progress.todayLessons;
  return (t && t.date === localIso(now)) ? (t.count || 0) : 0;
}
export function bumpSessionsToday(progress, now){
  const iso = localIso(now);
  const n = (progress.todayLessons && progress.todayLessons.date === iso) ? (progress.todayLessons.count || 0) : 0;
  progress.todayLessons = { date: iso, count: n + 1 };
  return progress.todayLessons;
}
export function dailyGoal(progress){
  const g = Number(progress && progress.dailyGoal);
  return (g >= 1 && g <= 5) ? g : 1;
}

/* ---------- লেভেল ---------- */
// লেভেল বাছা থাকলে সেই লেভেল পর্যন্ত শব্দ আসবে; না থাকলে সব শব্দ। পুল খুব ছোট হলে সব শব্দেই ফিরে যায়।
export function poolForLevel(words, progress, minSize){
  const L = Number(progress && progress.level);
  if (!L) return words;
  const pool = words.filter(w => (w.level || 1) <= L);
  return pool.length >= (minSize || 5) ? pool : words;
}

/* ---------- শেখার সময় ---------- */
export function formatDuration(totalSec){
  const m = Math.floor((totalSec || 0) / 60);
  if (m < 60) return { h: 0, m };
  return { h: Math.floor(m / 60), m: m % 60 };
}

/* ---------- বাক্য গঠনের বাক্য-তালিকা ---------- */
// ৪ থেকে ১০ শব্দের বাক্যগুলোই সাজানোর উপযোগী (বেশি ছোট বা বেশি লম্বা হলে অনুশীলন ভালো হয় না)
export function allSentences(words){
  const out = [];
  words.forEach(w => {
    const ex = (Array.isArray(w.examples) && w.examples.length) ? w.examples : (w.example ? [w.example] : []);
    ex.forEach((text, i) => {
      const t = String(text).trim();
      const n = t.split(/\s+/).length;
      if (n >= 4 && n <= 10) out.push({ key: w.id + ":" + i, wordId: w.id, word: w.word, bn: w.bn, text: t });
    });
  });
  return out;
}
