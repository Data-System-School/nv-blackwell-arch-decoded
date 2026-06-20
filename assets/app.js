/* ===========================================================
   Blackwell, Decoded — shared behaviour
   - progress tracking (localStorage, file:// safe)
   - glossary hover/tap tooltips
   - active nav + completion checks
   - mobile sidebar, scroll progress
   =========================================================== */
(function(){
  "use strict";

  // ---- module registry (order = course order) ----
  var MODULES = [
    {id:"why",        file:"01-why-blackwell.html",  title:"Why Blackwell?"},
    {id:"scaling",    file:"02-scaling-laws.html",   title:"The Three Scaling Laws"},
    {id:"gpu",        file:"03-blackwell-gpu.html",  title:"The Blackwell GPU"},
    {id:"engines",    file:"04-the-engines.html",    title:"The Engines"},
    {id:"nvlink",     file:"05-nvlink.html",         title:"NVLink & Scaling Up"},
    {id:"gb300",      file:"06-gb300-nvl72.html",    title:"GB300 NVL72 Rack"},
    {id:"servers",    file:"07-gb200-and-hgx.html",  title:"GB200 & HGX Servers"},
    {id:"parallel",   file:"08-parallelism.html",    title:"Inference Deep-Dive"}
  ];
  var KEY = "nvbw-progress-v1";

  // ---- storage (degrade gracefully on file:// where it may be blocked) ----
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ return {}; } }
  function save(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }
  function done(id){ return !!load()[id]; }
  function setDone(id,v){ var o=load(); if(v){o[id]=1;}else{delete o[id];} save(o); }
  window.NVBW = {load:load, MODULES:MODULES, KEY:KEY};

  // ---- scroll progress bar ----
  var bar = document.getElementById("scrollbar");
  if(bar){
    window.addEventListener("scroll", function(){
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max>0 ? (h.scrollTop/max*100) : 0) + "%";
    }, {passive:true});
  }

  // ---- mobile sidebar ----
  var burger = document.querySelector(".burger");
  var scrim = document.querySelector(".scrim");
  function closeNav(){ document.body.classList.remove("nav-open"); }
  if(burger){ burger.addEventListener("click", function(){ document.body.classList.toggle("nav-open"); }); }
  if(scrim){ scrim.addEventListener("click", closeNav); }

  // ---- mark sidebar nav: active + done ----
  var here = (location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll(".nav a[data-file]").forEach(function(a){
    var f = a.getAttribute("data-file");
    if(f === here) a.classList.add("active");
    var id = a.getAttribute("data-id");
    if(id && done(id)) a.classList.add("done");
  });

  // ---- sidebar progress meter ----
  function pct(){ var n=0; MODULES.forEach(function(m){ if(done(m.id)) n++; }); return Math.round(n/MODULES.length*100); }
  function paintSidebarProg(){
    var f=document.querySelector(".sb-prog .fill"), t=document.querySelector(".sb-prog .count");
    var n=0; MODULES.forEach(function(m){ if(done(m.id)) n++; });
    if(f) f.style.width = pct()+"%";
    if(t) t.textContent = n+" / "+MODULES.length+" modules";
  }
  paintSidebarProg();

  // ---- per-module complete button ----
  var body = document.body;
  var modId = body.getAttribute("data-module");
  var btn = document.getElementById("completeBtn");
  function paintBtn(){
    if(!btn) return;
    if(done(modId)){ btn.classList.add("done-state"); btn.innerHTML = checkSVG()+" Completed"; }
    else { btn.classList.remove("done-state"); btn.innerHTML = "Mark this module complete"; }
  }
  if(btn && modId){
    paintBtn();
    btn.addEventListener("click", function(){
      setDone(modId, !done(modId));
      paintBtn(); paintSidebarProg();
      var link=document.querySelector('.nav a[data-id="'+modId+'"]');
      if(link) link.classList.toggle("done", done(modId));
    });
  }
  function checkSVG(){ return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.4l3.2 3.2L13 4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

  // ---- index page: big progress + cards ----
  var big = document.querySelector(".bigprog");
  if(big){
    var bf=big.querySelector(".fill"), bp=big.querySelector(".pct");
    if(bf) bf.style.width = pct()+"%";
    if(bp) bp.textContent = pct()+"% complete";
    document.querySelectorAll(".mcard[data-id]").forEach(function(c){
      if(done(c.getAttribute("data-id"))) c.classList.add("done");
    });
    var reset=document.querySelector(".reset");
    if(reset) reset.addEventListener("click", function(){ save({}); location.reload(); });
  }

  // ---- glossary tooltips ----
  var G = {};
  (window.GLOSSARY||[]).forEach(function(o){ G[o.t.toLowerCase()] = o; });
  var tip = document.createElement("div"); tip.className="tip"; document.body.appendChild(tip);
  var activeEl = null;
  function lookup(el){
    var key = (el.getAttribute("data-term") || el.textContent).toLowerCase().trim();
    return G[key] || findLoose(key);
  }
  function findLoose(key){
    for(var k in G){ if(k.indexOf(key)===0 || key.indexOf(k)===0) return G[k]; }
    return null;
  }
  function showTip(el){
    var o = lookup(el); if(!o) return;
    tip.innerHTML = "<b>"+o.t+"</b> &middot; "+o.c+"<br>"+o.d;
    activeEl = el;
    placeTip(el);                              // position + pick above/below before the reveal
    tip.classList.add("show");
  }
  function placeTip(el){
    // Inline terms can wrap across lines; getBoundingClientRect() returns the union box
    // whose centre falls in the gutter between fragments. Anchor to a real line box instead.
    var rects = el.getClientRects();
    var first = rects[0] || el.getBoundingClientRect();
    var last  = rects[rects.length - 1] || first;
    var tr = tip.getBoundingClientRect();
    var gap = 10;
    var aboveTop = first.top - tr.height - gap;
    var below = aboveTop < 8;                   // no room above → drop below the term
    var anchor = below ? last : first;          // sit above the first line, or below the last
    var top  = below ? last.bottom + gap : aboveTop;
    var cx   = anchor.left + anchor.width / 2;   // centre of the anchored line fragment
    var left = Math.max(8, Math.min(cx - tr.width / 2, window.innerWidth - tr.width - 8));
    tip.style.top = top + "px";
    tip.style.left = left + "px";
    tip.classList.toggle("below", below);
    // keep the caret pointing at the term even when the bubble is clamped to a screen edge
    var ax = Math.max(14, Math.min(cx - left, tr.width - 14));
    tip.style.setProperty("--ax", ax + "px");
  }
  function hideTip(){ tip.classList.remove("show"); activeEl=null; }
  document.querySelectorAll(".gloss").forEach(function(el){
    el.setAttribute("tabindex","0");
    el.addEventListener("mouseenter", function(){ showTip(el); });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function(){ showTip(el); });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", function(e){ e.preventDefault(); if(activeEl===el){hideTip();}else{showTip(el);} });
  });
  window.addEventListener("scroll", function(){ if(activeEl) placeTip(activeEl); }, {passive:true});
  document.addEventListener("click", function(e){ if(activeEl && !e.target.closest(".gloss")) hideTip(); });

})();
