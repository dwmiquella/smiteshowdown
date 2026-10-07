export const RULES = Object.freeze({hp:10000,rounds:7,tick:50,countdown:3000,environment:200,environmentEvery:1000,attack:100,attackEvery:500,smite:600,smiteGrowth:100,smiteCast:200,burst:250,burstCast:400,energy:3,energyCap:6,energyRegen:1,burstCost:1,stunCost:1,stunCast:300,stunDuration:600,reconnect:30000,roomExpiry:7200000});
export const MONSTERS = Object.freeze([
 {name:'The Hollow Sentinel',image:'/monster.svg',theme:'stone'},
 {name:'The Thorn Regent',image:'/thorn.svg',theme:'forest'},
 {name:'The Astral Manta',image:'/manta.svg',theme:'astral'}
]);
const fresh=name=>({name,energy:RULES.energy,revealedEnergy:RULES.energy,score:0,ready:false,connected:false,attack:false,smiteUsed:false,burstUsed:false,stunUsed:false,stunnedUntil:0,lastSeq:0});
export class Game {
 constructor(code,practice=false){Object.assign(this,{code,practice,players:[null,null],phase:'lobby',round:0,time:0,hp:RULES.hp,pending:[],events:[],history:[],paused:false,missingSince:null,result:'',order:0,eventId:0});}
 get smiteDamage(){return RULES.smite+RULES.smiteGrowth*Math.max(0,this.round-1);}
 addPlayer(name){const seat=this.players.findIndex(p=>!p);if(seat<0)throw Error('This room already has two players.');this.players[seat]=fresh(name);return seat;}
 connection(seat,connected,wall=Date.now()){this.players[seat].connected=connected;if(!connected&&!['lobby','final'].includes(this.phase)){this.paused=true;this.missingSince??=wall;}if(this.players.every(p=>p?.connected)){this.paused=false;this.missingSince=null;}}
 log(type,data={}){this.events.push({id:++this.eventId,time:this.time,type,...data});}
 command(seat,msg,wall=Date.now()){
  const p=this.players[seat];if(!p?.connected)return 'Not connected.';
  if(!Number.isSafeInteger(msg.seq)||msg.seq<=p.lastSeq)return 'Duplicate or out-of-order action.';p.lastSeq=msg.seq;
  if(msg.action==='forfeit'){
   if(!this.paused||this.missingSince===null||wall-this.missingSince<RULES.reconnect||this.players[1-seat]?.connected)return 'Forfeit is not available yet.';
   this.phase='final';this.paused=false;this.pending=[];this.result=`${p.name} wins by disconnect forfeit.`;this.forfeitWinner=seat;for(const x of this.players){x.ready=false;x.attack=false;}return null;
  }
  if(this.paused)return 'Match paused while a player reconnects.';
  if(msg.action==='ready'){
   if(!['lobby','results','final'].includes(this.phase)||this.pending.length)return 'Wait for the current actions to resolve.';
   p.ready=true;if(this.players.every(x=>x?.ready&&x.connected)){
    if(this.phase==='final'){for(const x of this.players){x.energy=x.revealedEnergy=RULES.energy;x.score=0;}this.round=0;this.history=[];this.forfeitWinner=undefined;}
    this.startRound();
   }return null;
  }
  if(this.phase!=='live')return 'The round is not live.';
  if(p.stunnedUntil>this.time)return 'Stunned: wait for Disrupt to expire. Committed casts still land.';
  if(msg.action==='attack'){p.attack=!p.attack;this.log('attack',{seat,enabled:p.attack});return null;}
  if(!['smite','burst','stun'].includes(msg.action))return 'Unknown action.';
  const config={smite:{cost:0,cast:RULES.smiteCast,damage:this.smiteDamage},burst:{cost:RULES.burstCost,cast:RULES.burstCast,damage:RULES.burst},stun:{cost:RULES.stunCost,cast:RULES.stunCast,damage:0}}[msg.action];
  if(!config)return 'Unknown action.';
  const used=msg.action+'Used';if(p[used])return 'That action was already used this round.';
  if(p.energy<config.cost)return 'Not enough energy.';
  p.energy-=config.cost;p[used]=true;
  const effect={seat,action:msg.action,cost:config.cost,damage:config.damage,at:this.time+config.cast,start:this.time,order:++this.order};
  this.pending.push(effect);this.log('cast',{seat,action:msg.action,resolves:effect.at,order:effect.order});return null;
 }
 startRound(){
  this.round++;this.phase='countdown';this.time=0;this.hp=RULES.hp;this.pending=[];this.events=[];this.result='';
  for(const p of this.players){if(this.round>1)p.energy=Math.min(RULES.energyCap,p.energy+RULES.energyRegen);p.revealedEnergy=p.energy;p.ready=false;p.attack=false;p.smiteUsed=p.burstUsed=p.stunUsed=false;p.stunnedUntil=0;}
 }
 impact(e){
  if(e.cost)this.players[e.seat].revealedEnergy-=e.cost;
  if(this.phase!=='live'){if(e.order)this.log('fizzle',{seat:e.seat,action:e.action,cost:e.cost,reason:'The monster was already defeated.'});return;}
  if(e.action==='stun'){const target=1-e.seat;this.players[target].stunnedUntil=Math.max(this.players[target].stunnedUntil,this.time+RULES.stunDuration);this.log('stun',{seat:e.seat,target,cost:e.cost,until:this.players[target].stunnedUntil});return;}
  const before=this.hp;this.hp=Math.max(0,before-e.damage);this.log('impact',{seat:e.seat,action:e.action,damage:e.damage,cost:e.cost,before,after:this.hp});
  if(this.hp===0){const winners=e.seat===null?[]:[e.seat];if(winners.length)this.players[e.seat].score++;this.log('kill',{winners,before,total:e.damage,action:e.action});this.result=winners.length?`${this.players[e.seat].name} secured the monster with ${e.action}. One point.`:'The arena defeated the monster. No points awarded.';this.history.push({round:this.round,winners});this.phase='results';for(const p of this.players){p.ready=false;p.attack=false;p.stunnedUntil=0;}}
 }
 step(){
  if(this.paused||['lobby','final'].includes(this.phase)||(this.phase==='results'&&!this.pending.length))return;
  this.time+=RULES.tick;
  if(this.phase==='countdown'){if(this.time>=RULES.countdown){this.phase='live';this.log('start');}return;}
  // Equal deadlines use a monotonic SERVER acceptance order, never seat or client time.
  const due=this.pending.filter(e=>e.at<=this.time).sort((a,b)=>a.at-b.at||a.order-b.order);this.pending=this.pending.filter(e=>e.at>this.time);
  for(const e of due)this.impact(e);
  if(this.phase!=='live')return;
  const elapsed=this.time-RULES.countdown;
  // Casts resolve before environment and attacks at an equal tick boundary.
  if(elapsed%RULES.environmentEvery===0)this.impact({seat:null,action:'environment',damage:RULES.environment,cost:0});
  if(this.phase!=='live')return;
  if(elapsed%RULES.attackEvery===0){const first=(this.round-1)%2;for(const seat of [first,1-first]){const p=this.players[seat];if(this.phase==='live'&&p.attack&&p.stunnedUntil<=this.time)this.impact({seat,action:'auto attack',damage:RULES.attack,cost:0});}}
 }
 finishIfNeeded(){if(this.phase==='results'&&this.round===(this.practice?1:RULES.rounds)&&!this.pending.length){this.phase='final';const [a,b]=this.players;this.result+=this.practice?' Practice complete.':a.score===b.score?' Match drawn.':` ${a.score>b.score?a.name:b.name} wins the match.`;}}
 view(seat,wall=Date.now()){
  return {version:2,code:this.code,practice:this.practice,rules:RULES,smiteDamage:this.smiteDamage,monster:MONSTERS[Math.max(0,this.round-1)%MONSTERS.length],attackPriority:(Math.max(1,this.round)-1)%2,seat,phase:this.phase,round:this.round,time:this.time,serverTime:wall,hp:this.hp,paused:this.paused,forfeitAt:this.missingSince===null?null:this.missingSince+RULES.reconnect,result:this.result,history:this.history,
   players:this.players.map((p,i)=>p?{name:p.name,energy:i===seat?p.energy:p.revealedEnergy,revealedEnergy:p.revealedEnergy,score:p.score,ready:p.ready,connected:p.connected,attack:p.attack,smiteUsed:p.smiteUsed,burstUsed:p.burstUsed,stunUsed:p.stunUsed,stunnedUntil:p.stunnedUntil,...(i===seat?{lastSeq:p.lastSeq}:{})}:null),
   pending:this.pending.map(e=>({seat:e.seat,action:e.action,start:e.start,at:e.at})),events:this.events.slice(['results','final'].includes(this.phase)?-320:-12)};
 }
}
