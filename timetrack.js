/* শেখার সময় ট্র্যাকিং — শুধু যখন পেজ খোলা (visible) এবং ইউজার সক্রিয়, তখনই সেকেন্ড গোনে।
   ৬০ সেকেন্ড কিছু না করলে "নিষ্ক্রিয়" ধরে গোনা থামে। প্রতি ৩০ সেকেন্ডে আর পেজ লুকানোর সময় Firestore-এ যোগ হয়। */
import { doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { localIso } from "./progress-utils.js";

export function startTimeTracking(db, uid){
  const IDLE_MS = 60000;
  let acc = 0, flushing = false, lastActive = Date.now();

  const bump = () => { lastActive = Date.now(); };
  ["pointerdown", "keydown", "touchstart", "scroll", "click"].forEach(ev =>
    window.addEventListener(ev, bump, { passive: true })
  );

  setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActive < IDLE_MS) acc += 1;
  }, 1000);

  async function flush(){
    const n = Math.floor(acc);
    if (n < 1 || flushing) return;
    acc -= n;
    flushing = true;
    try{
      await setDoc(doc(db, "users", uid, "progress", "data"), {
        learningSeconds: increment(n),
        learningByDay: { [localIso()]: increment(n) }
      }, { merge: true });
    }catch(e){
      acc += n; // ব্যর্থ হলে পরের বার আবার চেষ্টা হবে
    }
    flushing = false;
  }

  setInterval(flush, 30000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
}
