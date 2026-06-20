const SUPABASE_URL = process.env.SUPABASE_URL || "https://ukpbnqzsthxywgabpumj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_3w3Z8dhj2zjDB7Yl2AB5RA_0eHzqL2a";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY;

function brNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey() { return dateKey(brNow()); }
function parseDate(k){ return new Date(k+"T00:00:00"); }

function dueOnDate(t,date){
  if(t.active===false) return false;
  const dk = dateKey(date);
  const start = parseDate(t.startDate || (t.createdAt || dk).slice(0,10));
  if(dk < dateKey(start)) return false;

  if(t.scheduleType==="daily"){
    const days = Math.floor((parseDate(dk)-start)/86400000);
    return days % Number(t.interval || 1) === 0;
  }
  if(t.scheduleType==="weekly") return (t.weeklyDays||[]).map(Number).includes(date.getDay());
  if(t.scheduleType==="monthly") return date.getDate() === Number(t.monthlyDay || 1);
  return false;
}

function done(completions, taskId, dueDate){
  return (completions || []).some(c => {
    if(c.taskId !== taskId) return false;
    if(c.dueDate === dueDate) return true;
    if(c.completedAt && dateKey(new Date(c.completedAt)) === dueDate) return true;
    return false;
  });
}

function personStats(data, person){
  const completions = data.completions || [];
  const rows = completions.filter(c => c.person === person || c.person === "Ambos");
  const tasks = rows.length;
  const xp = rows.reduce((s,c)=>s + Number(c.xp || 0)/(c.person==="Ambos"?2:1),0);
  return { person, tasks, xp };
}

function chooseMessage(data){
  const key = todayKey();
  const date = parseDate(key);
  const tasks = data.tasks || [];
  const completions = data.completions || [];
  const dueToday = tasks.filter(t => dueOnDate(t,date));
  const missing = dueToday.filter(t => !done(completions,t.id,key));

  const late = [];
  for(let i=1;i<=7;i++){
    const d = parseDate(key);
    d.setDate(d.getDate()-i);
    const dk = dateKey(d);
    tasks.filter(t => dueOnDate(t,d)).forEach(t => {
      if(!done(completions,t.id,dk)) late.push({ task:t, date:dk });
    });
  }

  const mu = personStats(data,"Mu");
  const ju = personStats(data,"Ju");
  const behindXp = mu.xp <= ju.xp ? mu : ju;
  const behindTasks = mu.tasks <= ju.tasks ? mu : ju;

  if(late.length) return { title:"⚠️ Missões atrasadas", body:`${late.length} atrasada(s). Comece por: ${late[0].task.text}.` };
  if(missing.length === 1) return { title:"⭐ Quase Dia Perfeito", body:`Falta só: ${missing[0].text}.` };
  if(Math.abs(mu.tasks - ju.tasks) >= 3) return { title:"🏁 Competição saudável", body:`${behindTasks.person} fez menos missões. Bora buscar umas rápidas?` };
  if(Math.abs(mu.xp - ju.xp) >= 100) return { title:"📊 XP em disputa", body:`${behindXp.person} está atrás no XP. Uma missão rápida já ajuda.` };
  if(missing.length) return { title:"⚡ Missões de hoje", body:`Você tem ${missing.length} missão(ões) pendente(s). Sugestão: ${missing[0].text}.` };
  return { title:"🌿 Base tranquila", body:"Nenhum alerta pesado agora. Boa!" };
}

async function sendPush(message){
  if(!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return { ok:false, status:500, response:"Configure ONESIGNAL_APP_ID e ONESIGNAL_API_KEY no Netlify." };
  }

  const res = await fetch("https://api.onesignal.com/notifications", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Key ${ONESIGNAL_API_KEY}`
    },
    body:JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments:["Subscribed Users"],
      headings:{ en: message.title, pt: message.title },
      contents:{ en: message.body, pt: message.body },
      url: process.env.URL || "https://casinhaa.netlify.app"
    })
  });

  const text = await res.text();
  return { ok:res.ok, status:res.status, response:text };
}

exports.handler = async function(event, context) {
  try {
    const row = await fetch(`${SUPABASE_URL}/rest/v1/base_familia?id=eq.base-mu-ju&select=data`, {
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:`Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const json = await row.json();
    const data = json?.[0]?.data || {};
    const message = chooseMessage(data);
    const result = await sendPush(message);

    return {
      statusCode: result.ok ? 200 : 500,
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ message, result })
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ error:String(e) })
    };
  }
};
