/* সাবস্ক্রিপশন সংক্রান্ত শেয়ার্ড হেল্পার — ইউজার পেজ, হোম, আর অ্যাডমিন প্যানেল একই লজিক ব্যবহার করে */

// ইউজার ডকুমেন্ট থেকে সাবস্ক্রিপশনের আসল অবস্থা বের করে।
// মেয়াদ শেষ হলে নিজে থেকেই active=false হয়ে যায় (ডেটাবেজে কিছু লিখতে হয় না)।
export function subscriptionInfo(userData, now){
  now = now || new Date();
  const none = { active:false, expiresAt:null, daysLeft:0 };
  if (!userData || !userData.subscriptionActive) return none;
  const s = userData.subscriptionStartedAt, days = Number(userData.subscriptionDays);
  if (!s || !days) return none;
  const start = s.toDate ? s.toDate() : new Date(s);
  const expiresAt = new Date(start.getTime() + days * 86400000);
  const ms = expiresAt - now;
  return { active: ms > 0, expiresAt, daysLeft: Math.max(0, Math.ceil(ms / 86400000)) };
}

// কোডে ০/১/I/O বাদ — যাতে হাতে লিখতে বা পড়তে ভুল না হয়
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomChars(n){
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}
export function generateCode(){ return "VX-" + randomChars(5) + "-" + randomChars(5); }

// ইউজার যেভাবেই লিখুক (ছোট হাতের, স্পেসসহ, ড্যাশ ছাড়া) — একই ফরম্যাটে আনে
export function normalizeCode(input){
  const raw = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length === 12 && raw.startsWith("VX")) return "VX-" + raw.slice(2, 7) + "-" + raw.slice(7);
  return String(input || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function fmtDateBn(d){
  if (!d) return "—";
  return d.toLocaleDateString("bn-BD", { year:"numeric", month:"long", day:"numeric" });
}
