/* Network V3 integration. Training never loads an SDK or touches Firebase. */
(()=>{
'use strict';
const Core=window.BackpackV3Core;Core.configure(ITEMS,CHARACTERS);window.BackpackSpark.configure(Core,ITEMS,CHARACTERS);
const FIREBASE_CONFIG={"apiKey":"AIzaSyBhGCaZQ8THfi1LEhpxY5cE_84qByJhgSU","authDomain":"backpuck-ef94b.firebaseapp.com","databaseURL":"https://backpuck-ef94b-default-rtdb.europe-west1.firebasedatabase.app","projectId":"backpuck-ef94b","storageBucket":"backpuck-ef94b.firebasestorage.app","messagingSenderId":"944350697021","appId":"1:944350697021:web:32eb6d22cd846a0a237c54","measurementId":"G-0VY1VQ6Z2F"};
const N={adapter:null,uid:null,room:null,roomId:null,token:null,stop:null,busy:false,seen:null,presence:{},timer:null,generation:0};
const node=id=>document.getElementById(id);
const panel=node('networkV3');
function status(text){node('networkStatus').textContent=text;}
function snapshot(){return Core.loadout({name:state.name||node('playerName').value.trim(),charKey:state.charKey,backpack:state.backpack});}
function error(e){const code=String(e.code||'').replace(/^(auth|database)\//,'').toLowerCase().replaceAll('_','-');const messages={
 'operation-not-allowed':'Anonymous Auth выключен. Владелец проекта: Authentication → Sign-in method → Anonymous → Enable. Тренировка работает без сети.',
 'unauthorized-domain':'Этот домен не разрешён Firebase Auth. Добавь домен хостинга в Authorized domains.',
 'permission-denied':'Нет доступа. Проверь полную ссылку, членство комнаты и scoped Rules. Не открывай всю базу.',
 'network-request-failed':'Нет соединения. Проверь интернет и повтори подключение.',
 'unavailable':'Сервер недоступен. Проверь сеть и deployment RTDB и согласованные Rules.',
 'not-found':'Комната или сервер не найдены. Проверь Rules и срок ссылки (24 часа).',
 'resource-exhausted':e.message||'Комната заполнена или запросы слишком частые. Подожди и повтори.',
 'failed-precondition':e.message||'Сейчас нельзя выполнить действие. Дождись следующего раунда.',
 'auth-lost':'Вход потерян. Подключись снова. После удаления anonymous identity возврат не гарантирован.'};
 status(messages[code]||e.message||'Ошибка подключения. Повтори или выбери тренировку.');notify(node('networkStatus').textContent,'error',6000);console.warn('[BackpackV3]',code,e.message);
}
function timeout(p,ms=18000){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Сервер не отвечает. Проверь сеть/Rules и повтори.')),ms))]);}
async function sdk(name){if(document.querySelector(`script[data-v3-sdk="${name}"]`)&&window.firebase&&((name==='app')||(name==='auth'&&firebase.auth)||(name==='database'&&firebase.database)))return;const el=document.createElement('script');el.dataset.v3Sdk=name;el.src=`https://www.gstatic.com/firebasejs/10.12.0/firebase-${name}-compat.js`;await timeout(new Promise((res,rej)=>{el.onload=res;el.onerror=()=>{el.remove();rej(new Error('Firebase CDN недоступен. Тренировка работает офлайн; проверь интернет и повтори.'));};document.head.appendChild(el);}),10000);}
async function firebaseAdapter(){
 if(!window.BACKPACK_SPARK_RULES_APPROVED && !window.BACKPACK_SPARK_EMULATOR)throw Object.assign(new Error('Сначала опубликуйте закрытые Rules в новом проекте backpuck-ef94b, затем включайте онлайн.'),{code:'pending-rules'});
 await sdk('app');await Promise.all(['auth','database'].map(sdk));
 const app=firebase.apps.find(a=>a.name==='backpack-backpuck-ef94b-v4')||firebase.initializeApp(FIREBASE_CONFIG,'backpack-backpuck-ef94b-v4'),auth=app.auth(),db=app.database();
 if(window.BACKPACK_SPARK_EMULATOR){auth.useEmulator('http://127.0.0.1:9099');db.useEmulator('127.0.0.1',9000);}
 await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);const restored=await timeout(new Promise(resolve=>{const off=auth.onAuthStateChanged(u=>{off();resolve(u);});}));const user=restored||(await timeout(auth.signInAnonymously())).user,uid=user.uid;
 const P=window.BackpackSpark;P.configure(Core,ITEMS,CHARACTERS);let connected=false,pumping=false,hostStop=false,latestRaw=null;
 const roomRef=id=>db.ref(P.NS+'/rooms/'+id);
 async function getRoom(id){if(!/^[a-f0-9]{32}$/.test(id||''))throw new Error('Нужна полная ссылка с room=…');const s=await timeout(roomRef(id).get()),r=s.val();P.valid(r);return r;}
 async function transaction(ref,fn){const r=await timeout(ref.transaction(fn,undefined,false));if(!r.committed)throw Object.assign(new Error('Комната изменилась. Повтори действие.'),{code:'aborted'});return r.snapshot.val();}
 async function pump(id,raw){if(pumping||hostStop||!connected||raw.meta.owner!==uid||raw.meta.phase==='closed')return;pumping=true;try{
 const metaRef=roomRef(id).child('meta');
 if(raw.meta.phase==='preparing'&&P.allReady(raw)){
  for(const m of P.active(raw))P.decode(m.loadout);
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  await transaction(metaRef,m=>m?.phase==='preparing'&&m.round===raw.meta.round?{...m,phase:'battle',seed}:undefined);
 }else if(raw.meta.phase==='battle'){
  const frozen=P.normalized(raw).frozen,result=Core.tournament(frozen,raw.meta.round,raw.meta.seed);
  await transaction(metaRef,m=>m?.phase==='battle'&&m.round===raw.meta.round&&!m.result?{...m,phase:'result',result}:undefined);
 }else if(raw.meta.phase==='result'&&P.allAck(raw)){
  await transaction(metaRef,m=>{if(m?.phase!=='result'||m.round!==raw.meta.round)return;const next={...m,phase:'preparing',round:m.round+1,seed:0};delete next.result;return next;});
  for(const [s,m]of Object.entries(raw.members))if(m?.left)await roomRef(id).child('members/'+s).remove();
 }
 }catch(e){if(e.code!=='aborted'&&e.code!=='PERMISSION_DENIED'&&e.code!=='permission-denied')error(e);else status('Состав или готовность изменились. Ждём новое состояние.');}finally{pumping=false;if(!hostStop&&connected&&latestRaw&&latestRaw!==raw)queueMicrotask(()=>pump(id,latestRaw));}}
 return{uid,
 async call(action,data){
  if(action==='create'){const id=P.key(),r=P.create(uid,data.loadout,Date.now());await timeout(roomRef(id).set(r));return{roomId:id,token:id};}
  const id=data.roomId,ref=roomRef(id),raw=await getRoom(id),s=P.slot(raw,uid),m=s!==undefined?raw.members[s]:null;
  if(action==='join'){
   if(m&&!m.left)return{ok:true};if(raw.meta.phase!=='preparing')throw Object.assign(new Error('Бой запущен. Войти можно между раундами.'),{code:'failed-precondition'});
   for(const k of (s!==undefined?[s]:['0','1','2','3'])){if(raw.members[k]&&k!==s)continue;try{await transaction(ref.child('members/'+k),v=>!v||(v.uid===uid&&v.left)?{...P.member(uid,data.loadout,Date.now()),...(v?{joinedAt:v.joinedAt}:{})}:undefined);return{ok:true};}catch(e){if(!['aborted','PERMISSION_DENIED','permission-denied'].includes(e.code))throw e;}}
   throw Object.assign(new Error('Комната заполнена (максимум 4) или состав изменился. Повтори позже.'),{code:'resource-exhausted'});
  }
  if(!m||m.left)throw Object.assign(new Error('Ты не участник этой комнаты.'),{code:'permission-denied'});
  const mr=ref.child('members/'+s);
  if(action==='ready'){const wire=data.ready?P.encode(data.loadout):null;await transaction(mr,v=>{if(!v||v.uid!==uid)return;return{...v,ready:!!data.ready,readyRound:data.ready?raw.meta.round:0,ack:0,...(wire?{loadout:wire,name:wire.name,charKey:wire.charKey}:{})};});}
  else if(action==='ack')await timeout(mr.child('ack').set(raw.meta.round));
  else if(action==='leave'){if(uid===raw.meta.owner)await transaction(ref.child('meta'),v=>{if(!v)return;const closed={...v,phase:'closed'};delete closed.result;return closed;});else if(raw.meta.phase==='preparing')await timeout(mr.remove());else await timeout(mr.child('left').set(true));}
  else throw new Error('Неизвестное действие.');return{ok:true};
 },
 watch(id,cb,onError){hostStop=false;const ref=roomRef(id),pr=db.ref(P.NS+'/presence/'+id),info=db.ref('.info/connected'),connection=P.key(),own=pr.child(uid+'/'+connection);let latest=null,onlineMap={};
 const refreshPresence=()=>{const map={};for(const [u,conns]of Object.entries(onlineMap||{}))map[u]={online:Object.values(conns||{}).some(c=>c.online===true)};if(latest)for(const m of Object.values(latest.members||{}).filter(Boolean))if(!map[m.uid])map[m.uid]={online:false};N.presence=map;render();if(latest&&latest.meta.owner!==uid&&map[latest.meta.owner]?.online===false)status('Нет связи с организатором. Старт и новый раунд на паузе; сохранённый replay доступен. Ждём его возврат. Можно выйти и создать новую комнату.');};
 const value=s=>{const raw=s.val();if(!raw){cb(null);return;}latest=raw;latestRaw=raw;if(raw.meta.phase==='closed'){status('Организатор закрыл комнату. Создай новую.');cb(null);return;}try{cb(P.verify(raw));refreshPresence();pump(id,raw);}catch(e){onError(e);}};
 const pv=s=>{onlineMap=s.val()||{};refreshPresence();};
 const cv=async s=>{connected=s.val()===true;if(!connected){status('Связь потеряна. Комната и сборка сохранены; ждём reconnect.');return;}try{await own.onDisconnect().remove();await own.set({online:true,at:firebase.database.ServerValue.TIMESTAMP});status('Подключено · доверенный организатор · sandbox · Spark');if(latest)pump(id,latest);}catch(e){onError(e);}};
 ref.on('value',value,onError);pr.on('value',pv,onError);info.on('value',cv);const lost=auth.onAuthStateChanged(u=>{if(!u)onError({code:'auth-lost'});});
 return()=>{hostStop=true;ref.off('value',value);pr.off('value',pv);info.off('value',cv);lost();own.onDisconnect().cancel().then(()=>own.remove()).catch(()=>{});};
 }
 };
}

async function adapter(){if(N.adapter)return N.adapter;const a=window.__BACKPACK_V3_ADAPTER__?await window.__BACKPACK_V3_ADAPTER__():await firebaseAdapter();N.adapter=a;N.uid=a.uid;return a;}
async function action(fn){if(N.busy)return;N.busy=true;render();try{await fn();}catch(e){error(e);}finally{N.busy=false;render();}}
function saved(){try{return JSON.parse(localStorage.getItem('bb_backpuck_ef94b_room')||'null');}catch{return null;}}
function sandboxKey(){return 'bb_backpuck_ef94b_sandbox:'+N.roomId+':'+N.uid;}
function persistSandbox(){if(!N.roomId||!N.room)return;const old=JSON.parse(localStorage.getItem(sandboxKey())||'null');localStorage.setItem(sandboxKey(),JSON.stringify({paidThrough:old?.paidThrough||N.room.round,gold:state.gold,shop:state.shop,backpack:state.backpack}));}
function syncSandbox(round){let ledger;try{ledger=JSON.parse(localStorage.getItem(sandboxKey())||'null');}catch{}if(!ledger){ledger={paidThrough:1,gold:CHARACTERS[state.charKey].gold,shop:state.shop,backpack:state.backpack};}const changed=round>ledger.paidThrough;ledger.gold+=Math.max(0,round-ledger.paidThrough)*8;ledger.paidThrough=Math.max(round,ledger.paidThrough);state.gold=ledger.gold;state.shop=ledger.shop||[];state.backpack=ledger.backpack||[];if(changed){generateShop();ledger.shop=state.shop;notify('Новый PvP-раунд: +8 золота каждому (sandbox)','gold');}localStorage.setItem(sandboxKey(),JSON.stringify(ledger));renderShop();updateHUD();}
function remember(){localStorage.setItem('bb_backpuck_ef94b_room',JSON.stringify({roomId:N.roomId,token:N.token}));}
function stopReplay(){N.generation++;if(N.timer){clearTimeout(N.timer);N.timer=null;}battleRunning=false;node('battleOverlay').classList.remove('show');if(window.BattleScene)window.BattleScene.unmount();}
function attach(id,token){if(N.stop)N.stop();stopReplay();N.seen=null;N.roomId=id;N.token=token;remember();N.stop=N.adapter.watch(id,r=>{
 if(!r||!r.members?.[N.uid]){status('Ты вышел или комната закрыта. Можно создать новую.');detach(false);return;}
 N.room=r;state.name=r.members[N.uid].name;state.charKey=r.members[N.uid].charKey;state.round=r.round;syncSandbox(r.round);node('hudRound').textContent=r.round;
 const m=r.members[N.uid];if(m.loadout){state.backpack=Core.clone(m.loadout.backpack);state.baseHp=m.loadout.baseHp;uidCounter=Math.max(uidCounter,...state.backpack.map(p=>p.uid));}
 persistSandbox();renderBackpack();render();
 if(r.phase==='result'&&r.result&&N.seen!==r.round){N.seen=r.round;replay(r);}
 },e=>{error(e);});}
function detach(forget=true){if(N.stop)N.stop();N.stop=null;N.room=null;N.roomId=null;N.token=null;N.presence={};stopReplay();if(forget)localStorage.removeItem('bb_backpuck_ef94b_room');render();}
function shareLink(){const u=new URL(location.href);u.searchParams.delete('mock');u.hash=new URLSearchParams({room:N.roomId}).toString();return u.href;}
function render(){
 const room=N.room,m=room?.members[N.uid],locked=!!room&&(room.phase!=='preparing'||m?.ready||N.busy);panel.dataset.connected=room?'true':'false';panel.dataset.phase=room?.phase||'offline';
 for(const id of ['shopList','backpack','itemActions']){const el=node(id);if(el){el.style.pointerEvents=locked?'none':'';el.setAttribute('aria-disabled',String(locked));}}
 node('networkCreate').disabled=!!N.roomId||N.busy;node('networkJoin').disabled=!!N.roomId||N.busy;node('networkReconnect').disabled=N.busy;node('networkLeave').disabled=!N.roomId||N.busy;node('networkShare').disabled=!N.roomId;
 node('networkReady').disabled=!room||room.phase!=='preparing'||N.busy;node('networkReady').textContent=m?.ready?'Отменить готовность':'Готов · заморозить сборку';
 node('networkNext').disabled=!room||room.phase!=='result'||battleRunning||m?.ack===room.round||N.busy;
 node('battleBtn').textContent=room?(m?.ready?'Ждём готовность друзей':'Готов к PvP →'):'Тренировка с ботом →';node('battleBtn').disabled=!!room&&(room.phase!=='preparing'||m?.ready||N.busy);
 const box=node('opponentsList');box.replaceChildren();if(room){for(const [uid,p]of Object.entries(room.members)){const row=document.createElement('div');row.className='player-row';row.textContent=`${uid===N.uid?'Ты · ':''}${p.name} · ${p.ready?'Готов':'Собирает'} · ${N.presence[uid]?.online===false?'нет связи':'участник'}`;box.appendChild(row);}const r=document.createElement('p');r.textContent=`Приватная комната · ${Object.keys(room.members).length}/4 · раунд ${room.round}. ${room.phase==='result'?'Сборки заморожены. Общий результат сохранён.':room.phase==='battle'?'Сборки заморожены. Организатор публикует replay.':'2–4 участника, старт при готовности всех и присутствии организатора.'}`;box.appendChild(r);}else box.textContent='Офлайн-тренировка. Для друзей создай приватную комнату.';
 node('networkRoom').textContent=room?`Комната ${N.roomId.slice(0,8)} · ${Object.keys(room.members).length}/4 · ${room.owner===N.uid?'Ты организатор':'Организатор: '+room.members[room.owner]?.name}`:'Офлайн · вход не требуется';
 node('networkScores').replaceChildren();if(room?.result){for(const [uid,s]of Object.entries(room.result.scores)){const p=document.createElement('p');p.textContent=`${room.frozen[uid].name}: ${s.points}/${s.games} · нормированные очки ${(100*s.normalized).toFixed(0)}%`;node('networkScores').appendChild(p);}}
}
function isLocked(){return N.busy||!!N.room&&(N.room.phase!=='preparing'||N.room.members[N.uid]?.ready);}
// Capture blocks pointer AND keyboard mutations while ready/result; original functions stay intact.
for(const type of ['click','pointerdown','mousedown','touchstart','keydown'])document.addEventListener(type,e=>{if(isLocked()&&e.target.closest('#shopList,#backpack,#itemActions,#rerollBtn')){e.preventDefault();e.stopImmediatePropagation();}},true);
node('networkCreate').onclick=()=>action(async()=>{if(!state.name)throw new Error('Сначала введи имя и начни тренировку, чтобы собрать героя.');status('Вход Anonymous Auth…');const a=await adapter(),r=await a.call('create',{loadout:snapshot()});attach(r.roomId,r.token);status('Комната создана. Поделись полной ссылкой; в ней секрет приглашения.');});
function parseInvite(){const raw=node('networkInvite').value.trim();let p;try{const u=new URL(raw);p=new URLSearchParams(u.hash.slice(1));}catch{p=new URLSearchParams(raw.replace(/^#/,''));}const roomId=p.get('room');if(!/^[a-f0-9]{32}$/.test(roomId||''))throw new Error('Вставь полную ссылку-приглашение с room=…');return{roomId,token:roomId};}
node('networkJoin').onclick=()=>action(async()=>{if(!state.name)throw new Error('Сначала выбери героя и начни тренировку.');const v=parseInvite(),a=await adapter();await a.call('join',{...v,loadout:snapshot()});attach(v.roomId,v.token);status('Ты в комнате. Собери рюкзак и нажми «Готов».');});
node('networkReconnect').onclick=()=>action(async()=>{const v=saved();if(!v)throw new Error('Нет сохранённой комнаты. Вставь ссылку приглашения.');const a=await adapter();await a.call('join',{...v,loadout:snapshot()});attach(v.roomId,v.token);status('Комната восстановлена. Если шёл бой, доступен тот же replay.');});
node('networkReady').onclick=()=>action(async()=>{if(!N.room)throw new Error('Подключись к комнате.');await N.adapter.call('ready',{roomId:N.roomId,ready:!N.room.members[N.uid].ready,loadout:snapshot()});});
node('networkNext').onclick=()=>action(async()=>{await N.adapter.call('ack',{roomId:N.roomId});status('Продолжение подтверждено. Следующая сборка после подтверждения всех.');});
node('networkLeave').onclick=()=>action(async()=>{await N.adapter.call('leave',{roomId:N.roomId});detach();status('Вышел из комнаты. Тренировка доступна.');});
node('networkShare').onclick=async()=>{if(!N.roomId)return;const link=shareLink();node('networkInvite').value=link;try{await navigator.clipboard.writeText(link);status('Ссылка скопирована. Только для друзей; не публикуй её.');}catch{node('networkInvite').focus();node('networkInvite').select();status('Ссылка в поле. Скопируй её вручную.');}};
// PvP deliberately has no local reward/economy writes. Frozen replay is published by a trusted host; no trusted server.
function replay(room){
 stopReplay();const generation=N.generation;const own=room.result.matches.filter(x=>x.pair.includes(N.uid));let index=0;
 function play(){if(generation!==N.generation)return;const match=own[index],meIndex=match.pair.indexOf(N.uid),other=1-meIndex;
 const meLoad=room.frozen[N.uid].loadout,enemyLoad=room.frozen[match.pair[other]].loadout;
 const me=buildFighter(meLoad.name,meLoad.backpack,meLoad.baseHp,true,meLoad.charKey),enemy=buildFighter(enemyLoad.name,enemyLoad.backpack,enemyLoad.baseHp,false,enemyLoad.charKey),fighters=[me,enemy];
 battleRunning=true;node('battleOverlay').classList.add('show');node('battleTitle').textContent='PvP · ОБЩИЙ REPLAY · 1×';node('battleSub').textContent=`Раунд ${room.round} · дуэль ${index+1}/${own.length} · ${room.version} · seed ${match.seed}`;node('battleLog').replaceChildren();node('battleCloseBtn').disabled=true;node('battleCloseBtn').textContent='Бой идёт…';renderFighters(me,enemy);if(window.BattleScene)window.BattleScene.mount(node('battleStage'),me,enemy);
 let cursor=0;const log=[],speed=window.__BACKPACK_V3_REPLAY_FAST__?1000:1,startTime=performance.now();
 function apply(event){const actor=event.actor===meIndex?'me':'enemy';const name=room.frozen[match.pair[event.actor]].name;if(event.kind==='heal'){addLogLine(log,'heal',`${name}: +${event.amount} HP`);if(window.BattleScene)window.BattleScene.heal(actor,event.amount);}else{addLogLine(log,'dmg',`${name}: ${event.weapon} → ${event.amount}${event.crit?' КРИТ':''}`);if(window.BattleScene)window.BattleScene.attack(actor,{damage:event.amount,crit:event.crit,magic:event.magic,weapon:event.weapon});if(event.selfHeal){addLogLine(log,'heal',`${name}: вампиризм +${event.selfHeal} HP`);if(window.BattleScene)window.BattleScene.heal(actor,event.selfHeal);}if(event.thorn)addLogLine(log,'dmg',`${name}: шипы −${event.thorn} HP`);}me.hp=event.hp[meIndex];enemy.hp=event.hp[other];}
 function finish(){if(generation!==N.generation)return;me.hp=match.hp[meIndex];enemy.hp=match.hp[other];renderFighters(me,enemy);const result=match.winner<0?'draw':match.winner===meIndex?'win':'lose';addLogLine(log,'info',match.winner<0?'Ничья':`Победитель: ${room.frozen[match.pair[match.winner]].name}`);if(window.BattleScene)window.BattleScene.finish(result);battleRunning=false;node('battleTitle').textContent=result==='draw'?'НИЧЬЯ':result==='win'?'ПОБЕДА':'ПОРАЖЕНИЕ';node('battleCloseBtn').disabled=false;node('battleCloseBtn').textContent=index+1<own.length?'Следующая дуэль →':'Общие результаты →';render();}
 function schedule(){if(generation!==N.generation)return;const next=match.events[cursor];const tick=next?next.tick:match.duration;const delay=Math.max(0,tick*10/speed-(performance.now()-startTime));N.timer=setTimeout(()=>{if(generation!==N.generation)return;if(!next){finish();return;}while(cursor<match.events.length&&match.events[cursor].tick===tick)apply(match.events[cursor++]);renderFighters(me,enemy);schedule();},delay);}

 node('battleCloseBtn').onclick=()=>{if(++index<own.length)play();else{node('battleOverlay').classList.remove('show');if(window.BattleScene)window.BattleScene.unmount();render();}};schedule();
 }
 if(own.length)play();
}
const trainingBattle=startBattle;node('battleBtn').onclick=()=>{if(N.room)node('networkReady').click();else trainingBattle();};
node('leaveBtn').onclick=()=>{if(N.roomId)node('networkLeave').click();else location.reload();};
const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('room')){node('networkInvite').value=location.href;status('Приглашение найдено. Выбери героя, начни тренировку и нажми «Войти».');}
window.BackpackV3={Core,persistSandbox,network:N,connect:adapter,snapshot,attach,detach,isLocked,render,replay,shareLink};
// No automatic remote activity, including when a saved invitation exists.
render();
})();
