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
