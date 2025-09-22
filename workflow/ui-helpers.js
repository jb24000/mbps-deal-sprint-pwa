export function renderChecklist(container, wf, stage, deal, onToggle){
  container.innerHTML = "";
  const list = wf.flows[stage]?.checklist || [];
  list.forEach(item=>{
    const row=document.createElement('label'); row.className='flex items-center gap-2 text-sm';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!(deal.cl && deal.cl[item.id]);
    cb.addEventListener('change', ()=>{ const cl={...(deal.cl||{})}; cl[item.id]=cb.checked; onToggle({...deal, cl}); });
    const span=document.createElement('span'); span.textContent=item.label;
    row.appendChild(cb); row.appendChild(span); container.appendChild(row);
  });
}
