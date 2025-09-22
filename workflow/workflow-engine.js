// Pure, dependency-free helpers
export function loadWorkflow(config){ if(!config?.stages||!config?.flows) throw new Error("Invalid config"); return Object.freeze(config); }
export function gateStatus(wf, stage, cl={}){ const def=wf.flows[stage]; if(!def) return {ok:true,missing:[]}; const missing=(def.required||[]).filter(id=>!cl[id]); return {ok:missing.length===0, missing}; }
export function getChecklist(wf, stage){ return wf.flows[stage]?.checklist || []; }
export function proposeNextAction(wf, stage, cl={}){ const def=wf.flows[stage]; if(!def) return {ready:false,to:null,text:""}; const {ok}=gateStatus(wf,stage,cl); if(!ok||!def.nextStage) return {ready:false,to:null,text:""}; return {ready:true,to:def.nextStage,text:def.nextText||""}; }
export function applyNextStage(wf, deal){ const def=wf.flows[deal.stage]; if(!def?.nextStage) return deal; return {...deal, stage:def.nextStage, cl:{}}; }
export function toggleChecklist(deal, id, checked){ return {...deal, cl:{...(deal.cl||{}), [id]:!!checked}}; }
export function badgeText(wf, stage, cl={}){ const gs=gateStatus(wf, stage, cl); return gs.ok ? "Ready" : `Needs ${gs.missing.length}`; }
