(() => {
  // Simple store
  const KEY = "pds_v1";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const defaultState = {
    settings: { zips: "", percent: 0.70, fee: 10000, offers: 10, company: "MB Property Solutions", sender: "", replyEmail: "", phone: "", zipFilter: true },
    leads: [],
    buyers: [],
    tasks: {} // day -> boolean[]
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const obj = JSON.parse(raw);
      // migrate defaults
      obj.settings = Object.assign({}, defaultState.settings, obj.settings || {});
      obj.leads = obj.leads || [];
      obj.buyers = obj.buyers || [];
      obj.tasks = obj.tasks || {};
      return obj;
    } catch { return JSON.parse(JSON.stringify(defaultState)); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  let state = load();

  // Tabs
  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      $$(".tab").forEach(s => s.classList.remove("active"));
      $("#" + tab).classList.add("active");
    });
  });

  // Online/offline
  function updateNet() {
    $("#online").hidden = !navigator.onLine;
    $("#offline").hidden = navigator.onLine;
  }
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
  $("#year").textContent = new Date().getFullYear();

  // ------- Dashboard tasks -------
  const dayTasks = [
    ["Pick 2–3 hot ZIPs via Privy Investor Activity", "Create saved searches + alerts", "Seed buyers list from recent flips"],
    ["Comp 15–25 properties (Live CMA)", "Compute MAO, call 20 agents", "Send 8–12 offers"],
    ["Follow up on offers", "Expand buyers list (10+)", "Add 8–12 more offers"],
    ["Re-comp countered deals", "Negotiate + tighten timelines", "Aim for 2–3 acceptances/counters"],
    ["Get a contract signed", "Dispo: blast buyers + schedule showings", "Book 3–5 walkthroughs"],
    ["Showings + best-and-final", "Select reliable buyer + EMD", "Line up backup buyer"],
    ["Title/attorney coordination", "Confirm closing date + access", "Prep next week’s pipeline"]
  ];

  function renderDays() {
    const wrap = $("#days"); wrap.innerHTML = "";
    let total = 0, done = 0;
    dayTasks.forEach((tasks, idx) => {
      const d = idx + 1;
      const box = document.createElement("div");
      box.className = "day";
      const h = document.createElement("h3");
      h.textContent = `Day ${d}`;
      box.appendChild(h);
      const list = document.createElement("div");
      tasks.forEach((t, ti) => {
        total++;
        const row = document.createElement("label");
        row.className = "task";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!(state.tasks[d]?.[ti]);
        if (cb.checked) done++;
        cb.addEventListener("change", () => {
          if (!state.tasks[d]) state.tasks[d] = [];
          state.tasks[d][ti] = cb.checked;
          save(); updateProgress();
        });
        const span = document.createElement("span");
        span.textContent = t;
        row.appendChild(cb); row.appendChild(span);
        list.appendChild(row);
      });
      box.appendChild(list);
      wrap.appendChild(box);
    });
    // initial progress bar
    updateProgress();
  }

  function updateProgress() {
    let total = 0, done = 0;
    dayTasks.forEach((tasks, d) => {
      tasks.forEach((_, ti) => {
        total++;
        if (state.tasks[d+1]?.[ti]) done++;
      });
    });
    const pct = total ? Math.round((done/total)*100) : 0;
    $("#progressBar").style.width = pct + "%";
  }

  renderDays();

  // ------- Leads -------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function getNum(el){ const v = parseFloat(el?.value || 0); return isNaN(v) ? 0 : v; }
  function computeMAO(arv, repairs, percent, fee){ return Math.max(0, arv * percent - repairs - fee); }

  function resetLeadForm(){ $("#leadForm").reset(); $("#leadId").value=""; }

  function renderLeads(filter=""){
    const tbody = $("#leadTable tbody"); tbody.innerHTML = "";
    const p = state.settings.percent, fee = state.settings.fee;
    state.leads
      .filter(L => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return [L.address,L.city,L.zip,L.agent,L.status].some(x => (x||"").toLowerCase().includes(f));
      })
      .sort((a,b)=> (b.updated||0)-(a.updated||0))
      .forEach(L => {
        const mao = computeMAO(+L.arv||0, +L.repairs||0, p, fee);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${L.address||""}</td>
          <td>${L.zip||""}</td>
          <td>${money(L.list)}</td>
          <td>${money(L.arv)}</td>
          <td>${money(L.repairs)}</td>
          <td><strong>${money(mao)}</strong></td>
          <td>${money(L.offer)}</td>
          <td>${L.status||""}</td>
          <td>${L.agent||""}</td>
          <td>
            <button class="btn" data-edit="${L.id}">✏️</button>
            <button class="btn" data-del="${L.id}">🗑️</button>
          </td>
          <td><button class="btn" data-email="${L.id}">✉️</button></td>`;
        tbody.appendChild(tr);
      });
  }

  function money(n){ const v = parseFloat(n||0); return isNaN(v) ? "$0" : "$"+v.toLocaleString(undefined,{maximumFractionDigits:0}); }

// --- Email helpers ---
function emailForLead(lead){
  const s = state.settings;
  const mao = computeMAO(+lead.arv||0, +lead.repairs||0, s.percent, s.fee);
  const subj = `${s.company} — ${lead.address||''} ${lead.zip||''} — ARV $${Math.round(+lead.arv||0).toLocaleString()} | Ask $${Math.round(+lead.offer||0).toLocaleString()}`;
  const bodyLines = [];
  bodyLines.push(`${lead.address||''}${lead.city? ', ' + lead.city : ''} ${lead.zip||''}`);
  bodyLines.push('');
  bodyLines.push(`ARV: $${Math.round(+lead.arv||0).toLocaleString()}`);
  bodyLines.push(`Repairs: $${Math.round(+lead.repairs||0).toLocaleString()}`);
  bodyLines.push(`MAO (est.): $${Math.round(mao).toLocaleString()} @ ${(s.percent*100).toFixed(0)}% - fee`);
  bodyLines.push(`Your Price (assign): $${Math.round(+lead.offer||0).toLocaleString()}`);
  if (lead.notes) { bodyLines.push(''); bodyLines.push('Notes: ' + lead.notes); }
  bodyLines.push('');
  bodyLines.push('Close: ≤10 days | As-Is | Cash');
  bodyLines.push('Access: contact agent ' + (lead.agent||'') + (lead.phone? ' ('+lead.phone+')' : ''));
  bodyLines.push('');
  bodyLines.push('—');
  bodyLines.push(`${s.company}${s.sender? ' | ' + s.sender : ''}`);
  if (s.phone) bodyLines.push(s.phone);
  if (s.replyEmail) bodyLines.push(s.replyEmail);
  const body = bodyLines.join('\n');
  // Collect buyer emails; if zipFilter on, include buyers whose zips contain lead.zip
  const emails = state.buyers
    .filter(b => (b.email||'').includes('@'))
    .filter(b => !s.zipFilter || !lead.zip || String(b.zips||'').split(/[,\s]+/).filter(Boolean).map(z=>z.trim()).includes(String(lead.zip)))
    .map(b => b.email.trim());
  const uniq = Array.from(new Set(emails));
  const to = encodeURIComponent(s.replyEmail || '');
  const bcc = encodeURIComponent(uniq.join(','));
  const url = `mailto:${to}?bcc=${bcc}&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  return url;
}


  $("#leadForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = $("#leadId").value || uid();
    const record = {
      id,
      address: $("#leadAddress").value.trim(),
      city: $("#leadCity").value.trim(),
      zip: $("#leadZip").value.trim(),
      list: getNum($("#leadList")),
      arv: getNum($("#leadArv")),
      repairs: getNum($("#leadRepairs")),
      offer: getNum($("#leadOffer")),
      agent: $("#leadAgent").value.trim(),
      phone: $("#leadPhone").value.trim(),
      status: $("#leadStatus").value,
      notes: $("#leadNotes").value.trim(),
      updated: Date.now()
    };
    const i = state.leads.findIndex(x=>x.id===id);
    if (i>=0) state.leads[i] = record; else state.leads.push(record);
    save(); renderLeads($("#leadSearch").value); resetLeadForm();
  });

  $("#leadReset").addEventListener("click", resetLeadForm);

  $("#leadTable").addEventListener("click", (e)=>{
    const btn = e.target.closest("button"); if (!btn) return;
    const editId = btn.getAttribute("data-edit");
    const delId = btn.getAttribute("data-del");
    const emailId = btn.getAttribute("data-email");
    if (editId){
      const L = state.leads.find(x=>x.id===editId); if (!L) return;
      $("#leadId").value = L.id;
      $("#leadAddress").value = L.address||"";
      $("#leadCity").value = L.city||"";
      $("#leadZip").value = L.zip||"";
      $("#leadList").value = L.list||"";
      $("#leadArv").value = L.arv||"";
      $("#leadRepairs").value = L.repairs||"";
      $("#leadOffer").value = L.offer||"";
      $("#leadAgent").value = L.agent||"";
      $("#leadPhone").value = L.phone||"";
      $("#leadStatus").value = L.status||"New";
      $("#leadNotes").value = L.notes||"";
      document.querySelector('[data-tab="leads"]').click();
    }
    if (delId){
      state.leads = state.leads.filter(x=>x.id!==delId);
      save(); renderLeads($("#leadSearch").value);
    }
    if (emailId){
      const L = state.leads.find(x=>x.id===emailId); if (!L) return;
      const url = emailForLead(L);
      try { window.location.href = url; } catch { alert('Unable to open email client.'); }
    }
  });

  $("#leadSearch").addEventListener("input", (e)=> renderLeads(e.target.value));
  $("#exportLeads").addEventListener("click", ()=> exportCSV("leads.csv", state.leads));

  renderLeads();

  // ------- Buyers -------
  function resetBuyerForm(){ $("#buyerForm").reset(); $("#buyerId").value=""; }
  function renderBuyers(filter=""){
    const tbody = $("#buyerTable tbody"); tbody.innerHTML="";
    state.buyers
      .filter(B => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return [B.name,B.email,B.phone,B.zips,B.criteria].some(x=>(x||"").toLowerCase().includes(f));
      })
      .sort((a,b)=> (b.updated||0)-(a.updated||0))
      .forEach(B => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${B.name||""}</td><td>${B.email||""}</td><td>${B.phone||""}</td>
          <td>${B.zips||""}</td><td>${B.criteria||""}</td>
          <td><button class="btn" data-bedit="${B.id}">✏️</button>
              <button class="btn" data-bdel="${B.id}">🗑️</button></td>`;
        tbody.appendChild(tr);
      });
  }
  $("#buyerForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = $("#buyerId").value || uid();
    const record = {
      id,
      name: $("#buyerName").value.trim(),
      email: $("#buyerEmail").value.trim(),
      phone: $("#buyerPhone").value.trim(),
      zips: $("#buyerZips").value.trim(),
      criteria: $("#buyerCriteria").value.trim(),
      notes: $("#buyerNotes").value.trim(),
      updated: Date.now()
    };
    const i = state.buyers.findIndex(x=>x.id===id);
    if (i>=0) state.buyers[i]=record; else state.buyers.push(record);
    save(); renderBuyers($("#buyerSearch").value); resetBuyerForm();
  });
  $("#buyerReset").addEventListener("click", resetBuyerForm);
  $("#buyerTable").addEventListener("click",(e)=>{
    const btn = e.target.closest("button"); if (!btn) return;
    const eid = btn.getAttribute("data-bedit");
    const did = btn.getAttribute("data-bdel");
    if (eid){
      const B = state.buyers.find(x=>x.id===eid); if (!B) return;
      $("#buyerId").value = B.id;
      $("#buyerName").value = B.name||"";
      $("#buyerEmail").value = B.email||"";
      $("#buyerPhone").value = B.phone||"";
      $("#buyerZips").value = B.zips||"";
      $("#buyerCriteria").value = B.criteria||"";
      $("#buyerNotes").value = B.notes||"";
      document.querySelector('[data-tab="buyers"]').click();
    }
    if (did){
      state.buyers = state.buyers.filter(x=>x.id!==did);
      save(); renderBuyers($("#buyerSearch").value);
    }
  });
  $("#buyerSearch").addEventListener("input", (e)=> renderBuyers(e.target.value));
  $("#exportBuyers").addEventListener("click", ()=> exportCSV("buyers.csv", state.buyers));
  renderBuyers();

  // ------- Scripts copy buttons -------
  $$("button[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-copy");
      const txt = $("#"+id).textContent;
      try {
        navigator.clipboard.writeText(txt);
        btn.textContent = "Copied!";
        setTimeout(()=>btn.textContent="Copy", 1000);
      } catch {
        alert("Copy failed—select and copy manually.");
      }
    });
  });

  // ------- Calculator -------
  function fillCalcDefaults(){
    $("#calcPercent").value = state.settings.percent;
    $("#calcFee").value = state.settings.fee;
  }
  fillCalcDefaults();

  $("#calcForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    const arv = parseFloat($("#calcArv").value||0);
    const rep = parseFloat($("#calcRepairs").value||0);
    const pct = parseFloat($("#calcPercent").value||state.settings.percent);
    const fee = parseFloat($("#calcFee").value||state.settings.fee);
    const mao = computeMAO(arv, rep, pct, fee);
    $("#calcOut").textContent = "MAO: $" + Math.round(mao).toLocaleString();
  });

  // ------- Settings -------
  function renderSettings(){
    $("#setZips").value = state.settings.zips || "";
    $("#setCompany").value = state.settings.company || "MB Property Solutions";
    $("#setSenderName").value = state.settings.sender || "";
    $("#setReplyEmail").value = state.settings.replyEmail || "";
    $("#setPhone").value = state.settings.phone || "";
    $("#setZipFilter").checked = !!state.settings.zipFilter;
    $("#setPercent").value = state.settings.percent;
    $("#setFee").value = state.settings.fee;
    $("#setOffers").value = state.settings.offers;
  }
  renderSettings();

  $("#settingsForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    state.settings.zips = $("#setZips").value.trim();
    state.settings.company = $("#setCompany").value.trim() || "MB Property Solutions";
    state.settings.sender = $("#setSenderName").value.trim();
    state.settings.replyEmail = $("#setReplyEmail").value.trim();
    state.settings.phone = $("#setPhone").value.trim();
    state.settings.zipFilter = $("#setZipFilter").checked;
    state.settings.percent = clamp(parseFloat($("#setPercent").value||0.7), 0, 1) || 0.7;
    state.settings.fee = parseFloat($("#setFee").value||10000) || 10000;
    state.settings.offers = parseInt($("#setOffers").value||10) || 10;
    save(); fillCalcDefaults(); alert("Settings saved.");
  });
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  $("#resetAll").addEventListener("click", ()=>{
    if (!confirm("Delete all local data (leads, buyers, tasks, settings)?")) return;
    state = JSON.parse(JSON.stringify(defaultState));
    save();
    location.reload();
  });

  // ------- Export CSV -------
  function exportCSV(filename, arr){
    if (!arr || !arr.length) { alert("Nothing to export."); return; }
    const headers = Object.keys(arr[0]);
    const lines = [headers.join(",")].concat(
      arr.map(o => headers.map(h => `"${String(o[h]??"").replace(/"/g,'""')}"`).join(","))
    );
    const blob = new Blob([lines.join("\n")], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

})();