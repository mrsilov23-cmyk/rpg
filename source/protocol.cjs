(function(root,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else root.BackpackSpark=a;})(globalThis,function(){
'use strict';let C,I,H;const NS='backpack_spark_v4';function configure(c,i,h){C=c;I=i;H=h;C.configure(i,h);}function clone(v){return C.clone(v);}function fail(code,message){throw Object.assign(new Error(message),{code});}
function key(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function encode(v){const l=C.loadout(v),occupied={},backpack={};l.backpack.forEach((p,n)=>{const q={...p,uid:n};backpack[n]=q;const [w,h]=I[q.itemKey].size;for(let y=q.y;y<q.y+h;y++)for(let x=q.x;x<q.x+w;x++)occupied['c'+(y*6+x)]=String(n);});return{name:l.name,charKey:l.charKey,baseHp:l.baseHp,...(l.backpack.length?{backpack}:{})};}
function decode(v){return C.loadout({...v,backpack:Object.values(v?.backpack||{}).filter(Boolean)});}
function member(uid,v,now){const l=encode(v);return{uid,name:l.name,charKey:l.charKey,joinedAt:now,ready:false,readyRound:0,ack:0,left:false};}
function create(uid,v,now){return{meta:{owner:uid,phase:'preparing',round:1,seed:0,version:C.VERSION,createdAt:now,expiresAt:now+86400000},members:{'0':member(uid,v,now)}};}
function slot(raw,uid){return Object.keys(raw?.members||{}).find(s=>raw.members[s]?.uid===uid);}
function valid(raw,now=Date.now()){if(!raw?.meta||raw.meta.expiresAt<=now||raw.meta.phase==='closed')fail('not-found','Комната закрыта или срок ссылки истёк.');}
function active(raw){return Object.values(raw.members||{}).filter(m=>m&&!m.left);}
function allReady(raw){const a=active(raw);return a.length>=2&&a.every(m=>m.ready&&m.readyRound===raw.meta.round);}
function allAck(raw){return active(raw).every(m=>m.ack===raw.meta.round);}
function normalized(raw){const members={},frozen={};for(const m of Object.values(raw.members||{}).filter(Boolean)){const x={...m,ready:m.ready&&m.readyRound===raw.meta.round};if(m.loadout){x.loadout=decode(m.loadout);frozen[m.uid]={...x};}if(!m.left)members[m.uid]=x;}let result=raw.meta.result?clone(raw.meta.result):null;if(result){result.matches=Object.values(result.matches||{}).filter(Boolean).map(m=>({...m,pair:Object.values(m.pair||{}),hp:Object.values(m.hp||{}),maxHp:Object.values(m.maxHp||{}),events:Object.values(m.events||{}).filter(Boolean).map(e=>({...e,hp:Object.values(e.hp||{})}))}));}return{...raw.meta,owner:raw.meta.owner,members,frozen,result};}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function verify(raw){const r=normalized(raw);if(!r.result)return r;const expected=C.tournament(r.frozen,r.round,r.seed);if(canonical(r.result)!==canonical(expected))fail('invalid-result','Организатор опубликовал несогласованный результат. Replay заблокирован; создайте новую комнату.');return r;}
// Pure local mirror for mock invariants. Firebase security is provided by generated Rules, not this reducer.
function apply(raw,uid,action,data,now=Date.now()){
 if(action==='create')return create(uid,data.loadout,now);valid(raw,now);let r=clone(raw),s=slot(r,uid),m=s!==undefined?r.members[s]:null;
 if(action==='join'){if(m&&!m.left)return r;if(r.meta.phase!=='preparing')fail('failed-precondition','Бой запущен, новые игроки входят между раундами.');if(!m&&Object.values(r.members).filter(Boolean).length>=4)fail('resource-exhausted','Комната заполнена (максимум 4).');s=s??['0','1','2','3'].find(x=>!r.members[x]);r.members[s]={...member(uid,data.loadout,now),...(m?{joinedAt:m.joinedAt}:{})};return r;}
 if(!m||m.left)fail('permission-denied','Ты не активный участник комнаты.');
 if(action==='ready'){if(r.meta.phase!=='preparing')fail('failed-precondition','Сборки заморожены.');if(m.ready&&m.readyRound===r.meta.round&&data.ready)fail('failed-precondition','Сначала отмени готовность.');m.ready=!!data.ready;m.readyRound=data.ready?r.meta.round:0;m.ack=0;if(data.ready){m.loadout=encode(data.loadout);m.name=m.loadout.name;m.charKey=m.loadout.charKey;}return r;}
 if(action==='ack'){if(r.meta.phase!=='result')fail('failed-precondition','Результат ещё не готов.');m.ack=r.meta.round;return r;}
 if(action==='leave'){if(uid===r.meta.owner){r.meta.phase='closed';delete r.meta.result;return r;}if(r.meta.phase==='preparing')delete r.members[s];else m.left=true;return r;}
 if(uid!==r.meta.owner)fail('permission-denied','Это действие только организатора.');
 if(action==='start'){if(r.meta.phase!=='preparing'||!allReady(r))fail('failed-precondition','Все 2–4 участника должны быть готовы.');for(const m of active(r))decode(m.loadout);r.meta.phase='battle';r.meta.seed=data.seed>>>0;return r;}
 if(action==='publish'){if(r.meta.phase!=='battle'||r.meta.result)fail('failed-precondition','Результат уже опубликован.');r.meta.result=C.tournament(normalized(r).frozen,r.meta.round,r.meta.seed);r.meta.phase='result';return r;}
 if(action==='next'){if(r.meta.phase!=='result'||!allAck(r))fail('failed-precondition','Ждём подтверждения участников.');r.meta.phase='preparing';r.meta.round++;r.meta.seed=0;delete r.meta.result;for(const s of Object.keys(r.members))if(r.members[s]?.left)delete r.members[s];return r;}
 fail('invalid-argument','Неизвестное действие.');
}
return{NS,configure,key,encode,decode,member,create,slot,active,allReady,allAck,normalized,canonical,verify,apply,valid};
});
