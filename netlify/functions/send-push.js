const SUPABASE_URL = process.env.SUPABASE_URL || "https://ukpbnqzsthxywgabpumj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_3w3Z8dhj2zjDB7Yl2AB5RA_0eHzqL2a";
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "d8f5cd74-b37b-441c-ab84-cce468a9d95d";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY;

const systems={pets:["🐾","Pets"],casa:["🏠","Casa"],financeiro:["💰","Financeiro"],relacionamento:["❤️","Relacionamento"],saude:["🧠","Saúde"]};
const priorityScore={baixa:0,normal:1,alta:2,emergencial:4};
function brNow(){return new Date(new Date().toLocaleString("en-US",{timeZone:"America/Sao_Paulo"}))}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function todayKey(){return dateKey(brNow())}
function parseDate(k){return new Date(k+"T00:00:00")}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function dueOnDate(t,date,completions){
  if(t.active===false)return false;
  const key=dateKey(date);
  if(t.priority==="emergencial")return !done(completions,t.id,key);
  const start=parseDate(t.startDate||key);
  if(key<dateKey(start))return false;
  if(t.parentTaskId&&!completions.some(c=>c.taskId===t.parentTaskId))return false;
  if(t.scheduleType==="daily"){const days=Math.floor((parseDate(key)-start)/86400000);return days%Number(t.interval||1)===0}
  if(t.scheduleType==="weekly")return(t.weeklyDays||[]).map(Number).includes(date.getDay());
  if(t.scheduleType==="monthly")return date.getDate()===Number(t.monthlyDay||1);
  return false;
}
function done(completions,taskId,key){return(completions||[]).some(c=>c.taskId===taskId&&(c.dueDate===key||(c.completedAt&&dateKey(new Date(c.completedAt))===key)))}
function dueTasks(data,key){const d=parseDate(key),cs=data.completions||[];return(data.tasks||[]).filter(t=>dueOnDate(t,d,cs))}
function personStats(data,p){const rows=(data.completions||[]).filter(c=>c.completedBy===p);return{person:p,tasks:rows.length,xp:rows.reduce((s,c)=>s+Number(c.xp||0),0)}}
function systemLabel(k){return systems[k]?.[1]||k}function systemIcon(k){return systems[k]?.[0]||"🎯"}
function chooseMessage(data,profile=null){
  const key=todayKey(),tasks=data.tasks||[],cs=data.completions||[],due=dueTasks(data,key),missing=due.filter(t=>!done(cs,t.id,key));
  const late=[];for(let i=1;i<=7;i++){const d=addDays(parseDate(key),-i),dk=dateKey(d);dueTasks(data,dk).forEach(t=>{if(!done(cs,t.id,dk))late.push({task:t,date:dk})})}
  const mu=personStats(data,"Mu"),ju=personStats(data,"Ju"),behindXp=mu.xp<=ju.xp?mu:ju,leader=mu.xp>ju.xp?mu:ju,diffXp=Math.abs(mu.xp-ju.xp),diffTasks=Math.abs(mu.tasks-ju.tasks),behindTasks=mu.tasks<=ju.tasks?mu:ju;
  const best=[...late.map(x=>({task:x.task,late:true})),...missing.map(t=>({task:t,late:false}))].filter(x=>x.task.notify!==false).sort((a,b)=>(b.late?1:0)-(a.late?1:0)||(priorityScore[b.task.priority]||0)-(priorityScore[a.task.priority]||0)||Number(a.task.estimatedMinutes||5)-Number(b.task.estimatedMinutes||5))[0];
  if(late.length)return{title:"⚠️ Missões atrasadas",body:`${late.length} atrasada(s). Comece por: ${late[0].task.text}.`};
  if(missing.length===1)return{title:"⭐ Quase Dia Perfeito",body:`Falta só: ${missing[0].text}.`};
  if(profile&&diffXp>=50){
    if(behindXp.person===profile)return{title:"🏁 Dá para virar",body:`Você está ${Math.round(diffXp)} XP atrás. Uma missão média já ajuda.`};
    return{title:"🔥 Você está liderando",body:`Vantagem de ${Math.round(diffXp)} XP. Mantém o ritmo.`};
  }
  if(diffTasks>=3)return{title:"📊 Competição saudável",body:`${behindTasks.person} fez menos missões. Bora equilibrar a Base.`};
  if(best)return{title:"🧠 Sugestão da Base",body:`${best.task.text} • ${best.task.estimatedMinutes||5} min • ${systemIcon(best.task.system)} ${systemLabel(best.task.system)}.`};
  if(missing.length)return{title:"⚡ Missões de hoje",body:`Ainda faltam ${missing.length}. Comece pela mais rápida.`};
  return{title:"🌿 Base tranquila",body:"Nenhum alerta pesado agora."};
}
async function sendPush(message,profile=null){
  if(!ONESIGNAL_API_KEY)return{ok:false,status:500,response:"Falta ONESIGNAL_API_KEY no Netlify."};
  const body={app_id:ONESIGNAL_APP_ID,headings:{en:message.title,pt:message.title},contents:{en:message.body,pt:message.body},url:process.env.URL||"https://casinhaa.netlify.app"};
  if(profile)body.filters=[{field:"tag",key:"profile",relation:"=",value:profile}];else body.included_segments=["Subscribed Users"];
  const res=await fetch("https://api.onesignal.com/notifications",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Key ${ONESIGNAL_API_KEY}`},body:JSON.stringify(body)});
  return{ok:res.ok,status:res.status,response:await res.text()};
}
exports.handler=async function(){
  try{
    const row=await fetch(`${SUPABASE_URL}/rest/v1/base_familia?id=eq.base-mu-ju-v8&select=data`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});
    const json=await row.json();const data=json?.[0]?.data||{};
    const general=chooseMessage(data,null);
    const result=await sendPush(general,null);
    return{statusCode:result.ok?200:500,headers:{"Content-Type":"application/json"},body:JSON.stringify({message:general,result})};
  }catch(e){return{statusCode:500,headers:{"Content-Type":"application/json"},body:JSON.stringify({error:String(e)})}}
};
