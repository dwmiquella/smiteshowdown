export const RULES = Object.freeze({hp:10000, rounds:7, tick:50, countdown:3000, environment:200, environmentEvery:1000, attack:100, attackEvery:500, smite:600, empowered:850, smiteCast:200, burst:250, burstCast:400, energy:6, empoweredCost:2, burstCost:1, reconnect:30000, roomExpiry:7200000});
const fresh = name => ({name, energy:RULES.energy, revealedEnergy:RULES.energy, score:0, ready:false, connected:false, attack:false, smiteUsed:false, burstUsed:false, lastSeq:0});
export class Game {
  constructor(code, practice=false) { this.code=code; this.practice=practice; this.players=[null,null]; this.phase='lobby'; this.round=0; this.time=0; this.hp=RULES.hp; this.pending=[]; this.events=[]; this.history=[]; this.paused=false; this.missingSince=null; this.result=''; }
  addPlayer(name) { const seat=this.players.findIndex(p=>!p); if(seat<0) throw Error('This room already has two players.'); this.players[seat]=fresh(name); return seat; }
  connection(seat, connected, wall=Date.now()) {this.players[seat].connected=connected; if(!connected && !['lobby','final'].includes(this.phase)){this.paused=true;this.missingSince ??=wall;} if(this.players.every(p=>p?.connected)){this.paused=false;this.missingSince=null;} }
  log(type, data={}) {this.events.push({time:this.time, type, ...data});}
  command(seat, msg, wall=Date.now()) {
    const p=this.players[seat]; if(!p?.connected) return 'Not connected.';
    if(!Number.isSafeInteger(msg.seq)||msg.seq<=p.lastSeq) return 'Duplicate or out-of-order action.';
    p.lastSeq=msg.seq;
    if(msg.action==='forfeit') {if(!this.paused||this.missingSince===null||wall-this.missingSince<RULES.reconnect||this.players[1-seat]?.connected) return 'Forfeit is not available yet.'; this.phase='final';this.paused=false;this.pending=[];this.result=`${p.name} wins by disconnect forfeit.`;this.forfeitWinner=seat;return null;}
    if(this.paused) return 'Match paused while a player reconnects.';
    if(msg.action==='ready') {
      if(!['lobby','results','final'].includes(this.phase)||this.pending.length) return 'Wait for the current actions to resolve.';
      p.ready=true;
      if(this.players.every(x=>x?.ready&&x.connected)) {
        if(this.phase==='final') {for(const x of this.players){x.energy=x.revealedEnergy=RULES.energy;x.score=0;} this.round=0;this.history=[];this.forfeitWinner=undefined;}
        this.startRound();
      } return null;
    }
    if(this.phase!=='live') return 'The round is not live.';
    if(msg.action==='attack') {p.attack=!p.attack;this.log('attack',{seat, enabled:p.attack});return null;}
    if(!['smite','empowered','burst'].includes(msg.action)) return 'Unknown action.';
    const burst=msg.action==='burst', empowered=msg.action==='empowered';
    if(burst?p.burstUsed:p.smiteUsed) return 'That action was already used this round.';
    const cost=burst?RULES.burstCost:empowered?RULES.empoweredCost:0;
    if(p.energy<cost) return 'Not enough energy.';
    p.energy-=cost; if(burst)p.burstUsed=true;else p.smiteUsed=true;
    const cast=burst?RULES.burstCast:RULES.smiteCast;
    this.pending.push({seat, action:msg.action, cost, damage:burst?RULES.burst:empowered?RULES.empowered:RULES.smite, at:this.time+cast, start:this.time});
    this.log('cast',{seat, action:burst?'burst':'smite', resolves:this.time+cast});return null;
  }
  startRound() { this.round++;this.phase='countdown';this.time=0;this.hp=RULES.hp;this.pending=[];this.events=[];this.result='';for(const p of this.players){p.ready=false;p.attack=false;p.smiteUsed=false;p.burstUsed=false;} }
  step() {
    if(this.paused||['lobby','final'].includes(this.phase))return;
    this.time+=RULES.tick;
    if(this.phase==='countdown'){if(this.time>=RULES.countdown){this.phase='live';this.log('start');}return;}
    const batch=[]; const due=this.pending.filter(e=>e.at<=this.time);this.pending=this.pending.filter(e=>e.at>this.time);
    for(const e of due){this.players[e.seat].revealedEnergy-=e.cost;batch.push({...e,type:'impact'});}
    if(this.phase==='results') {for(const e of batch)this.log('fizzle',{...e,type:'fizzle',reason:'The monster was already defeated.'});return;}
    const elapsed=this.time-RULES.countdown;
    if(elapsed%RULES.environmentEvery===0) batch.push({seat:null,action:'environment',damage:RULES.environment,cost:0});
    if(elapsed%RULES.attackEvery===0)for(let seat=0;seat<2;seat++)if(this.players[seat].attack)batch.push({seat,action:'auto attack',damage:RULES.attack,cost:0});
    if(!batch.length)return;
    const before=this.hp, total=batch.reduce((sum,e)=>sum+e.damage,0);this.hp=Math.max(0,before-total);
    for(const e of batch)this.log('impact',{seat:e.seat,action:e.action,damage:e.damage,cost:e.cost,before,after:this.hp});
    if(this.hp===0){const winners=[...new Set(batch.filter(e=>e.seat!==null).map(e=>e.seat))];for(const seat of winners)this.players[seat].score++;this.log('kill',{winners,before,total});this.result=winners.length===2?'Both players contributed to the lethal tick. One point each.':winners.length===1?`${this.players[winners[0]].name} secured the monster. One point.`:'The arena defeated the monster. No points awarded.';this.history.push({round:this.round,winners});this.phase='results';for(const p of this.players){p.ready=false;p.attack=false;} }
  }
  finishIfNeeded(){if(this.phase==='results'&&this.round=== (this.practice?1:RULES.rounds)&&!this.pending.length){this.phase='final';const [a,b]=this.players;this.result+= this.practice?' Practice complete.':a.score===b.score?' Match drawn.':` ${a.score>b.score?a.name:b.name} wins the match.`;}}
  view(seat, wall=Date.now()) {
    return {code:this.code,practice:this.practice,rules:RULES,seat,phase:this.phase,round:this.round,time:this.time,serverTime:wall,hp:this.hp,paused:this.paused,forfeitAt:this.missingSince===null?null:this.missingSince+RULES.reconnect,result:this.result,history:this.history,
      players:this.players.map((p,i)=>p?{name:p.name,energy:i===seat?p.energy:p.revealedEnergy,revealedEnergy:p.revealedEnergy,score:p.score,ready:p.ready,connected:p.connected,attack:p.attack,smiteUsed:p.smiteUsed,burstUsed:p.burstUsed,...(i===seat?{lastSeq:p.lastSeq}:{})}:null),
      pending:this.pending.map(e=>({seat:e.seat,action:e.seat===seat?e.action:e.action==='burst'?'burst':'smite',start:e.start,at:e.at})),events:this.events.slice(-320)};
  }
}
