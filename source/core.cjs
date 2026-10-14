/* Backpack V3: same pure engine on browser and trusted callable server. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BackpackV3Core=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='v3.0.0';
let ITEMS={},CHARACTERS={};
function configure(items,characters){ITEMS=items;CHARACTERS=characters;}
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function clone(v){return JSON.parse(JSON.stringify(v));}
function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function loadout(v){
 if(!v||!Object.hasOwn(CHARACTERS,v.charKey)||typeof v.name!=='string'||!v.name.trim()||v.name.length>24||!Array.isArray(v.backpack)||v.backpack.length>30)fail('invalid-argument','Проверь имя (1–24), героя и рюкзак.');
 const cells=new Set(),ids=new Set();
 const bp=v.backpack.map(p=>{if(!p||!Object.hasOwn(ITEMS,p.itemKey)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||!Number.isInteger(p.uid)||ids.has(p.uid))fail('invalid-argument','Некорректный предмет или повтор UID.');ids.add(p.uid);const [w,h]=ITEMS[p.itemKey].size;if(p.x<0||p.y<0||p.x+w>6||p.y+h>5)fail('invalid-argument','Предмет вне рюкзака 6×5.');for(let y=p.y;y<p.y+h;y++)for(let x=p.x;x<p.x+w;x++){const c=x+','+y;if(cells.has(c))fail('invalid-argument','Предметы перекрываются.');cells.add(c);}return{itemKey:p.itemKey,x:p.x,y:p.y,uid:p.uid};});
 bp.sort((a,b)=>a.y-b.y||a.x-b.x||(a.itemKey<b.itemKey?-1:a.itemKey>b.itemKey?1:0)||a.uid-b.uid);
 return{name:v.name.trim(),charKey:v.charKey,baseHp:CHARACTERS[v.charKey].hp,backpack:bp};
}
function fighter(v){const f={hp:v.baseHp,maxHp:v.baseHp,armor:0,atkBonus:0,hpBonus:0,crit:0,lifesteal:0,thorn:0,magicBonus:0,weapons:[],potions:[]};for(const p of v.backpack){const it=ITEMS[p.itemKey];for(const k of ['armor','atkBonus','hpBonus','crit','lifesteal','thorn','magicBonus'])f[k]+=it[k]||0;}f.crit=Math.min(1,f.crit);f.lifesteal=Math.min(1,f.lifesteal);f.maxHp+=f.hpBonus;f.hp=f.maxHp;for(const p of v.backpack){const it=ITEMS[p.itemKey],cd=Math.round((it.cd||1)*100);if(it.type==='weapon')f.weapons.push({name:it.name,dmg:it.magic?Math.floor((it.dmg+f.atkBonus)*(1+f.magicBonus)):it.dmg+f.atkBonus,cd,next:cd,magic:!!it.magic});if(it.heal)f.potions.push({name:it.name,heal:it.heal,cd,next:cd});}return f;}
function duel(a,b,seed){
 const fs=[fighter(a),fighter(b)],events=[],random=rng(seed);let tick=0;
 for(tick=0;tick<=9000;tick+=5){
  if(fs.some(f=>f.hp<=0))break;
  for(let i=0;i<2;i++)for(const p of fs[i].potions)if(tick>=p.next){const heal=Math.min(p.heal,fs[i].maxHp-fs[i].hp);fs[i].hp+=heal;p.next+=p.cd;if(heal)events.push({tick,kind:'heal',actor:i,amount:heal,hp:fs.map(f=>Math.max(0,f.hp))});}
  // Alternate the first attacker each tick to avoid persistent seat-first priority.
  for(const i of (Math.floor(tick/5)%2?[1,0]:[0,1])){const f=fs[i],g=fs[1-i];for(const w of f.weapons){if(f.hp<=0||g.hp<=0)break;if(tick<w.next)continue;w.next+=w.cd;const crit=random()<f.crit;let damage=w.magic?w.dmg:Math.max(1,w.dmg-g.armor);if(crit)damage*=2;const effective=Math.min(damage,g.hp);g.hp-=damage;const heal=Math.floor(effective*f.lifesteal);f.hp=Math.min(f.maxHp,f.hp+heal)-g.thorn;events.push({tick,kind:'attack',actor:i,amount:damage,crit,magic:w.magic,weapon:w.name,selfHeal:heal,thorn:g.thorn,hp:fs.map(f=>Math.max(0,f.hp))});}}
 }
 fs.forEach(f=>f.hp=Math.max(0,f.hp));let winner=-1;if(fs[0].hp<=0&&fs[1].hp>0)winner=1;else if(fs[1].hp<=0&&fs[0].hp>0)winner=0;else if(fs.every(f=>f.hp>0)){const d=fs[0].hp/fs[0].maxHp-fs[1].hp/fs[1].maxHp;if(Math.abs(d)>1e-9)winner=d>0?0:1;}
 return{seed,winner,duration:Math.min(tick,9000),hp:fs.map(f=>f.hp),maxHp:fs.map(f=>f.maxHp),events};
}
function pairings(ids,round){if(ids.length===2)return[[ids[0],ids[1]]];if(ids.length===3)return[[ids[0],ids[1]],[ids[1],ids[2]],[ids[0],ids[2]]];if(ids.length===4){const schedules=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];return schedules[(round-1)%3].map(p=>p.map(i=>ids[i]));}fail('failed-precondition','Для PvP нужно 2–4 игрока.');}
function tournament(members,round,seed){const ids=Object.keys(members).sort(),scores=Object.fromEntries(ids.map(u=>[u,{points:0,games:0,normalized:0}]));const matches=pairings(ids,round).map((pair,i)=>{const r=duel(members[pair[0]].loadout,members[pair[1]].loadout,(seed+Math.imul(i+1,2654435761))>>>0);for(let j=0;j<2;j++){scores[pair[j]].games++;scores[pair[j]].points+=r.winner<0?.5:r.winner===j?1:0;}return{pair,...r};});for(const s of Object.values(scores))s.normalized=s.points/s.games;return{version:VERSION,round,seed,matches,scores};}
function advance(room){const active=Object.keys(room.members);if(!active.length)return null;if(room.phase==='result'&&active.every(u=>room.members[u].ack===room.round)){room.phase='preparing';room.round++;for(const m of Object.values(room.members)){m.ready=false;delete m.loadout;delete m.ack;}}return room;}
function command(current,uid,action,data,now,seed){
 if(!current||now>current.expiresAt)fail('not-found','Комната истекла. Создай новую.');const room=clone(current),m=room.members[uid];
 if(action==='join'){if(m)return room;if(room.phase!=='preparing')fail('failed-precondition','Бой уже запущен. Подожди следующий раунд.');if(Object.keys(room.members).length>=4)fail('resource-exhausted','Комната заполнена (максимум 4).');const l=loadout(data.loadout);room.members[uid]={name:l.name,charKey:l.charKey,joinedAt:now,ready:false};for(const x of Object.values(room.members)){x.ready=false;delete x.loadout;}room.revision++;return room;}
 if(!m)fail('permission-denied','Ты не участник этой комнаты.');
 if(action==='leave'){delete room.members[uid];for(const x of Object.values(room.members))if(room.phase==='preparing'){x.ready=false;delete x.loadout;}if(room.owner===uid)room.owner=Object.keys(room.members).sort()[0]||'';room.revision++;return advance(room);}
 if(action==='ready'){
  if(room.phase!=='preparing')fail('failed-precondition','Сборки уже заморожены.');
  if(data.ready){if(m.ready)return room;m.loadout=loadout(data.loadout);m.name=m.loadout.name;m.charKey=m.loadout.charKey;m.ready=true;}else{m.ready=false;delete m.loadout;}
  const ids=Object.keys(room.members);if(ids.length>=2&&ids.every(u=>room.members[u].ready)){room.phase='result';room.frozen=clone(room.members);room.result=tournament(room.frozen,room.round,seed);room.startedAt=now;}room.revision++;return room;
 }
 if(action==='ack'){if(room.phase!=='result')return room;m.ack=room.round;return advance(room);}
 fail('invalid-argument','Неизвестное действие.');
}
return{VERSION,configure,clone,rng,loadout,fighter,duel,pairings,tournament,command};
});
