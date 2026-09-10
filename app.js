
(() => {
  const STORAGE_KEY = "pineridge-chambers-v01";
  const APP_VERSION = "0.1";
  const detailsKeys = ["chamberName","customer","action","actionSn","cartridge","barrel","barrelSn"];
  let records = [];
  let activeId = null;
  let activeFieldId = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const nowIso = () => new Date().toISOString();
  const id = () => "ch_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
  };
  const today = () => {
    const d = new Date();
    return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  };
  const blankRecord = (name="Untitled Chamber") => {
    const values = {};
    window.CHAMBER_FIELDS.forEach(f => values[f.id] = "");
    values.date = today();
    return {
      id:id(), name, customer:"", action:"", actionSn:"", cartridge:"", barrel:"", barrelSn:"",
      values, createdAt:nowIso(), updatedAt:nowIso()
    };
  };
  function load(){
    try{ records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }catch{ records=[]; }
    if(!records.length){
      const r = blankRecord("New Chamber");
      records=[r]; activeId=r.id; saveAll();
    } else {
      activeId = localStorage.getItem(STORAGE_KEY+"-active") || records[0].id;
      if(!records.some(r=>r.id===activeId)) activeId=records[0].id;
    }
  }
  function saveAll(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem(STORAGE_KEY+"-active", activeId || "");
  }
  function active(){ return records.find(r=>r.id===activeId); }
  function toast(msg){
    const t=$("#toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(t._to); t._to=setTimeout(()=>t.classList.remove("show"),1300);
  }
  function renderFields(){
    const sheet=$("#sheet");
    sheet.querySelectorAll(".overlay").forEach(x=>x.remove());
    window.CHAMBER_FIELDS.forEach((f,idx)=>{
      const el=document.createElement(f.multiline ? "textarea" : "input");
      el.className="overlay";
      el.dataset.field=f.id;
      el.dataset.index=idx;
      el.setAttribute("aria-label", f.label);
      el.style.left=f.left+"%";
      el.style.top=f.top+"%";
      el.style.width=f.width+"%";
      el.style.height=f.height+"%";
      if(!f.multiline){
        el.type="text";
        el.inputMode=f.inputmode;
        el.autocomplete="off";
        el.spellcheck=false;
      }
      el.placeholder=f.multiline ? "" : "Tap";
      el.addEventListener("focus",()=>openQuick(f.id));
      el.addEventListener("input",()=>updateValue(f.id,el.value,true));
      sheet.appendChild(el);
    });
  }
  function renderRecord(){
    const r=active(); if(!r)return;
    $("#chamberName").value=r.name || "";
    $("#customer").value=r.customer || "";
    $("#action").value=r.action || "";
    $("#actionSn").value=r.actionSn || "";
    $("#cartridge").value=r.cartridge || "";
    $("#barrel").value=r.barrel || "";
    $("#barrelSn").value=r.barrelSn || "";
    $$(".overlay").forEach(el=>{
      const v=(r.values||{})[el.dataset.field] || "";
      el.value=v;
      el.classList.toggle("hasValue",!!v);
    });
    $("#savedStatus").textContent="Autosaved locally • "+fmt(r.updatedAt);
    renderList();
  }
  function renderList(){
    const q=$("#search").value.trim().toLowerCase();
    const list=$("#chamberList"); list.innerHTML="";
    const filtered=[...records]
      .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))
      .filter(r=>!q || [r.name,r.cartridge,r.customer,r.reamer].join(" ").toLowerCase().includes(q));
    if(!filtered.length){ list.innerHTML='<div class="empty">No chambers match that search.</div>'; return; }
    filtered.forEach(r=>{
      const b=document.createElement("button");
      b.className="chamberItem"+(r.id===activeId?" active":"");
      b.innerHTML=`<b>${escapeHtml(r.name||"Untitled Chamber")}</b><small>${escapeHtml(r.cartridge||"No cartridge")} • ${fmt(r.updatedAt)}</small>`;
      b.onclick=()=>{activeId=r.id;saveAll();renderRecord();closeDrawer();};
      list.appendChild(b);
    });
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function touch(){
    const r=active(); if(!r)return;
    r.updatedAt=nowIso(); saveAll();
    $("#savedStatus").textContent="Autosaved locally • just now";
  }
  function updateValue(fid,val,fromOverlay=false){
    const r=active(); if(!r)return;
    r.values ||= {}; r.values[fid]=val;
    const o=$(`.overlay[data-field="${fid}"]`);
    if(o && (!fromOverlay || o.value!==val)) o.value=val;
    if(o) o.classList.toggle("hasValue",!!val);
    if(activeFieldId===fid && $("#quickInput").value!==val) $("#quickInput").value=val;
    touch();
  }
  function bindDetails(){
    const mapping = {
      chamberName:"name", customer:"customer", action:"action", actionSn:"actionSn",
      cartridge:"cartridge", barrel:"barrel", barrelSn:"barrelSn"
    };
    Object.entries(mapping).forEach(([elId,key])=>{
      $("#"+elId).addEventListener("input",e=>{
        const r=active(); if(!r)return;
        r[key]=e.target.value; touch(); renderList();
      });
    });
  }
  function openQuick(fid){
    activeFieldId=fid;
    const f=window.CHAMBER_FIELDS.find(x=>x.id===fid);
    const r=active(); if(!f||!r)return;
    $("#quickLabel").textContent=f.label;
    $("#quickInput").inputMode=f.inputmode;
    $("#quickInput").value=(r.values||{})[fid]||"";
    $("#quickEditor").classList.add("open");
    // Do not automatically steal focus from the on-sheet input on first tap.
  }
  function focusQuick(){
    $("#quickInput").focus();
    $("#quickInput").select();
  }
  function move(delta){
    if(activeFieldId==null)return;
    const idx=window.CHAMBER_FIELDS.findIndex(f=>f.id===activeFieldId);
    let next=(idx+delta+window.CHAMBER_FIELDS.length)%window.CHAMBER_FIELDS.length;
    const f=window.CHAMBER_FIELDS[next];
    const el=$(`.overlay[data-field="${f.id}"]`);
    if(el){el.focus();setTimeout(focusQuick,50);}
  }
  function closeQuick(){ $("#quickEditor").classList.remove("open"); activeFieldId=null; }
  function newRecord(){
    const r=blankRecord("New Chamber");
    records.unshift(r); activeId=r.id; saveAll(); renderRecord();
    $("#chamberName").focus(); $("#chamberName").select(); toast("New chamber created");
  }
  function duplicate(){
    const src=active(); if(!src)return;
    const r=JSON.parse(JSON.stringify(src));
    r.id=id(); r.name=(src.name||"Untitled Chamber")+" Copy"; r.createdAt=nowIso(); r.updatedAt=nowIso();
    records.unshift(r); activeId=r.id; saveAll(); renderRecord();
    $("#chamberName").focus(); $("#chamberName").select(); toast("Duplicated");
  }
  function deleteActive(){
    if(records.length===1){ toast("Keep at least one chamber"); return; }
    const r=active(); if(!r)return;
    if(!confirm(`Delete "${r.name}"?`))return;
    records=records.filter(x=>x.id!==r.id); activeId=records[0].id; saveAll(); renderRecord(); toast("Deleted");
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify({app:"Pine Ridge Chamber",version:APP_VERSION,exportedAt:nowIso(),records},null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`PineRidge-Chambers-Backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function importBackup(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(!Array.isArray(data.records))throw new Error();
        if(!confirm(`Import ${data.records.length} chamber record(s)? This will replace the chambers currently saved on this iPad.`))return;
        records=data.records; activeId=records[0]?.id || null;
        if(!records.length){const r=blankRecord("New Chamber");records=[r];activeId=r.id;}
        saveAll();renderRecord();toast("Backup imported");
      }catch{alert("That does not look like a Pine Ridge Chamber backup file.");}
    };
    reader.readAsText(file);
  }
  function toggleDrawer(){ $("#sidebar").classList.toggle("open"); }
  function closeDrawer(){ $("#sidebar").classList.remove("open"); }

  document.addEventListener("DOMContentLoaded",()=>{
    load(); renderFields(); bindDetails(); renderRecord();
    $("#newBtn").onclick=newRecord;
    $("#dupBtn").onclick=duplicate;
    $("#deleteBtn").onclick=deleteActive;
    $("#printBtn").onclick=()=>{closeQuick();window.print();};
    $("#backupBtn").onclick=exportBackup;
    $("#importBtn").onclick=()=>$("#importFile").click();
    $("#importFile").onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value="";};
    $("#search").oninput=renderList;
    $("#drawerBtn").onclick=toggleDrawer;
    $("#closeDrawer").onclick=closeDrawer;
    $("#quickInput").addEventListener("input",e=>{if(activeFieldId)updateValue(activeFieldId,e.target.value);});
    $("#quickPrev").onclick=()=>move(-1);
    $("#quickNext").onclick=()=>move(1);
    $("#quickDone").onclick=closeQuick;
    $("#quickLabel").onclick=focusQuick;
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape")closeQuick();
      if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="s"){e.preventDefault();touch();toast("Saved");}
    });
    if("serviceWorker" in navigator && location.protocol.startsWith("http")){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  });
})();
