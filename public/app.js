const $=id=>document.getElementById(id);
let ws,state,seq=0,joined=false,intent=null,retry,closed=false,rtt=null,received=0,toastTimer;
const params=new URLSearchParams(location.search);$('code').value=params.get('room')||'';$('name').value=localStorage.getItem('smite-name')||'';
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function connection(text,online=false){$('connection').textContent=text;$('connection').classList.toggle('online',online);}
function connect(){
 clearTimeout(retry);if(closed)return;connection('CONNECTING');
 ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
 ws.onopen=()=>{connection('CONNECTED',true);if(intent)ws.send(JSON.stringify({type:'join',...intent}));};
 ws.onmessage=event=>{const m=JSON.parse(event.data);
  if(m.type==='joined'){joined=true;intent={code:m.code,token:m.token,name:$('name').value};sessionStorage.setItem(`smite:${m.code}`,m.token);history.replaceState(null,'',`?room=${m.code}`);$('home').hidden=true;$('game').hidden=false;}
  if(m.type==='state'){state=m;received=performance.now();seq=Math.max(seq,m.players[m.seat]?.lastSeq||0);render();}
  if(m.type==='error'){toast(m.message);if(!joined){intent=null;connection('CONNECTED',true);}}
  if(m.type==='pong'){rtt=Math.round(performance.now()-m.sent);connection(`${rtt} MS · CONNECTED`,true);}
  if(m.type==='replaced'){closed=true;toast('This seat is open in another tab.');}
  if(m.type==='expired'){closed=true;toast('Room expired. Create a new room to play again.');}
 };
 ws.onclose=()=>{connection(closed?'DISCONNECTED':'RECONNECTING');if(state)render();if(!closed)retry=setTimeout(connect,1500);};
 ws.onerror=()=>connection('CONNECTION ERROR');
}
function join(practice=false,create=false){if(ws?.readyState!==WebSocket.OPEN){toast('Connecting to the arena. Please try again in a moment.');return;}const code=create?'':$('code').value.trim().toUpperCase();if(!create&&!code){toast('Enter the room code from your rival.');$('code').focus();return;}const name=$('name').value.trim()||'Warden';localStorage.setItem('smite-name',name);intent={code,name,practice,token:code?sessionStorage.getItem(`smite:${code}`)||'':''};ws.send(JSON.stringify({type:'join',...intent}));}
function action(action){if(!state||ws?.readyState!==WebSocket.OPEN){toast('Wait for the connection to recover.');return;}ws.send(JSON.stringify({type:'action',action,seq:++seq}));}
$('create').onclick=()=>join(false,true);$('join').onclick=()=>join();$('practice').onclick=()=>join(true,true);
for(const key of ['attack','smite','empowered','burst','ready','forfeit'])$(key).onclick=()=>action(key);
$('leave').onclick=()=>{closed=true;ws?.close();location.href='/';};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Invite link copied.');}catch{toast(`Share room code ${state.code}`);}};
$('help').onclick=()=>$('tutorial').showModal();for(const key of ['close-help','understood'])$(key).onclick=()=>$('tutorial').close();
document.addEventListener('keydown',event=>{if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||['INPUT','TEXTAREA'].includes(event.target.tagName)||$('tutorial').open)return;const id={a:'attack',s:'smite',e:'empowered',b:'burst'}[event.key.toLowerCase()];if(id&&!$(id).disabled){event.preventDefault();action(id);}});
function escape(text){const d=document.createElement('span');d.textContent=text;return d.innerHTML;}
function player(p,seat){const mine=seat===state.seat;const pending=state.pending.filter(e=>e.seat===seat);return `<div class="side">${mine?'YOU / WARDEN':'RIVAL / WARDEN'}</div><h2>${escape(p?.name||'Open seat')}</h2><span class="score">${p?.score||0}</span><span class="caption">POINTS SECURED</span><div class="energy">${p?'◆'.repeat(p.energy)+'◇'.repeat(state.rules.energy-p.energy):'◇◇◇◇◇◇'}<div class="energy-label">${p?p.energy:0} / 6 ${mine?'AVAILABLE':'REVEALED'} ENERGY</div></div><div class="status">${!p?'○ Waiting for a challenger':!p.connected?'○ Disconnected':p.attack?'● AUTO ATTACK ON':p.ready?'● READY':'○ AUTO ATTACK OFF'}</div><div class="casting">${pending.map(e=>e.action==='burst'?'BURST WINDUP · 400 ms':'SMITE CAST · 200 ms').join(' + ')|| (p?.smiteUsed?'Smite committed this round':'Smite available')}</div>`;}
let lastRecap='';
function render(){if(!state)return;const s=state,me=s.players[s.seat],other=s.players[1-s.seat],r=s.rules;const live=s.phase==='live'&&!s.paused&&ws.readyState===WebSocket.OPEN;
 $('you').innerHTML=player(me,s.seat);$('rival').innerHTML=player(other,1-s.seat);$('hp').innerHTML=`${s.hp.toLocaleString()} <small>/ ${r.hp.toLocaleString()} HP</small>`;$('health-fill').style.width=`${s.hp/r.hp*100}%`;
 $('smite-mark').style.left=`${r.smite/r.hp*100}%`;$('empowered-mark').style.left=`${r.empowered/r.hp*100}%`;
 $('empowered-mark').hidden=$('empowered-label').hidden=me.energy<r.empoweredCost||me.smiteUsed;
 $('room-code').textContent=s.code;$('mode').textContent=s.practice?'SOLO PRACTICE · NO OPPONENT':'PRIVATE SHOWDOWN';$('round-label').textContent=s.round?`ROUND ${s.round} / ${s.practice?1:r.rounds}`:'WAITING ROOM';
 $('rounds').innerHTML=Array.from({length:s.practice?1:r.rounds},(_,i)=>`<i class="round-dot ${i+1===s.round?'current':i+1<s.round?'done':''}" title="Round ${i+1}"></i>`).join('');
 $('attack').disabled=!live;$('attack').classList.toggle('on',me.attack);$('attack-desc').textContent=`${me.attack?'ON':'OFF'} · ${r.attack} damage / 0.5s`;
 $('smite').disabled=!live||me.smiteUsed;$('empowered').disabled=!live||me.smiteUsed||me.energy<r.empoweredCost;$('burst').disabled=!live||me.burstUsed||me.energy<r.burstCost;
 $('lobby').hidden=!['lobby','results','final'].includes(s.phase);$('ready').disabled=me.ready||s.paused||!other?.connected||s.pending.length>0||ws.readyState!==WebSocket.OPEN;
 $('ready').textContent=me.ready?'Waiting for rival…':s.phase==='final'?'Rematch →':s.phase==='results'?'Next round →':'Ready up →';
 $('lobby-title').textContent=s.phase==='final'?'One more showdown?':s.phase==='results'?'Take a breath. Read the recap.':other?'Your rival has arrived.':'Bring your rival.';
 $('lobby-note').textContent=s.phase==='final'?'Both players ready up to reset the match and energy.':s.phase==='results'?'Both players must ready up for the next round.':s.practice?'Practice the timing solo. No rival or multiplayer proof.':'Share the room link, then both ready up.';
 $('arena-note').textContent=s.phase==='live'?`Arena: −${r.environment} HP / second · ${me.attack?'Your attacks are on.':'Your attacks are off.'}`:s.phase==='countdown'?'Actions unlock when the countdown ends.':s.phase==='lobby'?'The arena waits for its challengers.':'The objective has fallen.';
 $('pause').hidden=!s.paused;$('results').hidden=!['results','final'].includes(s.phase);
 const recap=JSON.stringify([s.round,s.phase,s.events.length,s.result]);if(recap!==lastRecap&&!$('results').hidden){lastRecap=recap;renderRecap();}
 animate();
}
function renderRecap(){const s=state;$('result-label').textContent=s.phase==='final'?'FINAL RESULTS':'ROUND RECAP';$('result-title').textContent=s.result;
 const impacts=s.events.filter(e=>e.type==='impact'&&e.seat===s.seat&&['smite','empowered','burst'].includes(e.action));
 $('explanation').textContent=impacts.map(e=>{const name=e.action==='empowered'?'Empowered Smite':e.action==='smite'?'Smite':'Burst';const alone=s.events.filter(x=>x.type==='impact'&&x.time===e.time).length===1;return `Your ${name} landed with ${e.before.toLocaleString()} HP remaining ${alone?`and left ${e.after.toLocaleString()} HP`:`in a shared damage batch that left ${e.after.toLocaleString()} HP`}.`;}).join(' ')||'No ability impact from you this round. Check the final damage events below.';
 const important=s.events.filter(e=>e.type!=='start'&&(e.type!=='impact'||!['auto attack','environment'].includes(e.action)||e.after<1500));
 $('timeline').innerHTML=important.map(e=>{const who=e.seat===null?'Arena':e.seat===s.seat?'You':s.players[e.seat]?.name||'Rival';let text='';if(e.type==='cast')text=`${who} started ${e.action==='burst'?'Burst':'Smite'} (${e.resolves-e.time} ms).`;if(e.type==='attack')text=`${who} turned auto attack ${e.enabled?'on':'off'}.`;if(e.type==='impact')text=`${who}: ${e.action}, −${e.damage} HP${e.cost?`, spent ${e.cost} energy`:''}. Batch: ${e.before} → ${e.after} HP.`;if(e.type==='fizzle')text=`${who}: ${e.action} resolved after the kill, spent ${e.cost} energy; no damage.`;if(e.type==='kill')text=`LETHAL BATCH · ${e.total} damage against ${e.before} HP. ${e.winners.length===2?'Both players +1':e.winners.length===1?`${s.players[e.winners[0]].name} +1`:'Environment only, no points'}.`;return `<div class="timeline-row ${e.type==='kill'?'kill':''}"><time>${((e.time-s.rules.countdown)/1000).toFixed(2)}s</time><span>${escape(text)}</span></div>`;}).join('');}
function animate(){if(!state)return;const s=state;const elapsed=s.paused?0:Math.min(performance.now()-received,s.rules.tick*2);const sim=s.time+elapsed;
 $('stage-message').textContent=s.paused?'Match paused':s.phase==='countdown'?`${Math.max(1,Math.ceil((s.rules.countdown-sim)/1000))}`:s.phase==='lobby'?'Awaiting challengers':s.phase==='results'||s.phase==='final'?'Objective secured':'';
 for(const action of ['smite','empowered','burst']){const e=s.pending.find(e=>e.seat===s.seat&&e.action===action);$(action+'-progress').style.width=e?`${Math.max(0,Math.min(100,(sim-e.start)/(e.at-e.start)*100))}%`:'0%';}
 if(s.paused){const now=s.serverTime+(performance.now()-received);const seconds=Math.max(0,Math.ceil((s.forfeitAt-now)/1000));$('pause-note').textContent=seconds?`Waiting up to ${seconds}s. Refreshing the original tab restores its seat.`:'The reconnect window elapsed. You may claim a forfeit.';$('forfeit').hidden=seconds>0||s.players[1-s.seat]?.connected;$('forfeit').disabled=ws.readyState!==WebSocket.OPEN;}
}
setInterval(()=>{animate();},25);setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ping',sent:performance.now()}));},2000);
const savedCode=$('code').value.toUpperCase();if(savedCode&&sessionStorage.getItem(`smite:${savedCode}`))intent={code:savedCode,token:sessionStorage.getItem(`smite:${savedCode}`),name:$('name').value};connect();
