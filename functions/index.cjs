'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const crypto=require('node:crypto');
const Core=require('./core.cjs');
Core.configure(require('./items.json'),require('./characters.json'));
initializeApp();
const db=getDatabase(),ROOT='backpack_v3';
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const key=()=>crypto.randomBytes(16).toString('hex');
const callable=handler=>onCall({region:'europe-west1',timeoutSeconds:30,maxInstances:10,enforceAppCheck:process.env.BACKPACK_V3_ENFORCE_APP_CHECK==='true'},async req=>{
 if(!req.auth)throw new HttpsError('unauthenticated','Нужен вход Firebase Auth.');
 try{return await handler(req.auth.uid,req.data||{});}catch(e){if(e instanceof HttpsError)throw e;throw new HttpsError(e.code||'internal',e.code?e.message:'Ошибка сервера. Повтори позже.');}
});
async function throttle(uid,ms){const now=Date.now(),r=await db.ref(`${ROOT}/limits/${uid}`).transaction(v=>!v||now-v.last>=ms?{last:now}:undefined);if(!r.committed)throw new HttpsError('resource-exhausted','Слишком часто. Подожди секунду.');}
function roomId(v){if(typeof v!=='string'||! /^[a-f0-9]{32}$/.test(v))throw new HttpsError('invalid-argument','Неверный идентификатор комнаты.');return v;}
exports.backpackV3Create=callable(async(uid,data)=>{
 await throttle(uid,1000);const l=Core.loadout(data.loadout),id=key(),token=key(),now=Date.now();
 // At most one active owned room per UID. Atomic claim prevents parallel creates.
 const claim=db.ref(`${ROOT}/owned/${uid}`),r=await claim.transaction(v=>v&&v.expiresAt>now?undefined:{id,expiresAt:now+86400000});
 if(!r.committed)throw new HttpsError('already-exists',`У тебя уже есть комната. Вернись по сохранённой ссылке или выйди из неё.`);
 const room={owner:uid,inviteHash:hash(token),createdAt:now,expiresAt:now+86400000,phase:'preparing',round:1,revision:1,version:Core.VERSION,members:{[uid]:{name:l.name,charKey:l.charKey,ready:false,joinedAt:now}}};
 try{await db.ref(`${ROOT}/rooms/${id}`).set(room);}catch(e){await claim.remove();throw e;}
 return{roomId:id,token};
});
exports.backpackV3Command=callable(async(uid,data)=>{
 await throttle(uid,150);const id=roomId(data.roomId),ref=db.ref(`${ROOT}/rooms/${id}`),now=Date.now(),seed=crypto.randomBytes(4).readUInt32LE();
 const allowed=['join','ready','ack','leave'];if(!allowed.includes(data.action))throw new HttpsError('invalid-argument','Неизвестное действие.');
 if(data.action==='join'&&(typeof data.token!=='string'||! /^[a-f0-9]{32}$/.test(data.token)))throw new HttpsError('permission-denied','Нужна полная ссылка-приглашение.');
 let failure;
 const result=await ref.transaction(room=>{
  failure=null;
  try{if(data.action==='join'&&room&&room.inviteHash!==hash(data.token))throw new HttpsError('permission-denied','Ссылка-приглашение неверна.');return Core.command(room,uid,data.action,data,now,seed);}catch(e){failure=e;return undefined;}
 },undefined,false);
 if(!result.committed)throw failure||new HttpsError('aborted','Комната изменилась. Повтори действие.');
 if(data.action==='leave'){
  const claim=db.ref(`${ROOT}/owned/${uid}`);await claim.transaction(v=>v&&v.id===id?null:v);
  await db.ref(`${ROOT}/presence/${id}/${uid}`).remove();
 }
 return{ok:true};
});
exports.backpackV3Cleanup=onSchedule({region:'europe-west1',schedule:'every 60 minutes'},async()=>{
 const now=Date.now(),s=await db.ref(`${ROOT}/rooms`).orderByChild('expiresAt').endAt(now).limitToFirst(100).get(),updates={};s.forEach(c=>{updates[`rooms/${c.key}`]=null;updates[`presence/${c.key}`]=null;});if(Object.keys(updates).length)await db.ref(ROOT).update(updates);
 // owned/limits contain no room content; prune old keys separately in operations.
});
