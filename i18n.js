/* বাংলা ⇄ ইংরেজি টগল — ক্লিক করলে পুরো পেজের লেখা এক সাথে বদলে যায়।
   কীভাবে কাজ করে: অ্যাপের কোড বাংলাতেই লেখা থাকে; ইংরেজি মোডে পেজে দেখানো লেখাগুলো অভিধান (i18n-en.js) দিয়ে বদলে দেওয়া হয়,
   আর বাংলায় ফিরলে হুবহু আগের লেখা ফিরে আসে। পরে যোগ হওয়া লেখাও (MutationObserver) নিজে থেকে অনুবাদ হয়।
   শব্দের বাংলা অর্থ, ইউজারের নিজের লেখা মেসেজ ইত্যাদি অনুবাদ হয় না। */
(function(){
  "use strict";
  var KEY = "vocabx_lang";
  var lang = (localStorage.getItem(KEY) === "en") ? "en" : "bn";
  var D = window.VOCABX_EN || { phrases: {}, patterns: [] };
  var HAS_BN = /[\u0980-\u09FF]/;
  var BNL = "\\u0980-\\u09E5\\u09F0-\\u09FF";            // বাংলা অক্ষর/চিহ্ন (সংখ্যা বাদে)
  // অনুবাদ হবে না এমন জায়গা: শব্দের অর্থ, ইউজারের লেখা, স্ক্রিপ্ট/স্টাইল ইত্যাদি
  var NOTR = '[translate="no"], .notranslate, script, style, textarea, .bub, #backBn, .option > span:not(.letter), ' +
             '.match-card[data-side="right"], .word-card .bn, .review-card .m, .bm-item .m, .bn-text, .pron, .pr';

  var keys = Object.keys(D.phrases).sort(function(a, b){ return b.length - a.length; });
  var phraseRe = keys.length ? new RegExp(
    "(^|[^" + BNL + "])(" + keys.map(function(k){ return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")(?![" + BNL + "])", "g"
  ) : null;

  function tr(s){
    if (!s || !HAS_BN.test(s)) return s;
    var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var core = m[2].replace(/\s+/g, " ");
    D.patterns.forEach(function(p){ core = core.replace(p[0], p[1]); });
    if (phraseRe){
      core = core.replace(phraseRe, function(all, pre, ph){
        return pre + (D.phrases[ph] !== undefined ? D.phrases[ph] : ph);
      });
    }
    core = core.replace(/[\u09E6-\u09EF]/g, function(d){ return String(d.charCodeAt(0) - 0x09E6); });
    core = core.replace(/ +([.,!?;:])/g, "$1").replace(/ {2,}/g, " ").trim();
    core = core.replace(/\b1 (day|lesson|word|sentence)s\b/g, "1 $1");
    return m[1] + core + m[3];
  }
  function trLines(s){ return String(s).split("\n").map(tr).join("\n"); }

  var tracked = new Set();
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];

  function skipEl(el){ return !el || (el.closest && el.closest(NOTR)); }
  // অ্যাট্রিবিউট (placeholder ইত্যাদি) UI-এর লেখা — textarea/.bub-এর মতো ইউজারের-লেখা-ধারক বাদ দেওয়া ঠিক না; শুধু স্পষ্টভাবে অনুবাদ-বহির্ভূত জায়গা বাদ
  function skipAttrEl(el){ return !el || (el.closest && el.closest('[translate="no"], .notranslate, script, style, .match-card[data-side="right"], .bn-text')); }

  function doText(node){
    if (lang !== "en") return;
    var v = node.nodeValue;
    if (node.__en !== undefined && v === node.__en) return;          // আমাদের নিজের বসানো লেখা
    if (!HAS_BN.test(v)) return;
    if (skipEl(node.parentElement)) return;
    var out = tr(v);
    if (out !== v){ node.__bn = v; node.__en = out; node.nodeValue = out; tracked.add(node); }
  }
  function doAttrs(el){
    if (lang !== "en" || !el.getAttribute || skipAttrEl(el)) return;
    ATTRS.forEach(function(a){
      var v = el.getAttribute(a);
      if (!v || !HAS_BN.test(v)) return;
      if (el.__enA && el.__enA[a] === v) return;
      var out = tr(v);
      if (out !== v){
        el.__bnA = el.__bnA || {}; el.__enA = el.__enA || {};
        el.__bnA[a] = v; el.__enA[a] = out;
        el.setAttribute(a, out);
        tracked.add(el);
      }
    });
  }
  function walk(root){
    if (root.nodeType === 3){ doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var el = root.nodeType === 9 ? root.documentElement : root;
    doAttrs(el);
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = w.nextNode())){ if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function restoreAll(){
    tracked.forEach(function(n){
      if (n.nodeType === 3){
        if (n.__bn !== undefined){ n.nodeValue = n.__bn; n.__en = undefined; }
      } else if (n.__bnA){
        Object.keys(n.__bnA).forEach(function(a){ n.setAttribute(a, n.__bnA[a]); });
        n.__enA = {};
      }
    });
    tracked.clear();
  }

  function setLang(next){
    lang = next;
    try{ localStorage.setItem(KEY, lang); }catch(e){}
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "bn");
    var b = document.getElementById("langToggleBtn");
    if (b) b.textContent = lang === "en" ? "বাং" : "EN";
    if (lang === "en") walk(document); else restoreAll();
  }

  // alert / confirm / prompt-এর লেখাও (ইংরেজি মোডে) অনুবাদ হবে
  ["alert", "confirm", "prompt"].forEach(function(fn){
    var orig = window[fn];
    window[fn] = function(msg){
      var args = Array.prototype.slice.call(arguments);
      if (lang === "en" && typeof msg === "string") args[0] = trLines(msg);
      return orig.apply(window, args);
    };
  });

  function mountToggle(){
    var themeBtn = document.getElementById("themeToggleBtn") || document.getElementById("themeToggle");
    if (!themeBtn) return;                       // লেসন পেজের মতো পরিষ্কার পেজে বাটন নেই; সংরক্ষিত ভাষা তবু কাজ করে
    var b = document.createElement("button");
    b.type = "button";
    b.id = "langToggleBtn";
    b.className = themeBtn.className;
    b.setAttribute("translate", "no");
    b.setAttribute("aria-label", "Language");
    b.style.fontSize = "0.68rem";
    b.style.fontWeight = "700";
    b.style.fontFamily = "'Hind Siliguri', sans-serif";
    b.textContent = lang === "en" ? "বাং" : "EN";
    themeBtn.parentNode.insertBefore(b, themeBtn);
    var cs = window.getComputedStyle(themeBtn);
    if (cs.position === "absolute"){               // লগইন পেজের কোণায় বসানো থিম বাটনের পাশে
      var r = parseFloat(cs.right) || 0, w = parseFloat(cs.width) || 40;
      b.style.right = (r + w + 8) + "px";
    }
    b.addEventListener("click", function(){ setLang(lang === "en" ? "bn" : "en"); });
  }

  function start(){
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "bn");
    mountToggle();
    new MutationObserver(function(muts){
      if (lang !== "en") return;
      muts.forEach(function(m){
        if (m.type === "childList"){ m.addedNodes.forEach(walk); }
        else if (m.type === "characterData"){ doText(m.target); }
        else if (m.type === "attributes"){ doAttrs(m.target); }
      });
    }).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    if (lang === "en") walk(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.VocabXi18n = { tr: tr, setLang: setLang, get lang(){ return lang; } };
})();
