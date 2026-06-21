const CONFIG={
  SUPABASE_URL:"https://ukpbnqzsthxywgabpumj.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_3w3Z8dhj2zjDB7Yl2AB5RA_0eHzqL2a",
  ONESIGNAL_APP_ID:"d8f5cd74-b37b-441c-ab84-cce468a9d95d"
};
const FAMILY_ID="base-mu-ju-v8";
let sb=null,remoteReady=false,savingRemote=false,missionView="base",taskModalType="daily",editingTaskId=null,calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1),trophyFilter="Todas";
let activeProfile=localStorage.getItem("bf_active_profile")||"";
const systems={
  pets:["🐾","Pets"],casa:["🏠","Casa"],financeiro:["💰","Financeiro"],relacionamento:["❤️","Relacionamento"],saude:["🧠","Saúde"]
};
const systemKeys=Object.keys(systems),weekNames=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],weekFull=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const diff={facil:[10,"Fácil"],media:[25,"Média"],dificil:[50,"Difícil"],muito_dificil:[100,"Muito difícil"]};
const priorityScore={baixa:0,normal:1,alta:2,emergencial:4};
const beerLevels=[["Bavaria","Início"],["Skol","Base ativa"],["Brahma","Rotina firme"],["Original","Guardião"],["Heineken","Especialista"],["Eisenbahn","Veterano"],["Baden Baden","Mestre"],["Patagonia","Comandante"],["Stella Artois","Arquiteto"],["Colorado","Lenda"],["Hoegaarden","Supremo"]];
const homeStages=[["🏚️","Base improvisada",0],["🏠","Casa organizada",750],["🏡","Lar confortável",2000],["🌳","Base equilibrada",4500],["✨","Base lendária",8500],["🏰","Base suprema",14000]];
const avatarItems=[["👕","Camiseta",250],["🧢","Boné",500],["👓","Óculos",1000],["🧥","Moletom",2000],["👟","Tênis",3000],["👑","Coroa",5000],["✨","Aura lendária",9000]];
let state={
  version:8,
  tasks:JSON.parse(localStorage.getItem("bf_tasks")||"[]"),
  completions:JSON.parse(localStorage.getItem("bf_completions")||"[]"),
  goals:JSON.parse(localStorage.getItem("bf_goals")||"[]"),
  daySnapshots:JSON.parse(localStorage.getItem("bf_day_snapshots")||"{}"),
  notificationLog:JSON.parse(localStorage.getItem("bf_notification_log")||"{}"),
  waste:JSON.parse(localStorage.getItem("bf_waste")||"[]"),
  settings:JSON.parse(localStorage.getItem("bf_settings")||"{}")
};
function $(id){return document.getElementById(id)}
function uid(){return Date.now().toString()+Math.random().toString(16).slice(2)}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parseDate(k){return new Date(k+"T00:00:00")}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function todayKey(){return dateKey(new Date())}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function sysIcon(k){return systems[k]?.[0]||"🎯"}function sysLabel(k){return systems[k]?.[1]||k}
function localSave(){localStorage.setItem("bf_tasks",JSON.stringify(state.tasks));localStorage.setItem("bf_completions",JSON.stringify(state.completions));localStorage.setItem("bf_goals",JSON.stringify(state.goals));localStorage.setItem("bf_day_snapshots",JSON.stringify(state.daySnapshots));localStorage.setItem("bf_notification_log",JSON.stringify(state.notificationLog));localStorage.setItem("bf_waste",JSON.stringify(state.waste||[]));localStorage.setItem("bf_settings",JSON.stringify(state.settings))}
function migrate(){
  state.tasks.forEach(t=>{
    if(!t.system)t.system=t.category||"casa";
    if(t.system==="undefined")t.system="casa";
    if(!systemKeys.includes(t.system))t.system="casa";
    if(!t.assignedTo)t.assignedTo="Qualquer um";
    if(!t.scheduleType)t.scheduleType=t.frequency==="semanal"?"weekly":t.frequency==="mensal"?"monthly":"daily";
    if(!t.startDate)t.startDate=todayKey();
    if(!t.createdAt)t.createdAt=new Date().toISOString();
    if(!t.difficulty)t.difficulty="facil";
    if(!t.priority)t.priority="normal";
    if(t.notify===undefined)t.notify=true;
    if(t.active===undefined)t.active=true;
    if(!t.estimatedMinutes)t.estimatedMinutes=Number(t.time||5);
    if(!t.weeklyDays)t.weeklyDays=t.scheduleType==="weekly"?[new Date().getDay()]:[];
    if(!t.monthlyDay)t.monthlyDay=new Date().getDate();
    if(!t.interval)t.interval=1;
  });
  state.completions.forEach(c=>{if(!c.completedBy)c.completedBy=c.person||activeProfile||"Mu";if(!c.system)c.system=c.category||"casa"});
  localSave();
}
function setSync(type,text){$("syncDot").className="dot "+type;$("syncText").textContent=text}
function applyData(data){
  state.version=8;state.tasks=data.tasks||[];state.completions=data.completions||[];state.goals=data.goals||[];
  state.daySnapshots=data.daySnapshots||{};state.notificationLog=data.notificationLog||{};state.waste=data.waste||state.waste||[];state.settings=data.settings||state.settings||{};
  migrate();
}
async function initSupabase(){
  if(!CONFIG.SUPABASE_URL||!CONFIG.SUPABASE_ANON_KEY||!window.supabase){setSync("local","modo local");return}
  sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  try{
    const{data,error}=await sb.from("base_familia").select("data").eq("id",FAMILY_ID).maybeSingle();
    if(error)throw error;
    if(data&&data.data)applyData(data.data);
    else await sb.from("base_familia").upsert({id:FAMILY_ID,data:state,updated_at:new Date().toISOString()});
    remoteReady=true;setSync("online","sincronizado");
    sb.channel("base-familia-sync-v8").on("postgres_changes",{event:"UPDATE",schema:"public",table:"base_familia",filter:`id=eq.${FAMILY_ID}`},p=>{if(savingRemote)return;if(p.new&&p.new.data){applyData(p.new.data);render(false)}}).subscribe();
  }catch(e){console.error(e);setSync("local","modo local")}
}
let saveTimer=null;
function save(sync=true){
  localSave();
  if(sync&&remoteReady&&sb){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(async()=>{
      savingRemote=true;setSync("online","salvando...");
      await sb.from("base_familia").upsert({id:FAMILY_ID,data:state,updated_at:new Date().toISOString()});
      savingRemote=false;setSync("online","sincronizado");
    },450);
  }
}
function calcXp(t){
  const base=(diff[t.difficulty||"facil"]||diff.facil)[0],min=Number(t.estimatedMinutes||5);
  const tm=min>=60?2:min>=30?1.5:min>=15?1.2:min>=5?1.1:1;
  const fm=t.scheduleType==="monthly"?1.7:t.scheduleType==="weekly"?1.25:1;
  const pm=t.priority==="emergencial"?1.8:t.priority==="alta"?1.35:t.priority==="baixa"?0.85:1;
  const am=t.assignedTo==="Ambos"?1.2:1;
  return Math.round(base*tm*fm*pm*am);
}
function energyFor(t){return Math.max(1,Math.round(calcXp(t)/10))}
function dueOnDate(t,date){
  if(t.active===false)return false;
  if(t.priority==="emergencial")return !isTaskDoneForDate(t.id,dateKey(date));
  const key=dateKey(date),start=parseDate(t.startDate||dateKey(new Date(t.createdAt||Date.now())));
  if(key<dateKey(start))return false;
  // Dependência não esconde a missão no planner; apenas bloqueia o botão de concluir.
  if(t.scheduleType==="daily"){
    const days=Math.floor((parseDate(key)-start)/86400000);
    return days%Number(t.interval||1)===0;
  }
  if(t.scheduleType==="weekly")return(t.weeklyDays||[]).map(Number).includes(date.getDay());
  if(t.scheduleType==="monthly")return date.getDate()===Number(t.monthlyDay||1);
  return false;
}
function dueTasks(key){const d=parseDate(key);return state.tasks.filter(t=>dueOnDate(t,d))}
function hasEverDone(taskId){return state.completions.some(c=>c.taskId===taskId)}
function isTaskDoneForDate(taskId,key){
  return state.completions.some(c=>{
    if(c.taskId!==taskId)return false;
    if(c.dueDate===key)return true;
    if(c.completedAt&&dateKey(new Date(c.completedAt))===key)return true;
    return false;
  });
}
function completionFor(taskId,key){return state.completions.find(c=>c.taskId===taskId&&(c.dueDate===key||(c.completedAt&&dateKey(new Date(c.completedAt))===key)))}
function parentTaskName(parentId){
  const parent=state.tasks.find(t=>t.id===parentId);
  return parent?parent.text:"missão anterior";
}
function isParentDoneForOccurrence(task,dueDate){
  if(!task.parentTaskId)return true;
  // Dependência por ocorrência: para concluir a missão de uma data,
  // a missão anterior precisa estar feita naquela mesma data.
  return isTaskDoneForDate(task.parentTaskId,dueDate);
}
function getMissionStatus(task,dueDate){
  if(isTaskDoneForDate(task.id,dueDate))return{key:"done",icon:"✅",label:"Concluída",canComplete:false};
  if(dueDate>todayKey())return{key:"scheduled",icon:"⏳",label:"Agendada",canComplete:false,detail:`Disponível em ${labelDate(dueDate)}`};
  if(!isParentDoneForOccurrence(task,dueDate))return{key:"locked",icon:"🔒",label:"Bloqueada",canComplete:false,detail:`Aguardando: ${parentTaskName(task.parentTaskId)}`};
  if(dueDate<todayKey())return{key:"late",icon:"⚠️",label:"Atrasada",canComplete:true};
  return{key:"available",icon:"🔓",label:"Disponível",canComplete:true};
}
function makeCompletion(t,dueDate){
  return{id:uid(),taskId:t.id,taskText:t.text,system:t.system,assignedTo:t.assignedTo,completedBy:activeProfile||"Mu",xp:calcXp(t),energy:energyFor(t),dueDate,completedAt:new Date().toISOString()};
}
function completeTask(taskId,dueDate){
  const t=state.tasks.find(x=>x.id===taskId);
  if(!t||isTaskDoneForDate(taskId,dueDate))return;
  const status=getMissionStatus(t,dueDate);
  if(!status.canComplete)return;
  state.completions.push(makeCompletion(t,dueDate));
  snapshot(dueDate); if(dueDate!==todayKey())snapshot(todayKey());
  save(true); maybeLocalCompletionNotify(); render();
}
function undoTask(taskId,dueDate){
  state.completions=state.completions.filter(c=>!(c.taskId===taskId&&(c.dueDate===dueDate||(c.completedAt&&dateKey(new Date(c.completedAt))===dueDate))));
  snapshot(dueDate); if(dueDate!==todayKey())snapshot(todayKey()); render();
}
function dayStats(key,system=null){
  const due=dueTasks(key).filter(t=>!system||t.system===system);
  const done=due.filter(t=>isTaskDoneForDate(t.id,key)).length;
  const percent=due.length?Math.round(done/due.length*100):100;
  return{totalDue:due.length,done,missing:due.length-done,percent,perfect:due.length>0&&done===due.length};
}
function snapshot(key){
  const all=dayStats(key);
  const bySystem={};systemKeys.forEach(s=>bySystem[s]=dayStats(key,s));
  state.daySnapshots[key]={...all,bySystem,updatedAt:new Date().toISOString()};
}
function refreshSnapshots(){for(let i=-14;i<=0;i++)snapshot(dateKey(addDays(parseDate(todayKey()),i)))}
function getInstances(from=-14,to=45){
  const arr=[],base=parseDate(todayKey());
  for(let i=from;i<=to;i++){
    const d=addDays(base,i),key=dateKey(d);
    dueTasks(key).forEach(t=>{const done=isTaskDoneForDate(t.id,key);const parentOk=isParentDoneForOccurrence(t,key);arr.push({task:t,dueDate:key,date:d,done,late:key<todayKey()&&!done&&parentOk,blocked:!done&&!parentOk});});
  }
  return arr;
}
function nextInstance(type=null){
  return getInstances(0,60).filter(i=>!i.done&&(!type||i.task.scheduleType===type)).sort((a,b)=>{
    const sa=getMissionStatus(a.task,a.dueDate),sb=getMissionStatus(b.task,b.dueDate);
    const order={available:0,late:1,locked:2,scheduled:3,done:4};
    if(order[sa.key]!==order[sb.key])return order[sa.key]-order[sb.key];
    if(priorityScore[b.task.priority]!==priorityScore[a.task.priority])return priorityScore[b.task.priority]-priorityScore[a.task.priority];
    return a.dueDate.localeCompare(b.dueDate)||calcXp(b.task)-calcXp(a.task);
  })[0];
}
function labelDate(key){if(key===todayKey())return"Hoje";if(key<todayKey())return"Atrasada";const d=parseDate(key);return`${weekNames[d.getDay()]} ${d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}`}
function tagHtml(t,dueDate){
  return`<div class="meta"><span class="tag">${sysIcon(t.system)} ${sysLabel(t.system)}</span><span class="tag">Qualquer um pode fazer</span><span class="tag">${t.estimatedMinutes||5} min</span><span class="tag">${calcXp(t)} XP</span><span class="tag">${energyFor(t)} energia</span><span class="tag">${labelDate(dueDate)}</span>${t.priority==="emergencial"?'<span class="tag">⚠️ emergencial</span>':""}</div>`;
}
function missionCard(i){
  const t=i.task,who=completionFor(t.id,i.dueDate)?.completedBy,status=getMissionStatus(t,i.dueDate);
  const el=document.createElement("div");
  el.className="mission-card "+status.key;
  const statusLine=status.detail?`<div class="status-line ${status.key}">${status.icon} ${status.label} • ${status.detail}</div>`:`<div class="status-line ${status.key}">${status.icon} ${status.label}</div>`;
  const action=status.key==="done"
    ? `<button class="ghost small" onclick="undoTask('${t.id}','${i.dueDate}')">Desfazer</button>`
    : `<button class="green small" ${status.canComplete?"":"disabled"} onclick="${status.canComplete?`completeTask('${t.id}','${i.dueDate}')`:""}">Feita</button>`;
  el.innerHTML=`<div><div class="mission-title">${sysIcon(t.system)} ${t.text}</div>${tagHtml(t,i.dueDate)}${statusLine}${who?`<p>Feita por ${who}</p>`:""}</div><div class="actions">${action}<button class="small" onclick="openTaskModal('${t.scheduleType}','${t.id}')">Editar</button></div>`;
  return el;
}
function competition(){
  const mu={name:"Mu",xp:personXp("Mu"),tasks:personCount("Mu"),time:personTime("Mu")},ju={name:"Ju",xp:personXp("Ju"),tasks:personCount("Ju"),time:personTime("Ju")};
  return{mu,ju,behindXp:mu.xp<=ju.xp?mu:ju,leaderXp:mu.xp>ju.xp?mu:ju,behindTasks:mu.tasks<=ju.tasks?mu:ju,diffXp:Math.abs(mu.xp-ju.xp),diffTasks:Math.abs(mu.tasks-ju.tasks)};
}
function personXp(p){return state.completions.filter(c=>c.completedBy===p).reduce((s,c)=>s+Number(c.xp||0),0)}
function personCount(p){return state.completions.filter(c=>c.completedBy===p).length}
function personTime(p){return state.completions.filter(c=>c.completedBy===p).reduce((s,c)=>{const t=state.tasks.find(x=>x.id===c.taskId);return s+Number(t?.estimatedMinutes||0)},0)}
function baseXp(){return state.completions.reduce((s,c)=>s+Number(c.xp||0),0)+perfectDays()*50+completedGoals()*500}
function baseEnergy(){return Math.min(100,state.completions.filter(c=>c.dueDate>=dateKey(addDays(new Date(),-7))).reduce((s,c)=>s+Number(c.energy||0),0))}
function perfectDays(){return Object.values(state.daySnapshots).filter(s=>s.perfect).length}
function completedGoals(){return state.goals.filter(g=>Number(g.current||0)>=Number(g.target||0)&&Number(g.target)>0).length}
function beerForXp(xp){const idx=Math.min(beerLevels.length-1,Math.floor(xp/750));return{name:beerLevels[idx][0],title:beerLevels[idx][1],xp:Math.round(xp),progress:Math.round((xp%750)/750*100)}}
function streakFor(system=null){
  let count=0,d=parseDate(todayKey());
  while(true){
    const key=dateKey(d),due=dueTasks(key).filter(t=>!system||t.system===system);
    if(!due.length)break;
    if(due.every(t=>isTaskDoneForDate(t.id,key))){count++;d=addDays(d,-1)}else break;
  }
  return count;
}
function systemHealth(system){
  const today=dayStats(todayKey(),system).percent;
  let recent=0,days=0;
  for(let i=0;i<7;i++){const s=dayStats(dateKey(addDays(parseDate(todayKey()),-i)),system);if(s.totalDue){recent+=s.percent;days++}}
  const avg=days?Math.round(recent/days):100;
  const late=getInstances(-7,-1).filter(i=>i.late&&i.task.system===system).length;
  return Math.max(0,Math.min(100,Math.round(avg-late*8)));
}
function baseHealth(){return Math.round(systemKeys.reduce((s,k)=>s+systemHealth(k),0)/systemKeys.length)}
function overloadForecast(){
  let worst={date:null,count:0};
  for(let i=0;i<7;i++){const d=addDays(parseDate(todayKey()),i),key=dateKey(d),count=dueTasks(key).filter(t=>!isTaskDoneForDate(t.id,key)).reduce((s,t)=>s+Number(t.estimatedMinutes||5),0);if(count>worst.count)worst={date:key,count}}
  return worst;
}
function smartNotices(){
  const st=dayStats(todayKey()),late=getInstances(-30,-1).filter(i=>i.late),today=getInstances(0,0).filter(i=>!i.done),best=[...late,...today].filter(i=>i.task.notify!==false).sort((a,b)=>{
    if((a.late?1:0)!==(b.late?1:0))return (b.late?1:0)-(a.late?1:0);
    if(priorityScore[b.task.priority]!==priorityScore[a.task.priority])return priorityScore[b.task.priority]-priorityScore[a.task.priority];
    return Number(a.task.estimatedMinutes||5)-Number(b.task.estimatedMinutes||5);
  })[0],comp=competition(),arr=[],forecast=overloadForecast();
  if(activeProfile)arr.push({type:"personal",icon:"👤",title:`Perfil ativo: ${activeProfile}`,text:"XP e provocações estão personalizados para este aparelho."});
  if(late.length)arr.push({type:"danger",icon:"⚠️",title:`${late.length} atrasada(s)`,text:`Comece por: ${late[0].task.text}.`});
  if(st.totalDue>0&&st.done===st.totalDue-1)arr.push({type:"good",icon:"⭐",title:"Falta só 1 missão para Dia Perfeito",text:"Fecha essa e a Base ganha moral hoje."});
  if(best)arr.push({type:"tip",icon:"🧠",title:"Sugestão da Base",text:`${best.task.text} • ${best.task.estimatedMinutes||5} min • ${calcXp(best.task)} XP.`});
  if(activeProfile&&comp.diffXp>=50){
    if(comp.behindXp.name===activeProfile)arr.push({type:"tip",icon:"🏁",title:"Dá para virar o jogo",text:`Você está ${Math.round(comp.diffXp)} XP atrás. Uma missão média já ajuda.`});
    else arr.push({type:"good",icon:"🔥",title:"Você está liderando",text:`Vantagem de ${Math.round(comp.diffXp)} XP. Mantém o ritmo.`});
  }
  if(forecast.count>=90)arr.push({type:"danger",icon:"📈",title:"Risco de sobrecarga",text:`${labelDate(forecast.date)} tem cerca de ${forecast.count} min acumulados.`});
  systemKeys.forEach(k=>{const h=systemHealth(k);if(h<60)arr.push({type:"danger",icon:sysIcon(k),title:`${sysLabel(k)} precisa de atenção`,text:`Saúde do sistema em ${h}%.`})});
  return arr.length?arr:[{type:"good",icon:"🌿",title:"Base tranquila",text:"Nada urgente agora."}];
}
function noticesHtml(){return `<div class="smart-strip">${smartNotices().slice(0,5).map(n=>`<div class="notice ${n.type}"><div class="notice-icon">${n.icon}</div><div><strong>${n.title}</strong><p>${n.text}</p></div></div>`).join("")}</div>`}
function renderMissions(){
  refreshSnapshots();
  $("todayDate").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
  document.querySelectorAll(".mission-tab").forEach(b=>b.classList.toggle("active",b.dataset.missionView===missionView));
  if(missionView==="base")renderMissionBase();if(missionView==="daily")renderMissionDaily();if(missionView==="weekly")renderMissionWeekly();if(missionView==="monthly")renderMissionMonthly();
}
function renderMissionBase(){
  const general=nextInstance(),daily=nextInstance("daily"),weekly=nextInstance("weekly"),monthly=nextInstance("monthly"),late=getInstances(-30,-1).filter(i=>i.late),blockedToday=getInstances(0,0).filter(i=>getMissionStatus(i.task,i.dueDate).key==="locked").length,st=dayStats(todayKey());
  $("missionView").innerHTML=`${noticesHtml()}<div class="mission-lobby"><div class="card"><div class="section-head"><h2>Próxima</h2></div><div id="generalNext"></div></div><div class="card"><div class="section-head"><h2>Base hoje</h2></div><div class="stats-grid"><div class="stat"><strong>${st.done}/${st.totalDue}</strong><span>feitas</span></div><div class="stat"><strong>${st.percent}%</strong><span>progresso</span></div><div class="stat"><strong>${blockedToday}</strong><span>bloqueadas</span></div><div class="stat"><strong>${st.perfect?"⭐":"—"}</strong><span>dia perfeito</span></div></div></div></div><div class="card"><div class="panel-grid"><div class="panel"><div class="panel-title">☀️ Diária</div><div id="nextDaily"></div></div><div class="panel"><div class="panel-title">📆 Semanal</div><div id="nextWeekly"></div></div><div class="panel"><div class="panel-title">🗓️ Mensal</div><div id="nextMonthly"></div></div></div></div><div class="card"><div class="section-head"><h2>Atrasadas</h2><span class="pill">${late.length}</span></div><div id="lateList" class="mission-list"></div></div>`;
  renderMini("generalNext",general,true);renderMini("nextDaily",daily);renderMini("nextWeekly",weekly);renderMini("nextMonthly",monthly);
  const lateList=$("lateList");if(!late.length)lateList.innerHTML=`<div class="empty">Nenhuma atrasada.</div>`;late.slice(0,8).forEach(i=>lateList.appendChild(missionCard(i)));
}
function renderMini(id,i,big=false){
  const box=$(id);if(!i){box.innerHTML=`<div class="empty">Nada pendente.</div>`;return}
  const t=i.task,status=getMissionStatus(t,i.dueDate);
  const statusLine=status.detail?`<div class="status-line ${status.key}">${status.icon} ${status.label} • ${status.detail}</div>`:`<div class="status-line ${status.key}">${status.icon} ${status.label}</div>`;
  box.innerHTML=`<div class="${big?'panel big':''}"><div class="mission-title">${sysIcon(t.system)} ${t.text}</div>${tagHtml(t,i.dueDate)}${statusLine}<div class="actions"><button class="green small" ${status.canComplete?"":"disabled"} onclick="${status.canComplete?`completeTask('${t.id}','${i.dueDate}')`:""}">Feita</button><button class="small" onclick="missionView='${t.scheduleType}';renderMissions()">Ver</button></div></div>`;
}
function renderMissionDaily(){const today=getInstances(0,0).filter(i=>i.task.scheduleType==="daily"||i.task.priority==="emergencial");$("missionView").innerHTML=`${noticesHtml()}<div class="card"><div class="view-head"><h2>Diárias</h2><button class="small" onclick="openTaskModal('daily')">+ Nova diária</button></div><div id="dailyList" class="mission-list"></div></div>`;const list=$("dailyList");if(!today.length)list.innerHTML=`<div class="empty">Nenhuma diária para hoje.</div>`;today.forEach(i=>list.appendChild(missionCard(i)))}
function renderMissionWeekly(){const base=parseDate(todayKey()),monday=addDays(base,-((base.getDay()+6)%7));$("missionView").innerHTML=`${noticesHtml()}<div class="card"><div class="view-head"><h2>Semanais</h2><button class="small" onclick="openTaskModal('weekly')">+ Nova semanal</button></div><div class="week-board" id="weekBoard"></div></div>`;const board=$("weekBoard");for(let i=0;i<7;i++){const d=addDays(monday,i),key=dateKey(d),items=dueTasks(key).filter(t=>t.scheduleType==="weekly").map(t=>({task:t,dueDate:key,date:d,done:isTaskDoneForDate(t.id,key),late:key<todayKey()&&!isTaskDoneForDate(t.id,key)&&isParentDoneForOccurrence(t,key),blocked:!isTaskDoneForDate(t.id,key)&&!isParentDoneForOccurrence(t,key)})),col=document.createElement("div");col.className="week-day";col.innerHTML=`<strong>${weekFull[d.getDay()]}</strong><div class="mission-list"></div>`;const list=col.querySelector(".mission-list");if(!items.length)list.innerHTML=`<div class="empty">—</div>`;items.forEach(inst=>list.appendChild(missionCard(inst)));board.appendChild(col)}}
function renderMissionMonthly(){const items=getInstances(0,45).filter(i=>i.task.scheduleType==="monthly"&&!i.done).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));$("missionView").innerHTML=`${noticesHtml()}<div class="card"><div class="view-head"><h2>Mensais</h2><button class="small" onclick="openTaskModal('monthly')">+ Nova mensal</button></div><div id="monthlyList" class="month-list"></div></div>`;const list=$("monthlyList");if(!items.length)list.innerHTML=`<div class="empty">Nenhuma mensal próxima.</div>`;items.forEach(i=>list.appendChild(missionCard(i)))}
function fillParentOptions(currentId=""){
  const sel=$("taskParent");sel.innerHTML='<option value="">Sem missão anterior</option>';
  state.tasks.filter(t=>t.id!==currentId).forEach(t=>{const o=document.createElement("option");o.value=t.id;o.textContent=`Só liberar depois de: ${t.text}`;sel.appendChild(o)});
}

function updateRepeatFields(type){
  document.querySelectorAll(".repeat-field").forEach(el=>el.classList.add("hidden"));
  if(type==="daily")document.querySelectorAll(".repeat-daily").forEach(el=>el.classList.remove("hidden"));
  if(type==="weekly")document.querySelectorAll(".repeat-weekly").forEach(el=>el.classList.remove("hidden"));
  if(type==="monthly")document.querySelectorAll(".repeat-monthly").forEach(el=>el.classList.remove("hidden"));
}

function openTaskModal(type,taskId=null){
  taskModalType=type;editingTaskId=taskId;const t=taskId?state.tasks.find(x=>x.id===taskId):null;
  $("taskModalTitle").textContent=t?"Editar missão":type==="daily"?"Nova diária":type==="weekly"?"Nova semanal":"Nova mensal";
  $("taskText").value=t?.text||"";$("taskSystem").value=t?.system||"casa";$("taskDifficulty").value=t?.difficulty||"facil";$("taskPriority").value=t?.priority||"normal";$("taskMinutes").value=t?.estimatedMinutes||5;$("taskPreferredTime").value=t?.preferredTime||"";$("taskInterval").value=t?.interval||1;$("taskMonthlyDay").value=t?.monthlyDay||1;$("taskNotify").value=String(t?.notify!==false);
  fillParentOptions(t?.id||"");$("taskParent").value=t?.parentTaskId||"";
  updateRepeatFields(type);
  $("weekdayBox").innerHTML=[0,1,2,3,4,5,6].map(d=>`<button type="button" class="weekday ${(t?.weeklyDays||[]).includes(d)?"active":""}" data-day="${d}">${weekNames[d]}</button>`).join("");
  document.querySelectorAll(".weekday").forEach(b=>b.onclick=()=>b.classList.toggle("active"));$("taskModal").classList.add("open");
}
function saveTask(){
  const text=$("taskText").value.trim();if(!text)return alert("Digite o nome.");
  const data={text,system:$("taskSystem").value,assignedTo:"Qualquer um",difficulty:$("taskDifficulty").value,priority:$("taskPriority").value,estimatedMinutes:Number($("taskMinutes").value||5),preferredTime:$("taskPreferredTime").value||"",scheduleType:taskModalType,interval:Number($("taskInterval").value||1),monthlyDay:Number($("taskMonthlyDay").value||1),weeklyDays:[...document.querySelectorAll(".weekday.active")].map(b=>Number(b.dataset.day)),notify:$("taskNotify").value==="true",parentTaskId:$("taskParent").value||"",active:true};
  if(taskModalType==="weekly"&&!data.weeklyDays.length)return alert("Escolha ao menos um dia.");
  if(editingTaskId)Object.assign(state.tasks.find(x=>x.id===editingTaskId),data);else state.tasks.push({...data,id:uid(),startDate:todayKey(),createdAt:new Date().toISOString()});
  $("taskModal").classList.remove("open");render();
}
function renderBase(){
  const mx=personXp("Mu"),jx=personXp("Ju"),bx=baseXp(),hs=homeStage(),health=baseHealth(),energy=baseEnergy();
  $("homeStageIcon").textContent=hs.icon;$("homeStageName").textContent=hs.name;$("homeStageDesc").textContent=`${Math.round(bx)} XP • ${perfectDays()} dias perfeitos • ${completedGoals()} metas concluídas`;$("baseLevelPill").textContent=`Nível ${hs.idx+1}`;$("homeProgress").style.width=Math.min(100,Math.round((bx-hs.min)/Math.max(1,hs.next-hs.min)*100))+"%";
  $("baseHealthPill").textContent=health+"%";$("baseHealthProgress").style.width=health+"%";$("energyText").textContent=energy+"/100";
  $("dashMuBeer").textContent="🍺 "+beerForXp(mx).name;$("dashMuSummary").textContent=`${Math.round(mx)} XP • ${personCount("Mu")} missões • ${personTime("Mu")} min`;
  $("dashJuBeer").textContent="🍺 "+beerForXp(jx).name;$("dashJuSummary").textContent=`${Math.round(jx)} XP • ${personCount("Ju")} missões • ${personTime("Ju")} min`;
  renderSystemHealth();renderStreaks();renderProfiles();renderCompetition();
}
function homeStage(){const xp=baseXp();let idx=0;for(let i=0;i<homeStages.length;i++)if(xp>=homeStages[i][2])idx=i;return{idx,icon:homeStages[idx][0],name:homeStages[idx][1],next:homeStages[idx+1]?.[2]||homeStages[idx][2],min:homeStages[idx][2]}}
function renderSystemHealth(){
  $("systemHealthGrid").innerHTML="";
  systemKeys.forEach(k=>{const h=systemHealth(k),d=document.createElement("div");d.className="system-card";d.innerHTML=`<strong>${sysIcon(k)} ${sysLabel(k)}</strong><p>${h}% saudável</p><div class="progress"><div class="progress-fill" style="width:${h}%"></div></div>`;$("systemHealthGrid").appendChild(d)});
}
function renderStreaks(){$("streakGrid").innerHTML=[["🏡","Base",null],...systemKeys.map(k=>[sysIcon(k),sysLabel(k),k])].map(([i,n,c])=>`<div class="streak-card"><strong>${i} ${n}</strong><p>${streakFor(c)} dias seguidos</p></div>`).join("")}
function renderProfiles(){
  $("profileGrid").innerHTML="";
  [["Mu",personXp("Mu"),"👨"],["Ju",personXp("Ju"),"👩"]].forEach(([name,xp,emoji])=>{const d=document.createElement("div");d.className="profile-card";d.innerHTML=`<div class="profile-avatar">${emoji}</div><h3>${name}</h3><p>${Math.round(xp)} XP</p><div class="avatar-items">${avatarItems.map(([icon,label,need])=>`<span class="item ${xp>=need?"":"locked"}">${icon} ${label}</span>`).join("")}</div>`;$("profileGrid").appendChild(d)});
}
function renderCompetition(){
  const c=competition(),viewer=activeProfile,other=viewer==="Mu"?"Ju":"Mu";
  $("competitionBox").innerHTML=`<div class="notice personal"><div class="notice-icon">🏁</div><div><strong>${c.leaderXp.name} lidera no XP</strong><p>Diferença: ${Math.round(c.diffXp)} XP.</p></div></div><div class="notice tip"><div class="notice-icon">📊</div><div><strong>${c.behindTasks.name} fez menos missões</strong><p>Diferença: ${c.diffTasks} missões.</p></div></div>${viewer?`<div class="notice ${c.behindXp.name===viewer?'danger':'good'}"><div class="notice-icon">${c.behindXp.name===viewer?'⚡':'🔥'}</div><div><strong>${c.behindXp.name===viewer?'Você pode virar':'Você está na frente'}</strong><p>${c.behindXp.name===viewer?'Faça uma missão rápida para encostar.':'Mantenha a sequência para não perder a liderança.'}</p></div></div>`:""}`;
}

function addWaste(){
  const type=$("wasteType")?.value;
  const amount=Number($("wasteAmount")?.value||0);
  if(!type||!amount)return alert("Coloque um valor.");
  state.waste=state.waste||[];
  state.waste.push({id:uid(),type,amount,profile:activeProfile||"sem perfil",createdAt:new Date().toISOString()});
  $("wasteAmount").value="";
  render();
}
function deleteWaste(id){
  state.waste=(state.waste||[]).filter(w=>w.id!==id);
  render();
}
function renderWaste(){
  if(!$("wasteStats"))return;
  const now=new Date(),monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const rows=(state.waste||[]).filter(w=>(w.createdAt||"").slice(0,7)===monthKey);
  const label={alcool:"🍻 Álcool",maconha:"🌿 Maconha",delivery:"🍔 Delivery"};
  const total=rows.reduce((s,w)=>s+Number(w.amount||0),0);
  $("wasteMonthTotal").textContent=`${money(total)} no mês`;
  $("wasteStats").innerHTML=["alcool","maconha","delivery"].map(k=>{
    const v=rows.filter(w=>w.type===k).reduce((s,w)=>s+Number(w.amount||0),0);
    return `<div class="stat"><strong>${money(v)}</strong><span>${label[k]}</span></div>`;
  }).join("");
  const list=$("wasteList");
  if(!rows.length){list.innerHTML=`<div class="empty">Nenhum gasto registrado este mês.</div>`;return}
  list.innerHTML="";
  rows.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30).forEach(w=>{
    const e=document.createElement("div");
    e.className="entry";
    e.innerHTML=`<div><strong>${label[w.type]} • ${money(w.amount)}</strong><p>${w.profile||""} • ${new Date(w.createdAt).toLocaleString("pt-BR")}</p></div><button class="red small" onclick="deleteWaste('${w.id}')">X</button>`;
    list.appendChild(e);
  });
}

function renderGoals(){
  const saved=state.goals.reduce((s,g)=>s+Number(g.current||0),0),target=state.goals.reduce((s,g)=>s+Number(g.target||0),0);
  $("cofrinhoTotal").textContent=money(saved);$("cofrinhoMissing").textContent=money(Math.max(0,target-saved));$("cofrinhoCount").textContent=state.goals.length;$("goalList").innerHTML="";
  if(!state.goals.length){$("goalList").innerHTML=`<div class="empty">Nenhuma meta.</div>`;return}
  state.goals.forEach(g=>{const pct=Math.min(100,g.target?Math.round(Number(g.current||0)/Number(g.target)*100):0),d=document.createElement("div");d.className="goal";d.innerHTML=`<div class="goal-top"><div><strong>${sysIcon(g.system)||"🎯"} ${g.name}</strong><p>Faltam ${money(Math.max(0,Number(g.target)-Number(g.current||0)))}</p></div><strong>${money(g.current)} / ${money(g.target)}</strong></div><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div><div class="goal-actions"><input id="goal-${g.id}" type="number" step="0.01" placeholder="Adicionar R$"><button class="green small" onclick="addGoalMoney('${g.id}')">Adicionar</button><button class="red small" onclick="deleteGoal('${g.id}')">X</button></div>`;$("goalList").appendChild(d)});
}
function addGoal(){const name=$("goalName").value.trim(),target=Number($("goalTarget").value);if(!name||!target)return alert("Preencha nome e valor.");state.goals.push({id:uid(),name,system:$("goalSystem").value,target,current:0});$("goalModal").classList.remove("open");$("goalName").value="";$("goalTarget").value="";render()}
function addGoalMoney(id){const g=state.goals.find(x=>x.id===id),v=Number($("goal-"+id).value);if(!g||!v)return;g.current=Number(g.current||0)+v;render()}
function deleteGoal(id){if(confirm("Excluir meta?")){state.goals=state.goals.filter(g=>g.id!==id);render()}}
function renderHall(){
  const list=[],total=state.completions.length;[1,5,10,25,50,100,250,500].forEach(n=>list.push({cat:"Todas",name:`${n} missões feitas`,ok:total>=n,icon:"🏆"}));
  [1,3,7,15,30,60,100].forEach(n=>list.push({cat:"Dia Perfeito",name:`${n} dias perfeitos`,ok:perfectDays()>=n,icon:"⭐"}));
  systemKeys.forEach(k=>[1,5,10,25,50,100].forEach(n=>list.push({cat:sysLabel(k),name:`${n} em ${sysLabel(k)}`,ok:state.completions.filter(x=>x.system===k).length>=n,icon:sysIcon(k)})));
  [10,30,60,120,300].forEach(n=>list.push({cat:"Tempo",name:`${n} min investidos`,ok:personTime("Mu")+personTime("Ju")>=n,icon:"⏱️"}));
  const cats=["Todas","Pets","Casa","Financeiro","Relacionamento","Saúde","Dia Perfeito","Tempo"],un=list.filter(a=>a.ok).length;$("achievementBadge").textContent=un;$("trophyTabs").innerHTML="";
  cats.forEach(c=>{const b=document.createElement("button");b.className="small "+(trophyFilter===c?"active":"");b.textContent=c;b.onclick=()=>{trophyFilter=c;renderHall()};$("trophyTabs").appendChild(b)});
  $("achievementList").innerHTML="";(trophyFilter==="Todas"?list:list.filter(x=>x.cat===trophyFilter)).forEach(a=>{const d=document.createElement("div");d.className="trophy "+(a.ok?"":"locked");d.innerHTML=`<div class="trophy-icon">${a.ok?a.icon:"🔒"}</div><strong>${a.name}</strong>`;$("achievementList").appendChild(d)});
}
function renderHistory(){
  const names=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();
  $("monthTitle").textContent=`${names[m]} de ${y}`;const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();let off=first.getDay()-1;if(off<0)off=6;$("calendarDays").innerHTML="";
  for(let i=0;i<off;i++){const e=document.createElement("div");e.className="day empty";$("calendarDays").appendChild(e)}
  for(let d=1;d<=days;d++){const k=dateKey(new Date(y,m,d)),s=dayStats(k),el=document.createElement("div");el.className="day "+(k===todayKey()?"today":"");el.innerHTML=`<strong>${d}</strong><div class="day-score">${s.done}/${s.totalDue}</div><div class="day-score">${s.percent}% ${s.perfect?"⭐":""}</div>`;$("calendarDays").appendChild(el)}
  $("completedList").innerHTML="";state.completions.slice().sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).slice(0,80).forEach(c=>{const e=document.createElement("div");e.className="entry";e.innerHTML=`<div><strong>${sysIcon(c.system)} ${c.taskText}</strong><p>${c.completedBy} • ${new Date(c.completedAt).toLocaleString("pt-BR")} • ${c.xp} XP • ${c.energy||0} energia</p></div>`;$("completedList").appendChild(e)});
}
function renderNotifyModal(){
  $("smartNotifications").innerHTML=smartNotices().map(n=>`<div class="notice ${n.type}"><div class="notice-icon">${n.icon}</div><div><strong>${n.title}</strong><p>${n.text}</p></div></div>`).join("");
  let status="Este aparelho ainda não confirmou permissão de notificação.";
  if("Notification" in window){
    if(Notification.permission==="granted")status=`<strong>Notificações ativas</strong><br>Este aparelho recebe avisos do perfil ${activeProfile||"não escolhido"}.`;
    if(Notification.permission==="denied")status=`<strong>Notificações bloqueadas</strong><br>Ative manualmente nas permissões do navegador.`;
    if(Notification.permission==="default")status=`<strong>Permissão pendente</strong><br>O app vai pedir permissão para enviar avisos.`;
  }
  $("pushStatus").innerHTML=status;
}
async function enablePush(){
  await autoEnablePush(true);
}
async function autoEnablePush(force=false){
  if(!activeProfile)return;
  if(!force && localStorage.getItem("bf_push_prompted_"+activeProfile)==="yes")return;
  if(!("Notification" in window))return;
  try{
    window.OneSignalDeferred=window.OneSignalDeferred||[];
    window.OneSignalDeferred.push(async function(OneSignal){
      await OneSignal.init({appId:CONFIG.ONESIGNAL_APP_ID,serviceWorkerPath:"OneSignalSDKWorker.js"});
      await OneSignal.User.addTag("profile",activeProfile);
      if(force || Notification.permission==="default"){
        await OneSignal.Notifications.requestPermission();
      }
      localStorage.setItem("bf_push_prompted_"+activeProfile,"yes");
      renderNotifyModal();
    });
  }catch(e){
    console.error(e);
  }
}
function browserNotify(title,body){if("Notification"in window&&Notification.permission==="granted")new Notification(title,{body,icon:"icon-192.png"})}
function requestLocalNotifications(){if(!("Notification"in window))return alert("Sem suporte.");Notification.requestPermission().then(p=>{if(p==="granted")browserNotify("🔔 Base da Família","Teste local funcionando.");else alert("Permissão negada.")})}
async function testServerPush(){const r=await fetch("/.netlify/functions/send-push",{method:"POST"});const text=await r.text();alert(r.ok?"Push servidor enviado.":"Erro no push servidor: "+text.slice(0,180))}
function maybeLocalCompletionNotify(){const st=dayStats(todayKey());if(st.totalDue>0&&st.done===st.totalDue)browserNotify("⭐ Dia Perfeito","Todas as missões de hoje foram concluídas.");else if(st.totalDue>0&&st.done===st.totalDue-1)browserNotify("Quase lá","Falta só uma missão para o Dia Perfeito.")}
function render(sync=true){renderMissions();renderBase();renderGoals();renderWaste();renderHall();renderHistory();renderNotifyModal();$("activeProfilePill").textContent=activeProfile?`👤 ${activeProfile}`:"sem perfil";save(sync)}
function setProfile(p){
  activeProfile=p;
  localStorage.setItem("bf_active_profile",p);
  $("profileGate").classList.add("hidden");
  render(false);
  setTimeout(()=>autoEnablePush(),800);
}
function setup(){
  const theme=localStorage.getItem("bf_theme")||"dark";document.documentElement.dataset.theme=theme;$("themeToggle").textContent=theme==="dark"?"☀️ Tema":"🌙 Tema";
  $("themeToggle").onclick=()=>{const n=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=n;localStorage.setItem("bf_theme",n);$("themeToggle").textContent=n==="dark"?"☀️ Tema":"🌙 Tema"};
  document.querySelectorAll(".profile-choice").forEach(b=>b.onclick=()=>setProfile(b.dataset.profile));if(activeProfile){$("profileGate").classList.add("hidden");setTimeout(()=>autoEnablePush(),1200)}
  $("switchProfileBtn").onclick=()=>{$("profileGate").classList.remove("hidden")};
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$("screen-"+b.dataset.screen).classList.add("active");document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active")});
  document.querySelectorAll(".mission-tab").forEach(b=>b.onclick=()=>{missionView=b.dataset.missionView;renderMissions()});
  $("saveTaskBtn").onclick=saveTask;$("closeTaskModal").onclick=()=>$("taskModal").classList.remove("open");
  $("openGoalBtn").onclick=()=>$("goalModal").classList.add("open");$("closeGoalBtn").onclick=()=>$("goalModal").classList.remove("open");$("saveGoalBtn").onclick=addGoal;if($("addWasteBtn"))$("addWasteBtn").onclick=addWaste;
  $("prevMonthBtn").onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);render(false)};$("nextMonthBtn").onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);render(false)};
  $("notifyBtn").onclick=()=>{$("notifyModal").classList.add("open");renderNotifyModal()};$("closeNotifyBtn").onclick=()=>$("notifyModal").classList.remove("open");
  $("enablePushBtn").onclick=enablePush;
}
migrate();setup();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});render(false);initSupabase().then(()=>render(false));