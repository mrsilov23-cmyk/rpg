const fs=require('fs'),assert=require('assert/strict');
const rules=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../database.rules.json'),'utf8'));
const room=rules.rules.backpack_spark_v4.rooms.$room;
const allowed=new Set(['val','child','parent','hasChild','hasChildren','exists','getPriority','isNumber','isString','isBoolean','matches','contains','beginsWith','endsWith','replace','toLowerCase','toUpperCase']);
let expressions=0;
function audit(x){for(const [k,v] of Object.entries(x)){if(k.startsWith('.')&&typeof v==='string'){expressions++;assert(!v.includes('numChildren'));for(const m of v.matchAll(/\.([A-Za-z_][\w]*)\s*\(/g))assert(allowed.has(m[1]),`Unsupported ${m[1]}`);new Function('data','newData','root','auth','now','$room','$slot','$match','$uid','$i','$event','$conn',`return (${v});`);}else if(v&&typeof v==='object')audit(v);}}audit(rules);
class Snap{
 constructor(tree,path=[]){this.tree=tree;this.path=path;}
 raw(){return this.path.reduce((x,k)=>x==null?null:x[k],this.tree)??null;}
 val(){const v=this.raw();if(v&&typeof v==='object')throw Error('Object val not permitted');return v;}
 child(p){return new Snap(this.tree,this.path.concat(String(p).split('/')));}
 parent(){return new Snap(this.tree,this.path.slice(0,-1));}
 exists(){return this.raw()!==null;}
 hasChild(p){return this.child(p).exists();}
 hasChildren(keys){let v=this.raw();return !!v&&typeof v==='object'&&(keys?keys.every(k=>this.hasChild(k)):Object.keys(v).length>0);}
 isNumber(){return typeof this.raw()==='number';}isString(){return typeof this.raw()==='string';}isBoolean(){return typeof this.raw()==='boolean';}
}
function evaluate(s,snap){return new Function('newData',`return (${s});`)(snap);}
let scenarios=0;
for(const slots of [[0,1],[0,2],[1,3],[0,1,2],[0,2,3],[0,1,2,3]]){
 const members=Object.fromEntries(slots.map(i=>[i,{uid:'u'+i}]));
 const matchCount=slots.length===3?3:slots.length===4?2:1;
 const tree={members,meta:{result:{matches:Object.fromEntries(Array.from({length:matchCount},(_,i)=>[i,{pair:{0:'u0',1:'u1'}}])),scores:Object.fromEntries(slots.map(i=>['u'+i,{points:1}]))}}};
 assert(evaluate(room.meta.result.matches['.validate'],new Snap(tree,['meta','result','matches'])));
 tree.meta.result.matches[matchCount]={};assert(!evaluate(room.meta.result.matches['.validate'],new Snap(tree,['meta','result','matches'])) || !/^[0-2]$/.test(String(matchCount)));delete tree.meta.result.matches[matchCount];
 assert(evaluate(room.meta.result.scores['.validate'],new Snap(tree,['meta','result','scores'])));
 for(const i of slots){let old=tree.meta.result.scores['u'+i];delete tree.meta.result.scores['u'+i];assert(!evaluate(room.meta.result.scores['.validate'],new Snap(tree,['meta','result','scores'])));tree.meta.result.scores['u'+i]=old;}
 scenarios++;
}
const slotsRegex=/^[0-3]$/;for(const key of ['4','5','-1','00','a'])assert(!slotsRegex.test(key));for(const k of ['0','1','2','3'])assert(slotsRegex.test(k));
assert(room.members.$slot['.validate'].includes('$slot.matches(/^[0-3]$/)'));
assert(room.meta.result.matches.$match.events.$event['.validate'].includes('[0-9]{0,3}'));
assert(room.members.$slot.loadout.backpack.$i['.validate'].includes('[12][0-9]'));
const two=room.meta.result.matches.$match.hp;
assert(evaluate(two['.validate'],new Snap({0:0,1:5})));assert(!evaluate(two['.validate'],new Snap({0:0})));assert.equal(two.$extra['.validate'],'false');
assert.equal(rules.rules['.read'],false);assert.equal(rules.rules['.write'],false);
assert(room.meta['.write'].includes("data.child('owner').val() === auth.uid"));
assert(rules.rules.backpack_spark_v4.presence.$room.$uid.$conn['.write'].includes('auth.uid === $uid'));
console.log(JSON.stringify({pass:true,expressionsAudited:expressions,slotAndMatchConfigurations:scenarios,checks:['supported method allowlist','JavaScript expression parsing','four-slot key range','2/3/4 players match shapes','scores completeness including sparse slots','two-value HP shape','bounded backpack/event keys','closed root and owner guards'],scope:'Local expression/static checks only; NOT Firebase compiler or emulator'},null,2));
