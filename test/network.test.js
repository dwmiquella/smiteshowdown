import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createServer} from '../server.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw Error('Timed out waiting for socket state');}
test('independent WebSockets join, reject third seat, conceal spending, reconnect and reject duplicate actions',async()=>{
 const app=createServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${app.server.address().port}`;const clients=[];
 async function client(join){const ws=new WebSocket(url),c={ws,messages:[]};clients.push(c);ws.on('message',raw=>{const m=JSON.parse(raw);c.messages.push(m);if(m.type==='joined')c.join=m;if(m.type==='state')c.state=m;});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',version:2,...join}));return c;}
 const send=(c,action,seq)=>c.ws.send(JSON.stringify({type:'action',action,seq}));
 try{const a=await client({name:'A'});await until(()=>a.join);const b=await client({name:'B',code:a.join.code});await until(()=>b.join);const c=await client({name:'C',code:a.join.code});await until(()=>c.messages.some(m=>m.type==='error'));assert.match(c.messages.at(-1).message,/full/);
 send(a,'ready',1);send(b,'ready',1);await until(()=>a.state?.phase==='countdown');const room=app.rooms.get(a.join.code);while(room.game.phase==='countdown')room.game.step();await until(()=>a.state?.phase==='live');send(a,'burst',2);await until(()=>b.state?.pending.length);assert.equal(b.state.pending[0].action,'burst');assert.equal(b.state.players[0].energy,3);send(a,'burst',2);await until(()=>a.messages.some(m=>m.type==='error'));await until(()=>b.state.players[0].energy===2);assert.equal(room.game.hp,9750);
 b.ws.close();await until(()=>a.state.paused);const hp=a.state.hp;await wait(200);assert.equal(a.state.hp,hp);const restored=await client({code:a.join.code,token:b.join.token});await until(()=>restored.state&&!restored.state.paused);assert.equal(restored.join.seat,1);assert.equal(restored.state.players[0].energy,2);
 }finally{for(const c of clients)c.ws.terminate();await app.close();}
});
