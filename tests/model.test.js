import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DRAFT,clone,normalizeDraft,parseLength,formatLength,computeDraft,planFabric,migrateLegacyPreset,compareDrafts} from '../v3/model.js';
const sample=()=>({...clone(DEFAULT_DRAFT),waist:32,seat:40,depth:12,length:42,opening:8,fabricWidth:30});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('finished measurements keep the larger back and preserve waist and leg targets',()=>{
 const d=sample(),r=computeDraft(d);assert.equal(r.valid,true);
 near(2*(r.front.waist+r.back.waist),32);near(r.front.hem+r.back.hem,16);
 assert.ok(r.back.waist>r.front.waist);assert.ok(r.back.riseH>r.front.riseH);assert.ok(r.back.hem>r.front.hem);
 near(r.front.hem,7.2);near(r.back.hem,8.8);
});
test('waist and hem totals hold across sizes and front/back distributions',()=>{
 for(const waist of [26,32,42,54])for(const seat of [34,40,50,62])for(const frontShare of [.35,.45,.6]){
  const r=computeDraft({...sample(),waist,seat,frontShare});assert.equal(r.valid,true);
  near(2*(r.front.waist+r.back.waist),waist);near(2*(r.front.seat+r.back.seat),seat);
  near(r.front.hem+r.back.hem,16);near(r.front.knee+r.back.knee,17);
 }
});
test('point 1, point 2 and hem all retain the requested 45/55 finished split',()=>{
 const r=computeDraft(sample());
 near(r.front.knee,7.65);near(r.back.knee,9.35);
 near(r.front.calf,7.2);near(r.back.calf,8.8);
 near(r.front.hem,7.2);near(r.back.hem,8.8);
 const measured=computeDraft({...sample(),kneeWidth:10,calfWidth:9});
 near(measured.front.knee,9);near(measured.back.knee,11);
 near(measured.front.calf,8.1);near(measured.back.calf,9.9);
 for(const seamValue of [0.5,1]){
  const d=sample();d.seams.backOut=seamValue;
  const s=computeDraft(d);near(s.front.knee,7.65);near(s.back.knee,9.35);near(s.front.hem+s.back.hem,16);
 }
});
test('body ease and flat-pants measurements normalize independently',()=>{
 const r=computeDraft({...sample(),waist:16,waistFlat:true,seatSource:'body',seatEase:2});assert.equal(r.valid,true);near(r.W,32);near(r.H,42);
 const garment=computeDraft({...sample(),waistEase:4,seatEase:6});near(garment.W,32);near(garment.H,40);
});
test('band height is counted once for either total-length origin',()=>{
 for(const band of [0,1,1.5,2]){
  const r=computeDraft({...sample(),band});assert.equal(r.valid,true);near(r.panelLength+band,42);near(r.rise+r.leg,r.panelLength);near(r.leg,30);
  const b=computeDraft({...sample(),band,length:42-band,lengthOrigin:'below'});near(b.total,42);near(b.leg,r.leg);
 }
});
test('curved front rise never sets vertical depth',()=>{
 const a=computeDraft({...sample(),frontRise:12}),b=computeDraft({...sample(),frontRise:16});assert.deepEqual(a.rows,b.rows);
 const missing=computeDraft({...sample(),depth:null,frontRise:12});assert.equal(missing.valid,false);assert.ok(missing.errors.depth);
});
test('measured seat and knee replace proportions; sections still reach hem',()=>{
 const r=computeDraft({...sample(),hipDepth:8,kneeDistance:13,kneeWidth:10,calfWidth:9});assert.equal(r.valid,true);
 near(r.seatY,6.5);near(r.kneeY,13);near(r.kneeY+2*r.section2,r.leg);near(r.front.knee+r.back.knee,20);near(r.front.calf+r.back.calf,18);
});
test('incomplete, negative, inverted and non-finite inputs do not generate a draft',()=>{
 for(const d of [{waist:32},{...sample(),depth:0},{...sample(),length:5},{...sample(),depth:1},{...sample(),kneeDistance:99},{...sample(),hipDepth:1},{...sample(),waist:-1},{...sample(),depth:Infinity}])assert.equal(computeDraft(d).valid,false);
});
test('fabric checks the widest hem, including allowances',()=>{
 const d={...sample(),opening:20,fabricWidth:18},r=computeDraft(d),p=planFabric(r,d);
 assert.equal(r.valid,true);assert.equal(p.valid,false);assert.ok(p.neededWidth>22);
});
test('fabric pairs unequal front/back widths and uses at most two selvedges',()=>{
 const d=sample(),r=computeDraft(d),p=planFabric(r,d);assert.equal(p.valid,true);assert.equal(p.rows.length,2);
 for(const row of p.rows){assert.ok(row.length<=2);assert.ok(row.reduce((s,x)=>s+x.width,0)<=p.usableWidth);}
 const wide=planFabric(r,{...d,fabricWidth:100});assert.equal(wide.rows.length,2);
 const narrow=planFabric(r,{...d,fabricWidth:16});assert.equal(narrow.rows.length,4);
});
test('allowances and shrinkage affect cloth, without changing stitch targets',()=>{
 const d=sample(),r=computeDraft(d),p=planFabric(r,d);
 const changed={...d,seams:{...d.seams,inseam:1,hem:2}};const r2=computeDraft(changed),p2=planFabric(r2,changed);
 assert.deepEqual(r.rows,r2.rows);assert.ok(r2.back.cutWidth>r.back.cutWidth);assert.ok(p2.buyLength>p.buyLength);
 const sh=planFabric(r,{...d,shrinkLength:10,shrinkWidth:5});assert.equal(sh.valid,true);near(sh.usableWidth,28.5);assert.ok(sh.buyLength>p.buyLength);
 near(sh.meters,sh.buyLength*.0254);
});
test('old presets preserve curved rise, but require actual vertical depth',()=>{
 const d=migrateLegacyPreset({waist:32,seat:40,rise:12,waistbandwidth:1.5,legOpening:8,totalLength:42});near(d.frontRise,12);assert.equal(d.depth,null);assert.equal(computeDraft(d).valid,false);
});
test('decimal, fraction, unicode and cm inputs retain precision; invalid fractions fail',()=>{
 near(parseLength('8 1/2').value,8.5);near(parseLength('⅝″').value,.625);near(parseLength('1½').value,1.5);near(parseLength('20.32','cm').value,8);
 for(const s of ['1/0','7abc','NaN','Infinity','1/2/3'])assert.ok(parseLength(s).error);
 assert.equal(formatLength(.125,'in',true),'1/8″');assert.equal(formatLength(2.5,'in',true),'2 1/2″');
});
test('comparison calculates both panel changes from current values',()=>{
 const a=computeDraft(sample()),b=computeDraft({...sample(),opening:9});const rows=compareDrafts(a,b),hem=rows.find(r=>r.key==='hem');near(hem.df,-.9);near(hem.db,-1.1);
});
test('normalization whitelists data and never shares default seam objects',()=>{
 const d=normalizeDraft(JSON.parse('{"__proto__":{"polluted":true},"waist":32,"notes":"hi"}'));assert.equal({}.polluted,undefined);assert.equal(d.waist,32);d.seams.hem=99;assert.equal(DEFAULT_DRAFT.seams.hem,1);
});

