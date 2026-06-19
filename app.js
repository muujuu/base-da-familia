const CONFIG = {
  SUPABASE_URL: "https://ukpbnqzsthxywgabpumj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcGJucXpzdGh4eXdnYWJwdW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI4MjYsImV4cCI6MjA5NzMzODgyNn0.ClYdAiMO-Uh7Oj96xqT63OiTL7FkImTWu1iK1qMNCHo"
};

const FAMILY_ID = "base-mu-ju";
let sb = null, remoteReady = false, savingRemote = false, trophyFilter = "Todas";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

let state = {
  tasks: JSON.parse(localStorage.getItem("bf_tasks") || "[]"),
  checks: JSON.parse(localStorage.getItem("bf_checks") || "{}"),
  finances: JSON.parse(localStorage.getItem("bf_finances") || "[]"),
  goals: JSON.parse(localStorage.getItem("bf_goals") || "[]"),
  rewardsUsed: JSON.parse(localStorage.getItem("bf_rewards_used") || "[]")
};

const beerLevels = [
  ["Bavaria","O Início da Jornada"],["Skol","Operador da Base"],["Brahma","Morador Oficial"],
  ["Original","Guardião da Geladeira"],["Heineken","Especialista da Base"],["Eisenbahn","Veterano"],
  ["Baden Baden","Mestre das Rotinas"],["Patagonia","Comandante da Base"],
  ["Stella Artois","Arquiteto da Família"],["Colorado","Lenda da Base"],["Hoegaarden","Cervejeiro Supremo"]
];

const diff = {facil:[10,"🟢 Fácil"],media:[25,"🔵 Média"],dificil:[50,"🟣 Difícil"],muito_dificil:[100,"🔴 Muito difícil"]};
const timeMult = {1:1,5:1.1,15:1.2,30:1.5,60:2};
const freqMult = {diaria:1,semanal:1.25,mensal:1.7,rara:2.2};
const freqLabel = {diaria:"Diária",semanal:"Semanal",mensal:"Mensal",rara:"Rara"};

const rewardCatalog = [
  {id:"mu_cerveja",type:"individual",person:"Mu",emoji:"🍺",name:"Cerveja individual do Mu",xp:750,tasks:25},
  {id:"mu_ifood",type:"individual",person:"Mu",emoji:"🍔",name:"Ifood individual do Mu",xp:1500,tasks:50},
  {id:"mu_premium",type:"individual",person:"Mu",emoji:"🌿",name:"Recompensa premium do Mu",xp:3000,tasks:100},
  {id:"ju_cerveja",type:"individual",person:"Ju",emoji:"🍺",name:"Cerveja individual da Ju",xp:750,tasks:25},
  {id:"ju_ifood",type:"individual",person:"Ju",emoji:"🍔",name:"Ifood individual da Ju",xp:1500,tasks:50},
  {id:"ju_premium",type:"individual",person:"Ju",emoji:"🌿",name:"Recompensa premium da Ju",xp:3000,tasks:100},
  {id:"base_cervejada",type:"conjunta",emoji:"🍺",name:"Cervejada pequena",xp:1500,tasks:40,streak:7,money:0,goals:0},
  {id:"base_ifood",type:"conjunta",emoji:"🍔",name:"Ifood da Base",xp:3500,tasks:80,streak:15,money:100,goals:0},
  {id:"base_japa",type:"conjunta",emoji:"🍣",name:"Comida japonesa",xp:7000,tasks:150,streak:30,money:300,goals:0},
  {id:"base_top",type:"conjunta",emoji:"🌿",name:"Noite premium / maconha top",xp:12000,tasks:250,streak:45,money:1000,goals:1},
  {id:"base_dogs",type:"conjunta",emoji:"🥩",name:"Carne pras cachorras + rolê",xp:18000,tasks:350,streak:60,money:1500,goals:2}
];

function $(id) { return document.getElementById(id); }
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function money(v) { return Number(v || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); }
function uid() { return Date.now().toString() + Math.random().toString(16).slice(2); }

function localSave() {
  localStorage.setItem("bf_tasks", JSON.stringify(state.tasks));
  localStorage.setItem("bf_checks", JSON.stringify(state.checks));
  localStorage.setItem("bf_finances", JSON.stringify(state.finances));
  localStorage.setItem("bf_goals", JSON.stringify(state.goals));
  localStorage.setItem("bf_rewards_used", JSON.stringify(state.rewardsUsed || []));
}

function setSync(type, text) {
  $("syncDot").className = "dot " + type;
  $("syncText").textContent = text;
}

async function initSupabase() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !window.supabase) {
    setSync("local","modo local");
    return;
  }
  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  try {
    const {data, error} = await sb.from("base_familia").select("data").eq("id", FAMILY_ID).maybeSingle();
    if (error) throw error;
    if (data && data.data) applyData(data.data);
    else await sb.from("base_familia").upsert({id:FAMILY_ID, data:state, updated_at:new Date().toISOString()});
    remoteReady = true;
    setSync("online","sincronizado");
    sb.channel("base-familia-sync").on("postgres_changes", {event:"UPDATE",schema:"public",table:"base_familia",filter:`id=eq.${FAMILY_ID}`}, p => {
      if (savingRemote) return;
      if (p.new && p.new.data) { applyData(p.new.data); render(false); }
    }).subscribe();
  } catch(e) {
    console.error(e);
    setSync("local","modo local: erro no Supabase");
  }
}

function applyData(data) {
  state.tasks = data.tasks || [];
  state.checks = data.checks || {};
  state.finances = data.finances || [];
  state.goals = data.goals || [];
  state.rewardsUsed = data.rewardsUsed || [];
  localSave();
}

let saveTimer = null;
function save(sync=true) {
  localSave();
  if (sync && remoteReady && sb) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      savingRemote = true;
      setSync("online","salvando...");
      await sb.from("base_familia").upsert({id:FAMILY_ID, data:state, updated_at:new Date().toISOString()});
      savingRemote = false;
      setSync("online","sincronizado");
    }, 500);
  }
}

function calcTaskXp(t) {
  return Math.round((diff[t.difficulty || "facil"] || diff.facil)[0] * (timeMult[t.time || 1] || 1) * (freqMult[t.frequency || "diaria"] || 1) * (t.person === "Ambos" ? 1.25 : 1));
}

function isDone(id, key=dateKey(new Date())) { return state.checks[key] && state.checks[key][id] === true; }

function getDayStats(key=dateKey(new Date())) {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => state.checks[key] && state.checks[key][t.id]).length;
  return {total, done, pending: total-done, percent: total ? Math.round(done/total*100) : 0};
}

function doneEntries() {
  const arr = [];
  Object.entries(state.checks).forEach(([day,obj]) => Object.entries(obj).forEach(([id,val]) => {
    if (val) {
      const task = state.tasks.find(t => t.id === id);
      if (task) arr.push({day, task, xp: calcTaskXp(task)});
    }
  }));
  return arr;
}

function personXp(p) {
  return doneEntries().filter(e => e.task.person === p || e.task.person === "Ambos").reduce((s,e) => s + e.xp/(e.task.person === "Ambos" ? 2 : 1), 0);
}

function baseXp() {
  const goalMoney = state.goals.reduce((s,g) => s + Number(g.current || 0), 0);
  return Math.round(doneEntries().reduce((s,e) => s + e.xp, 0) + goalMoney/5 + completedGoals()*500 + streak()*25);
}

function beerForXp(xp) {
  const idx = Math.min(beerLevels.length - 1, Math.floor(xp / 750));
  return {idx, name: beerLevels[idx][0], title: beerLevels[idx][1], progress: Math.round((xp % 750)/750*100), xp: Math.round(xp)};
}

function streak() {
  let count = 0, d = new Date();
  while (true) {
    const s = getDayStats(dateKey(d));
    if (s.total > 0 && s.percent >= 50) { count++; d.setDate(d.getDate()-1); }
    else break;
  }
  return count;
}

function financeTotals() {
  const now = new Date();
  const items = state.finances.filter(i => {
    const d = new Date(i.date + "T00:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const income = items.filter(i => i.type === "in").reduce((s,i) => s + Number(i.value), 0);
  const spent = items.filter(i => i.type === "out").reduce((s,i) => s + Number(i.value), 0);
  const goalsTotal = state.goals.reduce((s,g) => s + Number(g.current || 0), 0);
  return {income, spent, balance: income-spent, goalsTotal, items};
}

function completedGoals() { return state.goals.filter(g => Number(g.current) >= Number(g.target)).length; }
function totalTasksDone(cat=null) { return doneEntries().filter(e => !cat || e.task.category === cat).length; }
function personMissionCount(p) { return doneEntries().filter(e => e.task.person === p || e.task.person === "Ambos").length; }

function rewardStatus(r) {
  const used = (state.rewardsUsed || []).some(u => u.id === r.id);
  if (r.type === "individual") {
    const pxp = personXp(r.person), ptasks = personMissionCount(r.person);
    const ok = pxp >= r.xp && ptasks >= r.tasks;
    return {reward:r, used, ok, progress:[{label:`XP ${Math.round(pxp)}/${r.xp}`, ok:pxp>=r.xp}, {label:`Missões ${ptasks}/${r.tasks}`, ok:ptasks>=r.tasks}], missing:`${Math.max(0, Math.round(r.xp-pxp))} XP + ${Math.max(0, r.tasks-ptasks)} missões`};
  }
  const bx = baseXp(), missions = doneEntries().length, st = streak(), saved = financeTotals().goalsTotal, goals = completedGoals();
  const ok = bx >= r.xp && missions >= r.tasks && st >= r.streak && saved >= r.money && goals >= r.goals;
  return {reward:r, used, ok, progress:[{label:`XP ${Math.round(bx)}/${r.xp}`, ok:bx>=r.xp},{label:`Missões ${missions}/${r.tasks}`, ok:missions>=r.tasks},{label:`Sequência ${st}/${r.streak}`, ok:st>=r.streak},{label:`Metas ${money(saved)}/${money(r.money)}`, ok:saved>=r.money},{label:`Metas concluídas ${goals}/${r.goals}`, ok:goals>=r.goals}], missing:"ver requisitos"};
}

function achievements() {
  const ft = financeTotals(), st = streak(), casa = totalTasksDone("casa"), pets = totalTasksDone("pets"), mu = personXp("Mu"), ju = personXp("Ju"), bx = baseXp(), cg = completedGoals();
  const used = (state.rewardsUsed || []).length;
  const available = rewardCatalog.map(rewardStatus).filter(s => s.ok && !s.used).length;
  const a = [];
  const add = (cat,name,ok,rarity="comum",icon="🏆") => a.push({cat,name,ok,rarity,icon});
  [1,2,3,5,7,10,15,20,30,40,50,75,100,150,200,250,350,500,750,1000].forEach(n => add("Casa",`${n} tarefas da casa`,casa>=n,n>=500?"lendaria":n>=200?"epica":n>=75?"rara":n>=20?"incomum":"comum","🏠"));
  [1,2,3,5,7,10,15,20,30,40,50,75,100,150,200,250,350,500,750,1000].forEach(n => add("Pets",`${n} tarefas dos pets`,pets>=n,n>=500?"lendaria":n>=200?"epica":n>=75?"rara":n>=20?"incomum":"comum","🐾"));
  [3,5,7,10,15,20,30,45,60,75,100,150,180,250,365,500].forEach(n => add("Sequência",`${n} dias de sequência`,st>=n,n>=365?"lendaria":n>=100?"epica":n>=30?"rara":n>=10?"incomum":"comum","🔥"));
  [10,25,50,75,100,150,250,500,750,1000,1500,2500,5000,7500,10000,15000,20000,30000].forEach(n => add("Economia",`${money(n)} em metas`,ft.goalsTotal>=n,n>=20000?"lendaria":n>=7500?"epica":n>=2500?"rara":n>=250?"incomum":"comum","💰"));
  [1,2,3,4,5,7,10,15,20].forEach(n => add("Metas",`${n} metas concluídas`,cg>=n,n>=15?"lendaria":n>=7?"epica":n>=4?"rara":n>=2?"incomum":"comum","🎯"));
  [250,500,750,1000,1500,2000,3000,4500,6000,8000,10000].forEach(n => { add("Mu",`Mu chegou em ${n} XP`,mu>=n,n>=10000?"lendaria":n>=6000?"epica":n>=3000?"rara":n>=1000?"incomum":"comum","👨"); add("Ju",`Ju chegou em ${n} XP`,ju>=n,n>=10000?"lendaria":n>=6000?"epica":n>=3000?"rara":n>=1000?"incomum":"comum","👩"); });
  beerLevels.forEach((b,i) => { add("Adega",`Base virou ${b[0]}`,Math.floor(bx/750)>=i,i>=10?"lendaria":i>=8?"epica":i>=5?"rara":i>=2?"incomum":"comum","🍺"); add("Adega",`Mu virou ${b[0]}`,Math.floor(mu/750)>=i,i>=10?"lendaria":i>=8?"epica":i>=5?"rara":i>=2?"incomum":"comum","🍺"); add("Adega",`Ju virou ${b[0]}`,Math.floor(ju/750)>=i,i>=10?"lendaria":i>=8?"epica":i>=5?"rara":i>=2?"incomum":"comum","🍺"); });
  [1,2,3,5,8,10].forEach(n => add("Recompensas",`${n} recompensas resgatadas`,used>=n,n>=10?"lendaria":n>=5?"epica":n>=3?"rara":n>=2?"incomum":"comum","🎁"));
  [1,2,3,5,8].forEach(n => add("Recompensas",`${n} recompensas liberadas`,available>=n,n>=8?"epica":n>=5?"rara":n>=2?"incomum":"comum","🎁"));
  add("Secretas","Primeiro dia perfeito",Object.keys(state.checks).some(k => getDayStats(k).percent === 100),"rara","❓");
  return a;
}

function renderMissions() {
  const key = dateKey(new Date());
  const pending = state.tasks.filter(t => !isDone(t.id, key));
  $("todaySummary").textContent = `${pending.length} pendentes`;
  if (!pending.length) {
    $("nextMission").innerHTML = `<div><span class="xp-badge">🎉 Base estabilizada hoje</span><div class="next-title">Todas as missões foram concluídas!</div><p class="subtitle">XP garantido e sequência mantida.</p></div>`;
  } else {
    const t = [...pending].sort((a,b) => calcTaskXp(b)-calcTaskXp(a))[0];
    $("nextMission").innerHTML = `<div><span class="xp-badge">⭐ ${calcTaskXp(t)} XP</span><div class="next-title">${t.category==="pets"?"🐾":"🏠"} ${t.text}</div><p class="subtitle">${t.person==="Ju"?"👩":t.person==="Ambos"?"👫":"👨"} ${t.person} • ${(diff[t.difficulty||"facil"]||diff.facil)[1]} • ⏱️ ${t.time||1} min</p></div><button class="green-btn" onclick="toggleTask('${t.id}')">Marcar feita</button>`;
  }
}

function renderTasks() {
  $("tasksCasa").innerHTML = "";
  $("tasksPets").innerHTML = "";
  state.tasks.forEach((t,i) => {
    const done = isDone(t.id);
    const div = document.createElement("div");
    div.className = "task";
    div.innerHTML = `<input type="checkbox" ${done?"checked":""} onchange="toggleTask('${t.id}')"><div><span class="${done?"done":""}">${t.text}</span><div class="task-meta"><span class="tag">⭐ ${calcTaskXp(t)} XP</span><span class="tag">${(diff[t.difficulty||"facil"]||diff.facil)[1]}</span><span class="tag">⏱️ ${t.time||1} min</span></div></div><span class="person">${t.person==="Ju"?"👩":t.person==="Ambos"?"👫":"👨"} ${t.person||"Mu"}</span><button class="red-btn small" onclick="deleteTask(${i})">X</button>`;
    (t.category === "pets" ? $("tasksPets") : $("tasksCasa")).appendChild(div);
  });
  ["casa","pets"].forEach(c => {
    const total = state.tasks.filter(t => t.category === c).length;
    const done = state.tasks.filter(t => t.category === c && isDone(t.id)).length;
    $("count-" + c).textContent = `${done}/${total}`;
  });
}

function renderTop() {
  const ft = financeTotals(), un = achievements().filter(a => a.ok).length;
  $("streakTop").textContent = streak() + " dias";
  $("goalWealthTop").textContent = money(ft.goalsTotal);
  $("achTop").textContent = un;
  $("baseBeerTop").textContent = beerForXp(baseXp()).name;
}

function renderBeer() {
  const container = $("beerCards");
  container.innerHTML = "";
  [["Mu",personXp("Mu")],["Ju",personXp("Ju")],["Base",baseXp()]].forEach(([p,x]) => {
    const b = beerForXp(x);
    const div = document.createElement("div");
    div.className = "inner";
    div.innerHTML = `<h3>${p==="Mu"?"👨":p==="Ju"?"👩":"🏡"} ${p}</h3><div class="beer-name">${b.name}</div><div class="beer-title">${b.title}</div><div class="progress"><div class="progress-fill" style="width:${b.progress}%"></div></div><p class="subtitle">${b.xp} XP • ${b.progress}%</p>`;
    container.appendChild(div);
  });
}

function renderRewards() {
  const statuses = rewardCatalog.map(rewardStatus);
  const available = statuses.filter(s => s.ok && !s.used);
  $("availableRewardCount").textContent = available.length + " liberadas";
  $("availableRewards").innerHTML = available.length ? "" : `<p class="subtitle">Nenhuma recompensa liberada ainda.</p>`;
  $("lockedRewards").innerHTML = "";
  const makeCard = s => {
    const r = s.reward;
    const div = document.createElement("div");
    div.className = "reward-card " + (s.ok && !s.used ? "available" : "locked");
    div.innerHTML = `<div class="reward-title">${r.emoji} ${r.name}</div><div class="reward-type">${r.type==="individual"?"Individual • "+r.person:"Conjunta • Base"}</div><div class="requirements">${s.progress.map(p=>`<div class="req ${p.ok?"ok":"no"}">${p.ok?"✅":"❌"} ${p.label}</div>`).join("")}</div>${s.ok&&!s.used?`<button class="green-btn small" onclick="useReward('${r.id}')">Marcar usada</button>`:""}`;
    return div;
  };
  available.forEach(s => $("availableRewards").appendChild(makeCard(s)));
  statuses.filter(s => !s.ok && !s.used).slice(0,6).forEach(s => $("lockedRewards").appendChild(makeCard(s)));
  ["Mu","Ju"].forEach(p => {
    const b = beerForXp(personXp(p));
    $(`dash${p}Beer`).textContent = "🍺 " + b.name;
    $(`dash${p}Summary`).textContent = `${Math.round(personXp(p))} XP • ${personMissionCount(p)} missões`;
    $(`dash${p}Next`).innerHTML = nextRewardText(p);
  });
  const bb = beerForXp(baseXp());
  $("dashBaseBeer").textContent = "🍺 " + bb.name;
  $("dashBaseSummary").textContent = `${Math.round(baseXp())} XP • ${doneEntries().length} missões • ${streak()} dias`;
  $("dashBaseNext").innerHTML = nextRewardText("Base");
}

function nextRewardText(p) {
  const s = rewardCatalog.map(rewardStatus).find(x => !x.used && !x.ok && (p === "Base" ? x.reward.type === "conjunta" : x.reward.person === p));
  return s ? `<strong>Próxima: ${s.reward.emoji} ${s.reward.name}</strong><p class="subtitle">${s.missing}</p>` : `<strong>🎉 Tudo liberado</strong>`;
}

function renderGoals() {
  $("goalList").innerHTML = "";
  if (!state.goals.length) { $("goalList").innerHTML = `<p class="subtitle">Nenhuma meta criada ainda.</p>`; return; }
  state.goals.forEach(g => {
    const pct = Math.min(100, g.target ? Math.round(Number(g.current||0)/Number(g.target)*100) : 0);
    const div = document.createElement("div");
    div.className = "goal";
    div.innerHTML = `<div class="goal-top"><div><div class="goal-name">${g.category==="pets"?"🐾":"🏠"} ${g.name}</div><div class="subtitle">${pct}% da meta</div></div><div class="goal-money">${money(g.current)}<br><span class="subtitle">de ${money(g.target)}</span></div></div><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div><div class="goal-actions"><input id="goal-add-${g.id}" type="number" step="0.01" min="0" placeholder="Adicionar R$"><button class="green-btn small" onclick="addMoneyToGoal('${g.id}')">Adicionar</button><button class="red-btn small" onclick="deleteGoal('${g.id}')">X</button></div>`;
    $("goalList").appendChild(div);
  });
}

function renderFinance() {
  const ft = financeTotals();
  $("incomeMonth").textContent = money(ft.income);
  $("spentMonth").textContent = money(ft.spent);
  $("balanceMonth").textContent = money(ft.balance);
  $("goalsMonth").textContent = money(ft.goalsTotal);
  $("financeHistory").innerHTML = "";
  [...ft.items].sort((a,b) => b.date.localeCompare(a.date)).slice(0,8).forEach(item => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `<div><strong>${item.type==="in"?"Entrada":"Saída"} • ${item.category}</strong><br><small>${new Date(item.date+"T00:00:00").toLocaleDateString("pt-BR")}</small></div><strong class="${item.type==="in"?"green":"red"}">${item.type==="in"?"+":"-"} ${money(item.value)}</strong><button class="red-btn small" onclick="deleteFinance('${item.id}')">X</button>`;
    $("financeHistory").appendChild(div);
  });
  if (!$("financeHistory").innerHTML) $("financeHistory").innerHTML = `<p class="subtitle">Nenhum lançamento neste mês.</p>`;
}

function renderMembers() {
  $("memberStats").innerHTML = "";
  const data = ["Mu","Ju"].map(p => ({person:p, xp:personXp(p), done:personMissionCount(p)}));
  const min = Math.min(...data.map(d=>d.done)), max = Math.max(...data.map(d=>d.done));
  data.forEach(item => {
    const debt = max > min && item.done === min, b = beerForXp(item.xp);
    const div = document.createElement("div");
    div.className = "profile" + (debt ? " debt" : "");
    div.innerHTML = `<div class="avatar">${item.person==="Ju"?"👩":"👨"}</div><strong>${item.person}</strong><p class="subtitle">${item.done} missões • 🍺 ${b.name}</p><div class="progress"><div class="progress-fill" style="width:${b.progress}%"></div></div>${debt?`<div class="debt-tag">tá devendo o cu</div>`:`<div class="debt-tag" style="background:linear-gradient(135deg,#43d17d,#5aa9ff)">tá carregando a base</div>`}`;
    $("memberStats").appendChild(div);
  });
  const both = doneEntries().filter(e => e.task.person === "Ambos").length;
  const div = document.createElement("div");
  div.className = "profile";
  div.innerHTML = `<div class="avatar">👫</div><strong>Ambos</strong><p class="subtitle">${both} missões feitas juntos.</p><div class="progress"><div class="progress-fill" style="width:${Math.min(100,both)}%"></div></div>`;
  $("memberStats").appendChild(div);
}

function renderAchievements() {
  const cats = ["Todas","Casa","Pets","Sequência","Economia","Metas","Mu","Ju","Adega","Recompensas","Secretas"];
  $("trophyTabs").innerHTML = "";
  cats.forEach(c => {
    const b = document.createElement("button");
    b.className = "small" + (trophyFilter === c ? " active" : "");
    b.textContent = c;
    b.onclick = () => { trophyFilter = c; renderAchievements(); };
    $("trophyTabs").appendChild(b);
  });
  const all = achievements(), unlocked = all.filter(a => a.ok).length;
  $("achievementBadge").textContent = unlocked;
  $("achievementList").innerHTML = "";
  (trophyFilter === "Todas" ? all : all.filter(a => a.cat === trophyFilter)).forEach(a => {
    const div = document.createElement("div");
    div.className = `trophy rarity-${a.rarity} ${a.ok?"":"locked"}`;
    div.innerHTML = `<div class="trophy-icon">${a.ok?a.icon:"🔒"}</div><strong>${a.name}</strong><span>${a.ok?a.rarity:"bloqueada"}</span>`;
    $("achievementList").appendChild(div);
  });
  $("achTop").textContent = unlocked;
}

function renderCalendar() {
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
  $("monthTitle").textContent = `${names[m]} de ${y}`;
  const first = new Date(y,m,1), days = new Date(y,m+1,0).getDate();
  let off = first.getDay()-1; if (off < 0) off = 6;
  $("calendarDays").innerHTML = "";
  for (let i=0;i<off;i++) { const e = document.createElement("div"); e.className = "day empty"; $("calendarDays").appendChild(e); }
  for (let d=1; d<=days; d++) {
    const cur = new Date(y,m,d), k = dateKey(cur), s = getDayStats(k);
    const div = document.createElement("div");
    div.className = "day";
    if (k === dateKey(new Date())) div.classList.add("today");
    div.onclick = () => alert(`Histórico de ${cur.toLocaleDateString("pt-BR")}:\n${s.done}/${s.total} missões\n${s.percent}%`);
    div.innerHTML = `<div class="day-number">${d}</div><div class="day-score">${s.done}/${s.total}</div><div class="day-score">${s.percent}%</div>`;
    $("calendarDays").appendChild(div);
  }
}

function renderAnnual() {
  const y = new Date().getFullYear();
  const tasksYear = Object.entries(state.checks).filter(([k]) => k.startsWith(String(y))).reduce((s,[,v]) => s + Object.values(v).filter(Boolean).length, 0);
  const data = [["🏠 Missões",tasksYear],["⭐ XP Base",baseXp()],["🍺 Base",beerForXp(baseXp()).name],["🔥 Sequência",streak()+" dias"],["🎯 Metas",completedGoals()],["🏆 Conquistas",achievements().filter(a=>a.ok).length]];
  $("annualStats").innerHTML = "";
  data.forEach(d => {
    const box = document.createElement("div");
    box.className = "annual-box";
    box.innerHTML = `<strong>${d[0]}</strong><p class="subtitle">${d[1]}</p>`;
    $("annualStats").appendChild(box);
  });
  $("rewardHistory").innerHTML = "";
  (state.rewardsUsed || []).forEach(u => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `<div><strong>${u.name}</strong><br><small>${new Date(u.date).toLocaleDateString("pt-BR")}</small></div><span>${u.emoji}</span><button class="red-btn small" onclick="deleteUsedReward('${u.useId}')">X</button>`;
    $("rewardHistory").appendChild(div);
  });
  if (!$("rewardHistory").innerHTML) $("rewardHistory").innerHTML = `<p class="subtitle">Nenhuma recompensa resgatada.</p>`;
}

function render(sync=true) {
  renderMissions(); renderTasks(); renderTop(); renderBeer(); renderRewards(); renderGoals(); renderFinance(); renderMembers(); renderAchievements(); renderCalendar(); renderAnnual(); save(sync);
}

function addTask() {
  const text = $("taskText").value.trim();
  if (!text) return;
  state.tasks.push({id:uid(), text, category:$("taskCategory").value, person:$("taskPerson").value, difficulty:$("taskDifficulty").value, time:$("taskTime").value, frequency:$("taskFrequency").value});
  $("taskText").value = "";
  render();
}

function toggleTask(id) {
  const k = dateKey(new Date());
  if (!state.checks[k]) state.checks[k] = {};
  state.checks[k][id] = !state.checks[k][id];
  render();
}

function deleteTask(i) {
  if (!confirm("Excluir missão?")) return;
  const id = state.tasks[i].id;
  state.tasks.splice(i,1);
  Object.values(state.checks).forEach(d => delete d[id]);
  render();
}

function addFinanceEntry() {
  const value = Number($("financeValue").value), date = $("financeDate").value;
  if (!value || value <= 0) return alert("Digite um valor válido.");
  if (!date) return alert("Escolha a data.");
  state.finances.push({id:uid(), type:$("financeType").value, value, date, category:$("financeCategory").value});
  $("financeValue").value = "";
  render();
}

function deleteFinance(id) {
  if (!confirm("Excluir lançamento?")) return;
  state.finances = state.finances.filter(i => i.id !== id);
  render();
}

function addGoal() {
  const name = $("goalName").value.trim(), target = Number($("goalTarget").value);
  if (!name) return alert("Digite o nome da meta.");
  if (!target || target <= 0) return alert("Digite o valor alvo.");
  state.goals.push({id:uid(), name, category:$("goalCategory").value, target, current:0});
  $("goalName").value = "";
  $("goalTarget").value = "";
  $("goalModal").classList.remove("open");
  render();
}

function addMoneyToGoal(id) {
  const input = $("goal-add-" + id), value = Number(input.value);
  if (!value || value <= 0) return alert("Digite um valor válido.");
  const goal = state.goals.find(g => g.id === id);
  if (goal) goal.current = Number(goal.current || 0) + value;
  render();
}

function deleteGoal(id) {
  if (!confirm("Excluir meta?")) return;
  state.goals = state.goals.filter(g => g.id !== id);
  render();
}

function useReward(id) {
  const r = rewardCatalog.find(x => x.id === id);
  if (!r || !confirm("Marcar recompensa como usada?")) return;
  state.rewardsUsed.push({useId:uid(), id:r.id, name:r.name, emoji:r.emoji, date:new Date().toISOString()});
  render();
}

function deleteUsedReward(id) {
  if (!confirm("Remover do histórico?")) return;
  state.rewardsUsed = state.rewardsUsed.filter(u => u.useId !== id);
  render();
}

function updateXpPreview() {
  const t = {difficulty:$("taskDifficulty").value, time:$("taskTime").value, frequency:$("taskFrequency").value, person:$("taskPerson").value};
  $("xpPreview").textContent = "⭐ " + calcTaskXp(t) + " XP";
}

document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("screen-" + btn.dataset.screen).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  scrollTo({top:0, behavior:"smooth"});
}));

$("addTaskBtn").onclick = addTask;
$("addFinanceBtn").onclick = addFinanceEntry;
$("openGoalBtn").onclick = () => $("goalModal").classList.add("open");
$("closeGoalBtn").onclick = () => $("goalModal").classList.remove("open");
$("addGoalBtn").onclick = addGoal;
$("prevMonthBtn").onclick = () => { calendarMonth.setMonth(calendarMonth.getMonth()-1); render(false); };
$("nextMonthBtn").onclick = () => { calendarMonth.setMonth(calendarMonth.getMonth()+1); render(false); };
$("goalModal").addEventListener("click", e => { if (e.target.id === "goalModal") $("goalModal").classList.remove("open"); });
["taskDifficulty","taskTime","taskFrequency","taskPerson"].forEach(id => $(id).addEventListener("change", updateXpPreview));

$("financeDate").value = dateKey(new Date());
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
updateXpPreview();
render(false);
initSupabase().then(() => render(false));
