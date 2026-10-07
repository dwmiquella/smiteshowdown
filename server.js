import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {Game,RULES} from './game.js';
export function createServer(){
 const rooms=new Map(); const sockets=new Set();const limits=new Map();
 const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/monster.svg':'monster.svg'};
  if(!files[path]){res.writeHead(404);res.end('Not found');return;}
  try {const body=await readFile(new URL(`./public/${files[path]}`,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(body);}catch{res.writeHead(500);res.end('Unable to load the game.');}
 });
 const wss=new WebSocketServer({server,maxPayload:2048});
 const send=(ws,obj)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<1000000)ws.send(JSON.stringify(obj));};
 const broadcast=room=>room.clients.forEach((ws,seat)=>send(ws,{type:'state',...room.game.view(seat)}));
 wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host){ws.close(1008,'Origin rejected');return;}}catch{ws.close(1008);return;}}
  sockets.add(ws);ws.alive=true;ws.on('pong',()=>ws.alive=true);let room,seat,windowStart=Date.now(),count=0;
  const error=message=>send(ws,{type:'error',message});
  ws.on('message',raw=>{try{
   if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;}if(++count>30){error('Too many requests.');return;}
   const msg=JSON.parse(raw);if(!msg||typeof msg!=='object')return;
   if(msg.type==='ping'){send(ws,{type:'pong',sent:msg.sent,serverTime:Date.now()});return;}
   if(msg.type==='join'){
    if(room){error('Already in a room.');return;}
    const code=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(code.length>8){error('Invalid room code.');return;}
    if(code){room=rooms.get(code);if(!room){error('Room not found or expired.');return;}}
    else {const ip=req.socket.remoteAddress;const l=limits.get(ip)||{at:Date.now(),n:0};if(Date.now()-l.at>3600000){l.at=Date.now();l.n=0;}if(++l.n>30||rooms.size>=1000){limits.set(ip,l);error('Room creation limit reached. Try again later.');return;}limits.set(ip,l);let id;do{id=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(id));room={game:new Game(id,!!msg.practice),tokens:[],clients:[],created:Date.now()};rooms.set(id,room);}
    const token=typeof msg.token==='string'?msg.token:'';seat=token?room.tokens.indexOf(token):-1;
    if(seat<0){if(room.game.players.every(Boolean)){room=null;error('Room full. Rejoin using the original browser tab.');return;}const name=String(msg.name||'Warden').trim().slice(0,20)||'Warden';seat=room.game.addPlayer(name);room.tokens[seat]=randomBytes(32).toString('hex');}
    const previous=room.clients[seat];room.clients[seat]=ws;if(previous&&previous!==ws){send(previous,{type:'replaced'});previous.close(4001,'Seat opened in another tab');}
    room.game.connection(seat,true);
    if(room.game.practice&&!room.game.players[1]){room.game.addPlayer('Practice target');room.game.connection(1,true);room.game.players[1].ready=true;}
    send(ws,{type:'joined',code:room.game.code,token:room.tokens[seat],seat});broadcast(room);return;
   }
   if(msg.type==='action'&&room){(room.queue??=[]).push({seat,msg,ws});}
  }catch{error('Invalid request.');}});
  ws.on('close',()=>{sockets.delete(ws);if(room&&room.clients[seat]===ws){room.clients[seat]=null;room.game.connection(seat,false);broadcast(room);}});
  ws.on('error',()=>{});
 });
 const simulation=setInterval(()=>{for(const room of rooms.values()){room.game.step();room.game.finishIfNeeded();if(room.game.practice&&room.game.phase==='final')room.game.players[1].ready=true;for(const item of room.queue||[]){if(room.clients[item.seat]!==item.ws)continue;const result=room.game.command(item.seat,item.msg);if(result)send(item.ws,{type:'error',message:result});}room.queue=[];broadcast(room);}},RULES.tick);
 const heartbeat=setInterval(()=>{for(const ws of sockets){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}for(const [code,room]of rooms){if(Date.now()-room.created>RULES.roomExpiry){for(const ws of room.clients){send(ws,{type:'expired'});ws?.close(4002,'Room expired');}rooms.delete(code);}}for(const [ip,l]of limits)if(Date.now()-l.at>3600000)limits.delete(ip);},10000);
 const close=()=>{clearInterval(simulation);clearInterval(heartbeat);for(const ws of sockets)ws.terminate();wss.close();return new Promise(resolve=>server.close(resolve));};
 return {server,rooms,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createServer();app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Smite Showdown listening on port ${Number(process.env.PORT)||3000}`));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
