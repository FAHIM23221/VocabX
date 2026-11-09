/* ছোট সাউন্ড ইফেক্ট (Web Audio API দিয়ে তৈরি — কোনো বাইরের ফাইল লাগে না)
   আর উচ্চারণ শোনার জন্য ব্রাউজারের বিল্ট-ইন TTS */

let audioCtx = null;
function getCtx(){
  if (!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function tone(freq, startOffset, duration, type, gain){
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(gain || 0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export function playCorrectSound(){
  tone(660, 0, 0.12, "sine", 0.14);
  tone(880, 0.1, 0.18, "sine", 0.14);
}

export function playWrongSound(){
  tone(320, 0, 0.22, "sawtooth", 0.08);
}

export function speak(text, lang){
  if (!("speechSynthesis" in window) || !text) return;
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "en-US";
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }catch(e){ /* TTS না থাকলে চুপচাপ এড়িয়ে যাও */ }
}
