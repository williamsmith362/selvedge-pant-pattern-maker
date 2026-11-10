import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DRAFT,computeDraft,planFabric,parseLength,normalizeDraft} from '../v3/model.js';
import {layoutView} from '../v3/layout-view.js';
const sample=overrides=>({...structuredClone(DEFAULT_DRAFT),waist:32,seat:40,depth:12,length:42,opening:8,fabricWidth:30,...overrides});
const plan=d=>planFabric(computeDraft(d),d);
test('30-inch fabric fits four panels in two rows, with allowances and reserve',()=>{
 const p=plan(sample());
 assert.equal(p.valid,true);assert.equal(p.rows.length,2);assert.equal(p.panelCloth,84);assert.equal(p.buyLength,96);assert.equal(p.yards,96/36);
 assert.equal(p.rows.flat().length,4);
 for(const row of p.rows){assert.ok(row.length<=2);assert.ok(row.reduce((sum,p)=>sum+p.width,0)<=p.usableWidth);}
});
test('wide fabric still uses at most two selvedge edges per row',()=>{
 const p=plan(sample({fabricWidth:60,extraLength:0}));assert.equal(p.rows.length,2);assert.equal(p.buyLength,84);
});
test('width and length shrinkage both affect purchase length',()=>{
 const p=plan(sample({shrinkWidth:10,shrinkLength:5}));assert.equal(p.usableWidth,27);assert.equal(p.rows.length,3);assert.ok(Math.abs(p.buyLength-138/.95)<1e-9);
});
test('narrow fabric reports the required width instead of a misleading measurement error',()=>{
 const d=sample({fabricWidth:15}),r=computeDraft(d),p=planFabric(r,d);assert.equal(r.valid,true);assert.equal(p.valid,false);assert.equal(p.neededWidth,15.625);assert.equal(p.usableWidth,15);
});
test('fabric validation does not invalidate a completed pant draft',()=>{
 for(const [key,value] of [['fabricWidth',0],['fabricWidth',-1],['extraLength',-1],['shrinkWidth',50],['shrinkLength',-1]]){
  const d=sample({[key]:value}),r=computeDraft(d),p=planFabric(r,d);assert.equal(r.valid,true);assert.equal(p.valid,false);assert.ok(p.errors[key]);
 }
});
test('missing measurements and missing fabric width have distinct recovery states',()=>{
 assert.equal(plan({...structuredClone(DEFAULT_DRAFT),fabricWidth:30}).needsDraft,true);
 const p=plan(sample({fabricWidth:null}));assert.equal(p.needsDraft,undefined);assert.ok(p.errors.fabricWidth);
});
test('centimetres and fractional inputs produce the same physical plan',()=>{
 const width=parseLength('76.2','cm');const d=sample({fabricWidth:width.value,seams:{...DEFAULT_DRAFT.seams,inseam:parseLength('5/8').value}});assert.equal(plan(d).buyLength,96);
});
test('changing garment length refreshes the fabric estimate',()=>{
 assert.equal(plan(sample({length:44})).buyLength,100);
});

test('regular 60- and 65-inch fabric fits all four panels in one length',()=>{
 for(const fabricWidth of [60,65]){
  const d=sample({fabricType:'regular',fabricWidth}),r=computeDraft(d),p=planFabric(r,d);
  assert.equal(p.rows.length,1);assert.equal(p.rows[0].length,4);
  assert.equal(p.panelCloth,42);assert.equal(p.buyLength,54);assert.equal(p.yards,1.5);
 }
});

test('the same wide cloth keeps two rows when selvedge edges are required',()=>{
 const regular=sample({fabricType:'regular',fabricWidth:65});
 const selvedge={...regular,fabricType:'selvedge'};
 assert.equal(planFabric(computeDraft(regular),regular).rows.length,1);
 const p=planFabric(computeDraft(selvedge),selvedge);assert.equal(p.rows.length,2);assert.equal(p.panelCloth,84);
 assert.ok(p.rows.every(row=>row.length<=2));
});

test('the user’s 44.5-inch panels use one length on wide regular fabric',()=>{
 const d=sample({fabricType:'regular',fabricWidth:65,length:44.5}),r=computeDraft(d),p=planFabric(r,d);
 assert.equal(r.cutLength,44.5);assert.equal(p.panelCloth,44.5);assert.equal(p.buyLength,56.5);
 assert.ok(Math.abs(p.yards-56.5/36)<1e-10);
});

test('regular layout uses three across or two rows only when widths require it',()=>{
 const d=sample({fabricType:'regular',fabricWidth:45}),p=planFabric(computeDraft(d),d);
 assert.equal(p.rows.length,2);assert.equal(Math.max(...p.rows.map(row=>row.length)),3);
 assert.ok(p.rows.every(row=>row.reduce((sum,piece)=>sum+piece.width,0)<=p.usableWidth));
 assert.deepEqual(p.rows.flat().map(p=>p.panel+'-'+p.copy).sort(),['back-1','back-2','front-1','front-2']);
});

test('four-across boundary includes every cutting allowance',()=>{
 const d=sample({fabricType:'regular',fabricWidth:65}),r=computeDraft(d);
 const needed=2*(r.front.cutWidth+r.back.cutWidth);
 assert.equal(planFabric(r,{...d,fabricWidth:needed}).rows.length,1);
 assert.equal(planFabric(r,{...d,fabricWidth:needed-.001}).rows.length,2);
 const larger={...d,seams:{...d.seams,frontOut:3,backOut:3}};
 assert.equal(planFabric(computeDraft(larger),larger).rows.length,2);
});

test('regular fabric shrinkage can change four across into two rows',()=>{
 const d=sample({fabricType:'regular',fabricWidth:65,shrinkWidth:10,shrinkLength:5});
 const p=planFabric(computeDraft(d),d);assert.equal(p.rows.length,1);assert.ok(Math.abs(p.buyLength-54/.95)<1e-10);
 const narrower={...d,shrinkWidth:15};const n=planFabric(computeDraft(narrower),narrower);
 assert.equal(n.rows.length,2);assert.ok(Math.abs(n.buyLength-96/.95)<1e-10);
});

test('fabric choice survives a saved-draft and backup JSON round trip',()=>{
 const draft=normalizeDraft(JSON.parse(JSON.stringify(sample({fabricType:'regular'}))));
 assert.equal(draft.fabricType,'regular');assert.equal(normalizeDraft({}).fabricType,'selvedge');assert.equal(normalizeDraft({fabricType:'unknown'}).fabricType,'selvedge');
});
test('fabric layout contains four unique curved panels in either mode',()=>{
 for(const fabricType of ['regular','selvedge']){
  const d=sample({fabricType,fabricWidth:65}),r=computeDraft(d),p=planFabric(r,d),svg=layoutView(r,p,d);
  assert.equal((svg.match(/class="layout-panel"/g)||[]).length,4);assert.equal((svg.match(/class="layout-outline"/g)||[]).length,4);assert.match(svg,/ C /);assert.doesNotMatch(svg,/NaN|Infinity/);
  assert.match(svg,new RegExp(`in ${p.rows.length} row`));
 }
 assert.equal(layoutView({valid:false},{valid:false},{}),'');
});
test('wide waists reserve the full shaped panel span',()=>{
 const d=sample({waist:60}),r=computeDraft(d);assert.ok(r.valid);
 for(const [side,out,inside]of [['front',d.seams.frontOut,Math.max(d.seams.inseam,d.seams.frontStraight,d.seams.frontCurve)],['back',d.seams.backOut,d.seams.inseam]]){
  const v=r[side],min=Math.min(0,v.seat-v.offset-v.waist),max=Math.max(v.seat-v.offset,v.seat,v.riseH,v.knee,v.calf,v.hem);
  assert.ok(v.cutWidth>=max-min+out+inside-1e-10);
 }
});
