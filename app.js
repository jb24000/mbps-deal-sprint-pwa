(() => {
  // ===== CORE STATE MANAGEMENT =====
  const KEY = "mbps_ds_v1";
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

  // ===== API INTEGRATION =====
  const DEALS_API_URL = 'https://t4e3bq9493.execute-api.us-east-1.amazonaws.com';

  // API helper functions
  async function apiCall(endpoint, method = 'GET', data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://jb24000.github.io'
        }
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${DEALS_API_URL}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }

  // Save lead to API
  async function saveLeadToAPI(lead) {
    try {
      const apiLead = {
        DealId: lead.id,
        address: lead.address || '',
        city: lead.city || '',
        zip: lead.zip || '',
        list: lead.list || 0,
        arv: lead.arv || 0,
        repairs: lead.repairs || 0,
        offer: lead.offer || 0,
        agent: lead.agent || '',
        phone: lead.phone || '',
        photos: lead.photos || '',
        comps: lead.comps || '',
        status: lead.status || 'New',
        notes: lead.notes || '',
        updated: lead.updated || Date.now(),
        createdAt: new Date().toISOString()
      };
      
      const result = await apiCall('/deal', 'POST', apiLead);
      console.log('Lead saved to API:', result);
      return result;
    } catch (error) {
      console.error('Failed to save lead to API:', error);
      return null;
    }
  }

  // Load all leads from API
  async function loadLeadsFromAPI() {
    try {
      const apiLeads = await apiCall('/deals');
      console.log('Loaded leads from API:', apiLeads.length);
      
      // Convert API format back to app format
      const convertedLeads = apiLeads.map(apiLead => ({
        id: apiLead.DealId,
        address: apiLead.address || '',
        city: apiLead.city || '',
        zip: apiLead.zip || '',
        list: apiLead.list || 0,
        arv: apiLead.arv || 0,
        repairs: apiLead.repairs || 0,
        offer: apiLead.offer || 0,
        agent: apiLead.agent || '',
        phone: apiLead.phone || '',
        photos: apiLead.photos || '',
        comps: apiLead.comps || '',
        status: apiLead.status || 'New',
        notes: apiLead.notes || '',
        updated: apiLead.updated || Date.now()
      }));
      
      return convertedLeads;
    } catch (error) {
      console.error('Failed to load leads from API:', error);
      return [];
    }
  }

  // Sync leads: merge API and local data
  async function syncLeads() {
    try {
      const apiLeads = await loadLeadsFromAPI();
      const localLeads = state.leads || [];
      
      // Create a map of all leads (API takes precedence for same ID)
      const allLeadsMap = new Map();
      
      // Add local leads first
      localLeads.forEach(lead => {
        allLeadsMap.set(lead.id, lead);
      });
      
      // Add API leads (overwrites local if same ID and newer)
      apiLeads.forEach(apiLead => {
        const existing = allLeadsMap.get(apiLead.id);
        if (!existing || (apiLead.updated || 0) >= (existing.updated || 0)) {
          allLeadsMap.set(apiLead.id, apiLead);
        }
      });
      
      // Update state with merged data
      state.leads = Array.from(allLeadsMap.values());
      save(); // Save merged data to localStorage
      
      console.log('Synced leads:', state.leads.length);
      return state.leads;
    } catch (error) {
      console.error('Sync failed:', error);
      return state.leads; // Return local data as fallback
    }
  }

  // ===== MARKET INTEL API =====
  
  // Market Intelligence API call
  async function analyzeMarket(location) {
    const apiUrl = localStorage.getItem('HOT_MARKETS_API') || '';
    const token = localStorage.getItem('HOT_MARKETS_TOKEN') || '';
    
    if (!apiUrl || !token) {
      throw new Error('Please configure API URL and Token in Market Intel settings first');
    }
    
    try {
      const url = `${apiUrl}?location=${encodeURIComponent(location)}&token=${encodeURIComponent(token)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Save to recent searches
      const recentSearches = JSON.parse(localStorage.getItem('recentMarketSearches') || '[]');
      if (!recentSearches.includes(location)) {
        recentSearches.unshift(location);
        if (recentSearches.length > 5) recentSearches.pop();
        localStorage.setItem('recentMarketSearches', JSON.stringify(recentSearches));
        updateQuickZipCodes();
      }
      
      return data;
    } catch (error) {
      console.error('Market analysis failed:', error);
      throw error;
    }
  }

  // Display market results
  function displayMarketResults(results, location) {
    const container = $("#marketResults");
    if (!container) return;
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      container.innerHTML = '<p class="text-gray-500">No market data found for this location.</p>';
      return;
    }
    
    const html = results.map(market => {
      const scoreColor = market.classification === 'HOT' ? 'text-red-600' : 
                        market.classification === 'WARM' ? 'text-orange-600' : 
                        market.classification === 'COOL' ? 'text-blue-600' : 'text-gray-600';
      
      return `
        <div class="border rounded-xl p-4 bg-white dark:bg-gray-800">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-semibold text-lg">${market.city}, ${market.state} ${market.zipCode}</h4>
              <div class="flex items-center gap-2">
                <span class="text-2xl font-bold ${scoreColor}">${market.score || 0}</span>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${scoreColor} bg-current bg-opacity-10">
                  ${market.classification || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
            <div>
              <div class="text-gray-500">Days on Market</div>
              <div class="font-semibold">${market.data?.avgDaysOnMarket || 'N/A'}</div>
            </div>
            <div>
              <div class="text-gray-500">Months Supply</div>
              <div class="font-semibold">${market.data?.monthsOfSupply || 'N/A'}</div>
            </div>
            <div>
              <div class="text-gray-500">Sale to List</div>
              <div class="font-semibold">${market.data?.saleToListRatio ? market.data.saleToListRatio + '%' : 'N/A'}</div>
            </div>
            <div>
              <div class="text-gray-500">Price Reductions</div>
              <div class="font-semibold">${market.data?.priceReductions ? market.data.priceReductions + '%' : 'N/A'}</div>
            </div>
          </div>
          
          ${market.insights && market.insights.length > 0 ? `
            <div class="mb-3">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Insights:</div>
              <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                ${market.insights.map(insight => `<li>• ${insight}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${market.evidence && market.evidence.length > 0 ? `
            <div>
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Evidence:</div>
              <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                ${market.evidence.map(evidence => `<li>• ${evidence}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
    updateMarketInsights(results, location);
  }

  // Update market insights
  function updateMarketInsights(results, location) {
    const container = $("#marketInsights");
    if (!container || !results.length) return;
    
    const hotMarkets = results.filter(m => m.classification === 'HOT').length;
    const avgScore = Math.round(results.reduce((sum, m) => sum + (m.score || 0), 0) / results.length);
    const topMarket = results[0];
    
    const insights = [
      `Analyzed ${results.length} markets in ${location}`,
      `${hotMarkets} hot markets found (score 80+)`,
      `Average market score: ${avgScore}`,
      topMarket ? `Top market: ${topMarket.city}, ${topMarket.state} (Score: ${topMarket.score})` : null
    ].filter(Boolean);
    
    container.innerHTML = insights.map(insight => 
      `<p class="text-sm">• ${insight}</p>`
    ).join('');
  }

  // Update quick zip codes from recent searches
  function updateQuickZipCodes() {
    const container = $("#quickZipCodes");
    if (!container) return;
    
    const recentSearches = JSON.parse(localStorage.getItem('recentMarketSearches') || '[]');
    
    if (recentSearches.length === 0) {
      container.innerHTML = '<p class="text-xs text-gray-500">Recently analyzed locations will appear here</p>';
      return;
    }
    
    const html = recentSearches.map(search => 
      `<button class="quick-location px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs hover:bg-blue-200" 
               data-location="${search}">${search}</button>`
    ).join('');
    
    container.innerHTML = html;
    
    // Add click handlers for quick locations
    container.querySelectorAll('.quick-location').forEach(btn => {
      btn.addEventListener('click', () => {
        const location = btn.getAttribute('data-location');
        $("#locationInput").value = location;
      });
    });
  }

  // ===== INITIALIZATION =====
  
  // Initialize: Load and sync data on startup
  async function initializeApp() {
    try {
      await syncLeads();
      renderLeads(); // Re-render with synced data
      console.log('App initialized with synced data');
    } catch (error) {
      console.error('App initialization failed:', error);
    }
  }

  // ===== TAB NAVIGATION =====
  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      $$(".tab").forEach(s => s.classList.remove("active"));
      $("#" + tab).classList.add("active");
    });
  });

  // ===== ONLINE/OFFLINE STATUS =====
  function updateNet() {
    $("#online").hidden = !navigator.onLine;
    $("#offline").hidden = navigator.onLine;
  }
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
  $("#year").textContent = new Date().getFullYear();

  // ===== DASHBOARD TASKS =====
  const dayTasks = [
    ["Pick 2–3 hot ZIPs via Privy Investor Activity", "Create saved searches + alerts", "Seed buyers list from recent flips"],
    ["Comp 15–25 properties (Live CMA)", "Compute MAO, call 20 agents", "Send 8–12 offers"],
    ["Follow up on offers", "Expand buyers list (10+)", "Add 8–12 more offers"],
    ["Re-comp countered deals", "Negotiate + tighten timelines", "Aim for 2–3 acceptances/counters"],
    ["Get a contract signed", "Dispo: blast buyers + schedule showings", "Book 3–5 walkthroughs"],
    ["Showings + best-and-final", "Select reliable buyer + EMD", "Line up backup buyer"],
    ["Title/attorney coordination", "Confirm closing date + access", "Prep next week's pipeline"]
  ];

  function renderDays() {
    const wrap = $("#days"); wrap.innerHTML = "";
    dayTasks.forEach((tasks, idx) => {
      const d = idx + 1;
      const box = document.createElement("div");
      box.className = "day";
      const h = document.createElement("h3");
      h.textContent = `Day ${d}`;
      box.appendChild(h);
      const list = document.createElement("div");
      tasks.forEach((t, ti) => {
        const row = document.createElement("label");
        row.className = "task";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!(state.tasks[d]?.[ti]);
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

  // ===== LEAD MANAGEMENT =====
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

  // Lead form submission with API integration
  $("#leadForm").addEventListener("submit", async (e)=>{
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
      photos: $("#leadPhotos").value.trim(),
      comps: $("#leadComps").value.trim(),
      status: $("#leadStatus").value,
      notes: $("#leadNotes").value.trim(),
      updated: Date.now()
    };
    
    // Save to local state
    const i = state.leads.findIndex(x=>x.id===id);
    if (i>=0) state.leads[i] = record; else state.leads.push(record);
    save(); 
    
    // Save to API (background)
    try {
      await saveLeadToAPI(record);
      console.log('Lead saved to both local and API');
    } catch (error) {
      console.log('Saved locally, API sync will retry later');
    }
    
    renderLeads($("#leadSearch").value); 
    resetLeadForm();
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
      $("#leadPhotos").value = L.photos||"";
      $("#leadComps").value = L.comps||"";
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
      const smsObj = smsForLead(L);
      try {
        const m = new URL(url);
        const subject = decodeURIComponent((m.searchParams.get('subject')||''));
        const body = decodeURIComponent((m.searchParams.get('body')||''));
        previewSubject.value = subject; previewBody.value = body; previewSMS.value = smsObj.body;
      } catch { previewSubject.value=''; previewBody.value=''; previewSMS.value = smsObj.body; }
      modalLeadId = L.id; modal.hidden = false;
    }
  });

  $("#leadSearch").addEventListener("input", (e)=> renderLeads(e.target.value));
  $("#exportLeads").addEventListener("click", ()=> exportCSV("leads.csv", state.leads));

  // ===== BUYER MANAGEMENT =====
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

  // ===== MARKET INTEL SETUP =====
  function setupMarketIntelSettings() {
    const saveBtn = $("#saveAiSettings");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const apiUrl = $("#hotMarketsApiUrl")?.value?.trim() || '';
        const token = $("#hotMarketsToken")?.value?.trim() || '';
        const evidence = $("#evidenceModeToggle")?.checked || false;
        
        localStorage.setItem('HOT_MARKETS_API', apiUrl);
        localStorage.setItem('HOT_MARKETS_TOKEN', token);
        localStorage.setItem('HMF_EVIDENCE', evidence ? '1' : '0');
        
        alert('Market Intel settings saved!');
      });
    }
  }

  function setupMarketIntel() {
    setupMarketIntelSettings();
    
    // Analyze button
    const analyzeBtn = $("#analyzeMarkets");
    const locationInput = $("#locationInput");
    
    if (analyzeBtn && locationInput) {
      analyzeBtn.addEventListener("click", async () => {
        const location = locationInput.value.trim();
        if (!location) {
          alert('Please enter a location to analyze');
          return;
        }
        
        try {
          analyzeBtn.textContent = 'Analyzing...';
          analyzeBtn.disabled = true;
          
          const results = await analyzeMarket(location);
          displayMarketResults(results, location);
          
        } catch (error) {
          console.error('Market analysis error:', error);
          const container = $("#marketResults");
          if (container) {
            container.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p class="text-red-600 font-medium">Analysis Failed</p>
              <p class="text-red-600 text-sm">${error.message}</p>
            </div>`;
          }
        } finally {
          analyzeBtn.textContent = 'Analyze';
          analyzeBtn.disabled = false;
        }
      });
    }
    
    // Clear cache button
    const refreshBtn = $("#refreshMarkets");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        localStorage.removeItem('recentMarketSearches');
        updateQuickZipCodes();
        $("#marketResults").innerHTML = '';
        $("#marketInsights").innerHTML = '<p class="text-gray-500">Run an analysis to see insights and trends</p>';
      });
    }
    
    updateQuickZipCodes();
  }

  // ===== COPY SCRIPT BUTTONS =====
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

  // ===== CALCULATOR =====
  function fillCalcDefaults(){
    $("#calcPercent").value = state.settings.percent;
    $("#calcFee").value = state.settings.fee;
  }

  $("#calcForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    const arv = parseFloat($("#calcArv").value||0);
    const rep = parseFloat($("#calcRepairs").value||0);
    const pct = parseFloat($("#calcPercent").value||state.settings.percent);
    const fee = parseFloat($("#calcFee").value||state.settings.fee);
    const mao = computeMAO(arv, rep, pct, fee);
    $("#calcOut").textContent = "MAO: $" + Math.round(mao).toLocaleString();
  });

  // ===== SETTINGS =====
  function renderSettings(){
    $("#setZips").value = state.settings.zips || "";
    $("#setPercent").value = state.settings.percent;
    $("#setFee").value = state.settings.fee;
    $("#setOffers").value = state.settings.offers;
    $("#setCompany").value = state.settings.company || "MB Property Solutions";
    $("#setSenderName").value = state.settings.sender || "";
    $("#setReplyEmail").value = state.settings.replyEmail || "";
    $("#setPhone").value = state.settings.phone || "";
    $("#setZipFilter").checked = !!state.settings.zipFilter;
  }

  $("#settingsForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    state.settings.zips = $("#setZips").value.trim();
    state.settings.percent = clamp(parseFloat($("#setPercent").value||0.7), 0, 1) || 0.7;
    state.settings.fee = parseFloat($("#setFee").value||10000) || 10000;
    state.settings.offers = parseInt($("#setOffers").value||10) || 10;
    state.settings.company = $("#setCompany").value.trim() || "MB Property Solutions";
    state.settings.sender = $("#setSenderName").value.trim();
    state.settings.replyEmail = $("#setReplyEmail").value.trim();
    state.settings.phone = $("#setPhone").value.trim();
    state.settings.zipFilter = $("#setZipFilter").checked;
    save(); fillCalcDefaults(); alert("Settings saved.");
  });

  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  $("#resetAll").addEventListener("click", ()=>{
    if (!confirm("Delete all local data (leads, buyers, tasks, settings)?")) return;
    state = JSON.parse(JSON.stringify(defaultState));
    save();
    location.reload();
  });

  // ===== CSV EXPORT =====
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

  // ===== EMAIL HELPERS =====
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
    if (lead.photos){ bodyLines.push(''); bodyLines.push('Photos: ' + lead.photos); }
    if (lead.comps){ bodyLines.push('Comps: ' + lead.comps); }
    bodyLines.push('');
    bodyLines.push('—');
    bodyLines.push(`${s.company}${s.sender? ' | ' + s.sender : ''}`);
    if (s.phone) bodyLines.push(s.phone);
    if (s.replyEmail) bodyLines.push(s.replyEmail);
    const body = bodyLines.join('\\n');
    const to = encodeURIComponent(s.replyEmail || '');
    const url = `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    return url;
  }

  function smsForLead(lead){
    const s = state.settings;
    const mao = computeMAO(+lead.arv||0, +lead.repairs||0, s.percent, s.fee);
    const lines = [];
    lines.push(`${lead.address||''} ${lead.zip||''}`);
    lines.push(`ARV $${Math.round(+lead.arv||0).toLocaleString()} | Repairs $${Math.round(+lead.repairs||0).toLocaleString()}`);
    lines.push(`Ask $${Math.round(+lead.offer||0).toLocaleString()} | MAO est. $${Math.round(mao).toLocaleString()}`);
    if (lead.photos) lines.push(`Photos: ${lead.photos}`);
    if (lead.comps) lines.push(`Comps: ${lead.comps}`);
    lines.push(`As-Is | ≤10d close | Agent ${lead.agent||''} ${lead.phone||''}`);
    lines.push(`${s.company}${s.sender? ' | ' + s.sender : ''}${s.phone? ' | ' + s.phone : ''}`);
    const body = lines.join('\\n');
    const url = `sms:?&body=${encodeURIComponent(body)}`;
    return {url, body};
  }

  // ===== MODAL FUNCTIONALITY =====
  const modal = document.getElementById('previewModal');
  const modalClose = document.getElementById('modalClose');
  const previewSubject = document.getElementById('previewSubject');
  const previewBody = document.getElementById('previewBody');
  const previewSMS = document.getElementById('previewSMS');
  const openEmailBtn = document.getElementById('openEmail');
  const copyEmailBtn = document.getElementById('copyEmail');
  const openSMSBtn = document.getElementById('openSMS');
  const copySMSBtn = document.getElementById('copySMS');

  let modalLeadId = null;

  document.querySelectorAll('.modal .tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal .tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-mtab');
      document.querySelectorAll('.mtab').forEach(el=>el.classList.remove('active'));
      document.getElementById('modal'+tab.toUpperCase()).classList.add('active');
    });
  });

  modalClose.addEventListener('click', ()=>{ modal.hidden = true; });

  openEmailBtn.addEventListener('click', ()=>{
    const s = state.settings;
    const to = encodeURIComponent(s.replyEmail || '');
    const url = `mailto:${to}?subject=${encodeURIComponent(previewSubject.value)}&body=${encodeURIComponent(previewBody.value)}`;
    window.location.href = url;
  });

  copyEmailBtn.addEventListener('click', async ()=>{
    try { await navigator.clipboard.writeText('Subject: ' + previewSubject.value + '\\n\\n' + previewBody.value); alert('Email copied.'); } catch { alert('Copy failed.'); }
  });

  openSMSBtn.addEventListener('click', ()=>{
    const url = `sms:?&body=${encodeURIComponent(previewSMS.value)}`;
    window.location.href = url;
  });

  copySMSBtn.addEventListener('click', async ()=>{
    try { await navigator.clipboard.writeText(previewSMS.value); alert('SMS copied.'); } catch { alert('Copy failed.'); }
  });

  // ===== APP INITIALIZATION =====
  
  // Initialize all components when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    setupMarketIntel();
  });

  // Initialize core app functionality
  renderDays();
  renderLeads();
  renderBuyers();
  renderSettings();
  fillCalcDefaults();
  
  // Initialize app with API sync
  initializeApp();

// Add this to your existing app.js (at the very bottom)
const DEALS_API_URL = 'https://t4e3bq9493.execute-api.us-east-1.amazonaws.com';

async function loadLeadsFromAPI() {
  const response = await fetch(`${DEALS_API_URL}/deals`);
  return response.json();
}

async function saveLeadToAPI(lead) {
  const response = await fetch(`${DEALS_API_URL}/deal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ DealId: lead.id, ...lead })
  });
  return response.json();
}

})();
