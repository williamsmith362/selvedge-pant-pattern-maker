import {patternView} from './pattern-view.js';
import {layoutView} from './layout-view.js';
import {DEFAULT_DRAFT,clone,normalizeDraft,parseLength,formatNumber,formatLength,computeDraft,planFabric,migrateLegacyPreset,compareDrafts} from './model.js';

const $=id=>document.getElementById(id);
const KEY='sp_workspace_v2';
const FABRIC_KEYS=new Set(['fabricWidth','extraLength','shrinkLength','shrinkWidth']);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||`draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inputErrors=new Map(),touched=new Set(),fieldKinds=new Map();
let saveTimer,toastTimer,storageAvailable=true,result;
let otherTabChanged=false;
const MAX_PROFILES=200;
function readStored(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function getLegacy(){return {presets:readStored('sp_presets',{}),notes:readStored('sp_notes',{}),history:readStored('sp_history',[])};}
function cleanProfiles(profiles){return profiles.slice(0,200).filter(p=>p&&typeof p.name==='string'&&p.draft&&typeof p.draft==='object').map(p=>({id:uid(),name:p.name.slice(0,100),draft:normalizeDraft(p.draft),updatedAt:typeof p.updatedAt==='string'?p.updatedAt:new Date().toISOString()}));}
function initialState(){
  const saved=readStored(KEY,null);
  if(saved?.version===2 && saved.draft && Array.isArray(saved.profiles)){
    const profiles=saved.profiles.slice(0,200).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.draft).map(p=>({id:p.id,name:p.name.slice(0,100),draft:normalizeDraft(p.draft),updatedAt:p.updatedAt}));
    return {version:2,draft:normalizeDraft(saved.draft),profiles,activeId:profiles.some(p=>p.id===saved.activeId)?saved.activeId:null,comparisonId:profiles.some(p=>p.id===saved.comparisonId)?saved.comparisonId:null,unit:saved.unit==='cm'?'cm':'in',fractions:!!saved.fractions,pendingInputs:saved.pendingInputs&&typeof saved.pendingInputs==='object'?saved.pendingInputs:{},theme:document.documentElement.dataset.theme||'parchment'};
  }
  const legacy=getLegacy(),profiles=[];
  if(legacy.presets&&typeof legacy.presets==='object')for(const [name,p] of Object.entries(legacy.presets).slice(0,200))if(p&&typeof p==='object') profiles.push({id:uid(),name:name.slice(0,100),draft:migrateLegacyPreset(p),updatedAt:new Date().toISOString()});
  const d=normalizeDraft();
  d.notes=[legacy.notes?.front&&`Front: ${legacy.notes.front}`,legacy.notes?.back&&`Back: ${legacy.notes.back}`].filter(Boolean).join('\n\n');
  const oldTheme=document.documentElement.dataset.theme;
  return {version:2,draft:d,profiles,activeId:null,comparisonId:null,unit:'in',fractions:false,theme:oldTheme==='indigo'?'indigo':oldTheme==='midnight'?'midnight':'parchment'};
}
let state=initialState();
function persist(){
 clearTimeout(saveTimer);
 if(otherTabChanged){$('saveState').textContent='Changed in another tab';return;}
 state.pendingInputs=Object.fromEntries([...inputErrors].filter(([k])=>fieldKinds.has(k)&&!$(domId(k)).disabled).map(([k])=>[k,$(domId(k)).value.slice(0,100)]));
 try{localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;if($('saveState').textContent!==' Saved on this device')$('saveState').innerHTML='<i></i> Saved on this device';}catch{storageAvailable=false;$('saveState').textContent='Storage unavailable · Export a backup';}
}
function scheduleSave(){if(!otherTabChanged&&$('saveState').textContent!=='Saving…')$('saveState').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function getValue(key){return key.startsWith('seams.')?state.draft.seams[key.slice(6)]:state.draft[key];}
function setValue(key,value){if(key.startsWith('seams.'))state.draft.seams[key.slice(6)]=value;else state.draft[key]=value;}
const domId=key=>key.replaceAll('.','_');
const fieldDefinitions={
 mainFields:[
  ['waist','Waist','', 'circumference'],['seat','Full seat','', 'circumference'],
  ['band','Band height','Finished waistband height.'],['depth','Vertical crotch depth','Top of waistband straight down to crotch level.'],
  ['length','Total length','', 'lengthOrigin'],['opening','Flat hem opening','One hem, measured flat.']
 ],
 fitFields:[
  ['waistEase','Body waist ease','Added only when waist source is Body.'],['seatEase','Body seat ease','Added only when seat source is Body.'],
  ['frontRise','Curved front rise','Optional target along the front stitching seam, from the top of the band. Not vertical depth.'],
  ['hipDepth','Waist to full seat','Optional. Straight down from top of band to full-seat level.'],
  ['depthDrop','Extra crotch drop','Added to vertical depth. Keep 0 for a finished-pants depth.'],
  ['kneeDistance','Crotch to knee','Optional vertical distance. Blank uses 40% of the leg.'],
  ['kneeWidth','Flat knee width','Optional finished target. Blank uses hem + ½″.'],
  ['calfWidth','Flat point 2 width','Optional finished target, halfway from knee to hem. Blank uses hem width.']
 ],
 proportionFields:[
  ['frontShare','Front share of leg','Back receives the remainder. Your default is 45% front / 55% back.','ratio'],
  ['waistBalance','Back waist advantage','Back panel exceeds front by this amount; total waist stays unchanged.'],
  ['seatRatio','Seat height proportion','Used only when waist-to-seat is blank. Default 75% of panel crotch depth.','ratio'],
  ['forkDeduction','Fork formula deduction','Q = finished seat ÷ 8 − this value. Front extension Q/2; back extension Q.']
 ],
 fabricFields:[['fabricWidth','Fabric width','Selvedge: measure the full edge-to-edge width. Regular: enter the usable width after excluding unusable edges. Measure unfolded, across the full cloth.'],['extraLength','Extra fabric','Extra length for the waistband, pockets, fly, belt loops and layout adjustments. Start with 12 inches and increase it for your design. Use 0 for leg panels only.']],
 shrinkFields:[['shrinkLength','Length shrinkage','Before cutting. Use 0 for prewashed cloth.','percent'],['shrinkWidth','Width shrinkage','Before cutting. Use your fabric’s tested rate.','percent']],
 seamFields:[
  ['seams.inseam','Flat-felled allowance','Inseam, yoke and back crotch reference.'],['seams.waist','Waist attachment','Top edge allowance.'],
  ['seams.frontOut','Front outseam','Default ½″ from the selvedge stitching line.'],['seams.backOut','Back outseam','Default ½″. Change to suit your seam method.'],
  ['seams.frontStraight','Front rise · straight','Straight part of the front crotch seam.'],['seams.frontCurve','Front rise · curved','Curved part of the front crotch seam.'],
  ['seams.hem','Hem turn-up','Total cloth beyond the finished hem.']
 ]
};
for(const [container,definitions]of Object.entries(fieldDefinitions)){
 $(container).innerHTML=definitions.map(([key,label,help,kind='length'])=>{
   const id=domId(key);fieldKinds.set(key,kind);
   let extra='';
   if(kind==='circumference')extra=`<div class="field-options"><select id="${key}Mode" data-measurement="${key}" aria-label="${label} measurement type"><option value="garment-around">Pants · around</option><option value="garment-flat">Pants · flat ×2</option><option value="body-around">Body · around</option></select><input id="${key}Source" type="hidden" value="garment"><input id="${key}Flat" type="hidden" value="false"></div><span class="target-note" id="${key}Target"></span>`;
   if(kind==='lengthOrigin')extra='<select class="under-select" id="lengthOrigin" data-field="lengthOrigin" aria-label="Total length starts at"><option value="top">Includes band</option><option value="below">Below band</option></select>';
   return `<div class="field"><label for="${id}">${label}<span class="${['ratio','percent'].includes(kind)?'':'input-unit'}">${['ratio','percent'].includes(kind)?'%':state.unit}</span></label><input id="${id}" data-field="${key}" inputmode="decimal" type="text" autocomplete="off" aria-describedby="${id}Help ${id}Error" placeholder="${['waist','seat','depth','length','opening'].includes(key)?({waist:32,seat:40,depth:12,length:42,opening:8}[key]):'—'}">${extra}<span class="field-help" id="${id}Help">${help}</span><span class="field-error" id="${id}Error"></span></div>`;
 }).join('');
}
function syncInputs(){
 for(const [key,kind]of fieldKinds){const v=getValue(key);$(domId(key)).value=kind==='ratio'?(v===null?'':Number((v*100).toFixed(4))):kind==='percent'?(v??''):formatNumber(v,state.unit);}
 for(const [key,value]of Object.entries({waist:32,seat:40,depth:12,length:42,opening:8}))$(key).placeholder=formatNumber(value,state.unit);
 for(const key of ['waistSource','seatSource','waistFlat','seatFlat','lengthOrigin'])$(key).value=String(state.draft[key]);
 $('draftNotes').value=state.draft.notes;$('fractionToggle').checked=state.fractions;
 document.dispatchEvent(new CustomEvent('appearance:apply',{detail:state.theme}));
 document.querySelectorAll('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===state.unit)));
 document.querySelectorAll('.input-unit').forEach(e=>e.textContent=state.unit);
 updateFabricType();updateSources();
 for(const [key,raw]of Object.entries(state.pendingInputs||{})){
  if(!fieldKinds.has(key)||typeof raw!=='string'||raw.length>100||$(domId(key)).disabled)continue;
  const parsed=parseLength(raw,['ratio','percent'].includes(fieldKinds.get(key))?'in':state.unit);
  if(parsed.error||parsed.value===null){$(domId(key)).value=raw;inputErrors.set(key,parsed.error||'Enter a value; use 0 if none.');touched.add(key);}
 }
}
function updateFabricType(){
 document.querySelectorAll('[data-fabric-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fabricType===state.draft.fabricType)));
 $('fabricTypeNote').textContent=state.draft.fabricType==='regular'?'Fit up to four panels across the usable width.':'Outseams stay on the selvedges.';
}
document.querySelectorAll('[data-fabric-type]').forEach(button=>button.addEventListener('click',()=>{
 if(state.draft.fabricType===button.dataset.fabricType)return;
 state.draft.fabricType=button.dataset.fabricType;updateFabricType();render();persist();
}));
function updateSources(){for(const k of ['waist','seat']){const body=state.draft[`${k}Source`]==='body';$(k+'Mode').value=body?'body-around':state.draft[`${k}Flat`]?'garment-flat':'garment-around';$(k+'Source').value=state.draft[`${k}Source`];$(k+'Flat').value=String(state.draft[`${k}Flat`]);$(k+'Ease').disabled=!body;}}
function renderProfiles(){
 for(const [id,blank,value]of [['profileSelect','Unsaved draft',state.activeId],['compareSelect','Choose a saved draft',state.comparisonId]]){
  const select=$(id);select.replaceChildren(new Option(blank,''));
  for(const p of state.profiles)select.add(new Option(p.name,p.id));select.value=value||'';
 }
}
const fl=value=>formatLength(value,state.unit,state.fractions);
function render(){
 result=computeDraft(state.draft);
 const draftErrors=Object.fromEntries([...inputErrors].filter(([k])=>!FABRIC_KEYS.has(k)&&!$(domId(k)).disabled));
 if(Object.keys(draftErrors).length)result={valid:false,errors:{...result.errors,...draftErrors},notices:[]};
 const allErrors={...result.errors,...fabricStatus().errors,...Object.fromEntries(inputErrors)};
 for(const [key]of fieldKinds){const e=$(domId(key)),error=allErrors[key];const show=!e.disabled&&error&&(touched.has(key)||getValue(key)!==null);e.setAttribute('aria-invalid',String(!!show));$(domId(key)+'Error').textContent=show?error:'';}
 for(const k of ['waist','seat']){
  const d=state.draft,raw=d[k],ease=d[`${k}Source`]==='body'?d[`${k}Ease`]:0;
  $(k+'Target').textContent=raw>0?`Target ${fl(raw*(d[`${k}Flat`]?2:1)+ease)} around${ease?` · +${fl(ease)} ease`:''}`:'';
 }
 $('copyDraft').disabled=!result.valid;
 let appendix=$('printAppendix');if(!appendix){appendix=document.createElement('div');appendix.id='printAppendix';appendix.className='print-only';$('draft').append(appendix);}
 appendix.innerHTML=result.valid?`<h3>Cutting allowances</h3><p>${fieldDefinitions.seamFields.map(([k,label])=>`${escapeHTML(label)}: ${fl(getValue(k))}`).join(' · ')}</p>${state.draft.frontRise!==null?`<p>Curved front-rise target: ${fl(state.draft.frontRise)}. Check on the drawn stitching curve.</p>`:''}<p>Finished total length: ${fl(result.total)} · Band height: ${fl(state.draft.band)}</p><p style="white-space:pre-wrap">${escapeHTML(state.draft.notes)}</p>`:'';
 $('notesIndicator').textContent=state.draft.notes?'Saved with this draft':'Optional';
 if(!result.valid){
  const keys=Object.keys(result.errors),key=keys[0];
  const target=key?.startsWith('seams.')?3:['waist','seat','band','depth','length','opening'].includes(key)?0:1;
  $('results').innerHTML=`<div class="empty-draft"><h3>${state.draft.waist===null?'Start with your measurements.':'One thing to check.'}</h3><p>${escapeHTML(result.errors[key]||'Complete your measurements to see the pattern.')}</p><button class="text-button" type="button" data-recover="${target}" data-error-field="${escapeHTML(key||'waist')}">Check ${target===3?'allowances':target===1?'fit':'measurements'} <span aria-hidden="true">→</span></button></div>`;
 }else{
  const share=Math.round(state.draft.frontShare*100);
  $('results').innerHTML=`<div class="draft-summary"><div><small>Waist target</small><strong>${fl(result.W)}</strong></div><div><small>Seat target</small><strong>${fl(result.H)}</strong></div><div><small>Leg split · F / B</small><strong>${share} / ${100-share}</strong></div></div><details class="pattern-preview"><summary>View pattern <span>Front &amp; back</span></summary><figure class="draft-visual">${patternView(result)}<figcaption>Reduced drafting reference. Shape and fit your pattern before cutting.</figcaption></figure></details><table class="measure-table"><caption>Per panel · add cutting allowances separately</caption><thead><tr><th scope="col">Measurement</th><th scope="col">Front</th><th scope="col">Back</th></tr></thead><tbody>${result.rows.map((r,i)=>`<tr class="${i===7?'group-start ':''}${r.key==='hem'?'highlight':''}"><td>${r.label}</td><td>${fl(r.f)}</td><td>${fl(r.b)}</td></tr>`).join('')}</tbody></table><p class="table-note">${state.draft.hipDepth===null?'Seat height is estimated. ':''}${state.draft.kneeDistance===null||state.draft.kneeWidth===null?'Knee uses starting proportions. ':''}${state.draft.frontRise!==null?`Curved front-rise target: ${fl(state.draft.frontRise)}; check it on your drawn seam. `:''}${state.draft.seams.frontOut===0||state.draft.seams.backOut===0?'Zero outseam allowance: confirm the selvedge stitching position.':''}</p>`;
 }
 $("draftReference").innerHTML='<p class="table-note">Lengths below the crotch are consecutive vertical sections. The sketch is a reference map, not a scaled cutting pattern. Waist widths are allocations to true along your shaped waist edge.</p>';
 renderFormulas();renderComparison();renderFabric();
}
function renderFormulas(){
 const d=state.draft;
 $('formulaNotes').innerHTML=`<p><strong>Measurement convention.</strong> Waist and seat are converted to full circumferences. Finished-pants inputs get no added ease. Body inputs receive only their selected ease.</p><p><code>Panel height = finished total length − band height</code><br><code>Crotch level = vertical depth + drop − band height</code><br><code>Leg span = panel height − crotch level</code></p><p><code>Front waist = waist target / 4 − back advantage / 2</code><br><code>Back waist = waist target / 4 + back advantage / 2</code><br>The two fronts plus two backs total your waist target before manual shaping.</p><p><code>Base seat width = seat target / 4</code><br><code>Q = seat target / 8 − deduction</code><br><code>Front crotch width = seat width + Q/2</code><br><code>Back crotch width = seat width + Q</code><br><code>Back seat offset reference = Q/4</code><br>Offset is a construction reference; confirm how it is used when shaping your back curve.</p><p><code>Front leg width = circumference × ${Number((d.frontShare*100).toFixed(2))}%</code><br><code>Back leg width = circumference × ${Number(((1-d.frontShare)*100).toFixed(2))}%</code><br>The split preserves each selected circumference. Blank knee uses flat hem + ½″; blank point 2 uses hem width.</p><p>Without measured positions: seat level is ${Number((d.seatRatio*100).toFixed(2))}% of panel crotch depth; knee is 40% of the leg span. Point 2 is halfway from knee to hem.</p><p>Front-rise seam length is a curved target and is never converted into vertical depth. The preview illustrates shaping. Check the crotch seam length, darts or yoke shaping, and matching seam lengths on your drawn pattern.</p><p><a href="https://pubs.nmsu.edu/_c/C227/index.html" target="_blank" rel="noopener">Measurement reference: crotch depth vs. crotch length ↗</a></p>`;
}
function renderComparison(){
 const p=state.profiles.find(p=>p.id===state.comparisonId);
 if(!p){$('comparison').innerHTML='<p class="compare-note">Save a draft, then choose it here to compare both panels.</p>';return;}
 const other=computeDraft(p.draft);
 if(!result.valid||!other.valid){$('comparison').innerHTML='<p class="compare-note">Both drafts need valid measurements. Imported old presets need a vertical crotch depth before comparison.</p>';return;}
 const delta=x=>x===null?'—':`${Math.abs(x)<0.00001?'':x>0?'+':'−'}${fl(Math.abs(x))}`;
 $('comparison').innerHTML=`<p class="compare-note">Current minus ${escapeHTML(p.name)}. Updates as you measure.</p><table class="measure-table compare-table"><thead><tr><th scope="col">Difference</th><th scope="col">Front Δ</th><th scope="col">Back Δ</th></tr></thead><tbody>${compareDrafts(result,other).map(r=>`<tr><td>${r.label}</td><td class="${r.df>0?'positive':r.df<0?'negative':''}">${delta(r.df)}</td><td class="${r.db>0?'positive':r.db<0?'negative':''}">${delta(r.db)}</td></tr>`).join('')}</tbody></table>`;
}
function fabricStatus(){
 const plan=planFabric(result,state.draft);
 if(plan.needsDraft)return plan;
 const rawErrors=Object.fromEntries([...inputErrors].filter(([k])=>FABRIC_KEYS.has(k)));
 if(Object.keys(rawErrors).length)return {valid:false,errors:{...plan.errors,...rawErrors},reason:Object.values(rawErrors)[0]};
 return plan;
}
function renderFabric(){
 const plan=fabricStatus();
 if(plan.needsDraft){
  const allowanceError=Object.keys(result.errors||{}).some(k=>k.startsWith('seams.'));
  const measureKeys=['waist','seat','band','depth','length','opening'];
  const measureError=Object.keys(result.errors||{}).some(k=>measureKeys.includes(k));
  const target=allowanceError?3:measureError?0:1;
  $('fabricResult').innerHTML=`<div class="fabric-empty"><h3>${allowanceError?'Check your allowances.':measureError?'Start with your measurements.':'Check your fit values.'}</h3><p>${allowanceError?'One of your cutting allowances needs a correction.':measureError?'The estimate uses the front and back panels from your draft.':'A fit setting needs a correction before the fabric estimate can update.'}</p><button type="button" class="text-button" data-goto="${target}" ${allowanceError?'data-open="seamFields"':''}>${allowanceError?'Check allowances':measureError?'Go to Measure':'Check fit'} <span aria-hidden="true">↗</span></button></div>`;
  return;
 }
 if(!plan.valid){
  const missing=state.draft.fabricWidth===null&&!inputErrors.has('fabricWidth');
  $('fabricResult').innerHTML=`<div class="fabric-empty ${plan.neededWidth?'warning':''}" role="status"><h3>${plan.neededWidth?'Your fabric is too narrow.':missing?'One last measurement.':'Check the values above.'}</h3><p>${missing?'Enter the full width of your fabric to see the estimate.':escapeHTML(plan.reason)}</p>${plan.neededWidth?`<p class="fabric-width-note">Usable width ${fl(plan.usableWidth)}. Widest panel ${fl(plan.neededWidth)}.</p>`:''}</div>`;
  return;
 }
 const yards=(Math.ceil((plan.yards-1e-10)*100)/100).toFixed(2);
 const meters=(Math.ceil((plan.meters-1e-10)*100)/100).toFixed(2);
 const primary=state.unit==='cm'?meters:yards,unit=state.unit==='cm'?'m':'yd';
 const layoutOpen=$('fabricResult').querySelector('.layout-details')?.open??true;
 const rowCount=plan.rows.length,rowWord=rowCount===1?'row':'rows';
 const rowSummary=plan.fabricType==='selvedge'?`Selvedge · ${rowCount} ${rowWord}.`:rowCount===1?'All 4 panels fit across.':`4 panels arranged in ${rowCount} rows.`;
 $('fabricResult').innerHTML=`<div class="fabric-estimate"><p class="fabric-caption">ESTIMATED FABRIC</p><div class="fabric-total"><strong>${primary}<small> ${unit}</small></strong><span>${state.unit==='cm'?yards+' yd':meters+' m'}</span></div><p class="estimate-note">${rowSummary} Includes allowances and extra fabric.</p><dl class="calc-facts"><div><dt>Fabric for legs</dt><dd>${fl(plan.panelCloth)}<small>${rowCount} × ${fl(result.cutLength)}</small></dd></div><div><dt>Extra fabric</dt><dd>${fl(state.draft.extraLength)}</dd></div><div><dt>Usable width</dt><dd>${fl(plan.usableWidth)}</dd></div></dl><details class="layout-details" ${layoutOpen?'open':''}><summary>Cutting layout <span>${Math.max(...plan.rows.map(row=>row.length))} across · ${rowCount} ${rowWord}</span></summary><figure class="layout-figure">${layoutView(result,plan,state.draft,state.unit,state.fractions)}<figcaption>Single layer · Grain runs lengthwise${state.draft.shrinkLength||state.draft.shrinkWidth?' · After shrinkage':''}</figcaption></figure><p class="layout-caption">${rowCount} ${rowWord} × ${fl(result.cutLength)} = ${fl(plan.panelCloth)} for legs.${state.draft.fabricType==='regular'&&rowCount>1?` All four need ${fl(plan.fourAcrossWidth)} of usable width.`:''}</p></details></div><p class="fabric-detail">${plan.fabricType==='selvedge'?'Selvedge places at most two panels per row, one on each original fabric edge.':'Regular fabric fits as many of the four panels across the usable width as their cutting widths allow.'} Widths include your cutting allowances. Each front needs ${fl(result.front.cutWidth)} and each back needs ${fl(result.back.cutWidth)} across. Every row is ${fl(result.cutLength)} long.</p><p class="fabric-limit">This is a straight-grain layout estimate using each panel’s full width, without shaped nesting or turning pieces across the grain. Extra fabric covers the waistband, yoke, pockets, fly and belt loops. Shrinkage is applied once to width and purchase length.</p>`;

}
document.addEventListener('fabric:calculate',()=>{
 for(const k of FABRIC_KEYS)touched.add(k);
 for(const k of Object.keys(state.draft.seams))touched.add('seams.'+k);
 render();
});
document.addEventListener('input',e=>{
 const el=e.target,key=el.dataset.field;if(!key||el.tagName==='SELECT')return;
 if(key==='notes'){state.draft.notes=el.value.slice(0,20000);$('notesIndicator').textContent=el.value?'Saved with this draft':'Optional';scheduleSave();return;}
 if(!fieldKinds.has(key))return;touched.add(key);
 const kind=fieldKinds.get(key),parsed=parseLength(el.value,['ratio','percent'].includes(kind)?'in':state.unit);
 if(parsed.error)inputErrors.set(key,parsed.error);
 else if(parsed.value===null && !['waist','seat','depth','length','opening','frontRise','hipDepth','kneeDistance','kneeWidth','calfWidth','fabricWidth'].includes(key)) inputErrors.set(key,'Enter a value; use 0 if none.');
 else{inputErrors.delete(key);setValue(key,kind==='ratio'&&parsed.value!==null?parsed.value/100:parsed.value);}
 state.pendingInputs||={};
 if(inputErrors.has(key))state.pendingInputs[key]=el.value.slice(0,100);else delete state.pendingInputs[key];
 render();scheduleSave();
});
document.addEventListener('change',e=>{
 const measurement=e.target.dataset.measurement;
 if(['waist','seat'].includes(measurement)){
  const value=e.target.value;
  state.draft[measurement+'Source']=value==='body-around'?'body':'garment';
  state.draft[measurement+'Flat']=value==='garment-flat';
  if(value!=='body-around'){const key=measurement+'Ease';inputErrors.delete(key);if(state.pendingInputs)delete state.pendingInputs[key];$(key).value=formatNumber(getValue(key),state.unit);}
  updateSources();render();scheduleSave();return;
 }
 const el=e.target,key=el.dataset.field;if(!key||el.tagName!=='SELECT')return;
 if(['waistSource','seatSource','waistFlat','seatFlat','lengthOrigin'].includes(key)){
  state.draft[key]=key.endsWith('Flat')?el.value==='true':el.value;
  if(key.endsWith('Source')&&el.value==='body'){const k=key.replace('Source','Flat');state.draft[k]=false;$(k).value='false';}
  updateSources();render();scheduleSave();
 }
});
document.querySelectorAll('[data-unit]').forEach(b=>b.addEventListener('click',()=>{
 if(state.unit===b.dataset.unit)return;if([...inputErrors].some(([k])=>!$(domId(k)).disabled)){toast('Correct the highlighted entries before switching units.');return;}
 state.unit=b.dataset.unit;syncInputs();render();persist();
}));
$('fractionToggle').addEventListener('change',e=>{state.fractions=e.target.checked;render();persist();});
document.addEventListener('appearance:change',event=>{state.theme=event.detail.theme;if(!event.detail.external)persist();});
function replaceDraft(d,activeId=null,pendingInputs={}){state.draft=normalizeDraft(d);state.activeId=activeId;state.pendingInputs=pendingInputs;inputErrors.clear();touched.clear();syncInputs();renderProfiles();render();persist();document.dispatchEvent(new CustomEvent('draft:loaded'));}
$('loadExample').addEventListener('click',()=>{
 if(state.draft.waist!==null&&!confirm('Replace the current workspace with the example? Saved drafts stay in your notebook.'))return;
 replaceDraft({...clone(DEFAULT_DRAFT),waist:32,seat:40,depth:12,length:42,opening:8,fabricWidth:30,frontRise:12.5});$('moreMenu').open=false;toast('Example loaded. Replace these with your measurements.');
});
 $('profileSelect').addEventListener('change',e=>{const p=state.profiles.find(p=>p.id===e.target.value);if(!p){state.activeId=null;persist();return;}replaceDraft(p.draft,p.id);toast('Draft loaded. Use Save draft to update its named copy.');});
$('compareSelect').addEventListener('change',e=>{state.comparisonId=e.target.value||null;renderComparison();persist();});
$('saveProfile').addEventListener('click',()=>{if(otherTabChanged){toast('Load the latest workspace or export this copy first.');return;}if($('saveDialog').open)return;const p=state.profiles.find(p=>p.id===state.activeId);$('profileName').value=p?.name||'';$('deleteProfile').hidden=!p;$('saveDialog').showModal();});
$('cancelSave').addEventListener('click',()=>$('saveDialog').close());
$('saveForm').addEventListener('submit',e=>{
 e.preventDefault();if(otherTabChanged){toast('Load the latest workspace or export this copy first.');return;}if([...inputErrors].some(([k])=>!$(domId(k)).disabled)){toast('Correct invalid entries before saving this draft.');return;}
 const name=$('profileName').value.trim();if(!name)return;
 let p=state.profiles.find(p=>p.name===name);
 if(p&&p.id!==state.activeId&&!confirm('Replace the saved draft with this name?'))return;
 if(!p){if(state.profiles.length>=MAX_PROFILES){toast('Your notebook has 200 drafts. Export a backup and remove an older draft to add another.');return;}p={id:uid(),name};state.profiles.push(p);}
 Object.assign(p,{name,draft:clone(state.draft),updatedAt:new Date().toISOString()});state.activeId=p.id;$('saveDialog').close();renderProfiles();renderComparison();persist();toast('Draft saved to your notebook.');
});
$('deleteProfile').addEventListener('click',()=>{if(!confirm('Delete this named draft? The current measurements remain in your workspace.'))return;state.profiles=state.profiles.filter(p=>p.id!==state.activeId);state.activeId=null;$('saveDialog').close();renderProfiles();renderComparison();persist();toast('Named draft deleted.');});
$('newDraft').addEventListener('click',()=>{if(!confirm('Start a blank workspace? Save or export the current draft first if you want to keep it.'))return;replaceDraft(DEFAULT_DRAFT);$('moreMenu').open=false;document.getElementById('measure').scrollIntoView();});
$('resetSeams').addEventListener('click',()=>{state.draft.seams=clone(DEFAULT_DRAFT.seams);for(const k of Object.keys(state.draft.seams)){inputErrors.delete('seams.'+k);if(state.pendingInputs)delete state.pendingInputs['seams.'+k];}syncInputs();render();persist();});
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('exportBackup').addEventListener('click',()=>{persist();download({...state,legacy:getLegacy(),exported:new Date().toISOString()},`selvedge-backup-${new Date().toISOString().slice(0,10)}.json`);$('moreMenu').open=false;toast('Backup exported. Keep it to move your drafts between devices.');});
$('importBackup').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>20_000_000)throw new Error('Backup must be smaller than 20 MB.');
  const data=JSON.parse(await file.text());let profiles,draft,pendingInputs={},importUnit=state.unit,importFractions=state.fractions;
  if(data?.version===2&&data.draft&&Array.isArray(data.profiles)){profiles=cleanProfiles(data.profiles);draft=normalizeDraft(data.draft);pendingInputs=data.pendingInputs&&typeof data.pendingInputs==='object'?data.pendingInputs:{};importUnit=data.unit==='cm'?'cm':'in';importFractions=!!data.fractions;}
  else if(data?.measurements&&typeof data.measurements==='object'&&data.presets&&typeof data.presets==='object'){
   draft=migrateLegacyPreset(data.measurements);draft.notes+=[data.notes?.front&&`\nFront: ${data.notes.front}`,data.notes?.back&&`\nBack: ${data.notes.back}`].filter(Boolean).join('\n');
   profiles=Object.entries(data.presets).slice(0,200).filter(([,p])=>p&&typeof p==='object').map(([name,p])=>({id:uid(),name:name.slice(0,100),draft:migrateLegacyPreset(p),updatedAt:new Date().toISOString()}));
   for(const [old,key]of Object.entries({sa_flatfelled:'inseam',sa_back_out:'backOut',sa_front_out:'frontOut',sa_waistband:'waist',sa_curve_str:'frontStraight',sa_curve_crv:'frontCurve'}))if(data.seams?.[old]){const parsed=parseLength(data.seams[old]);if(parsed.value!==null&&!parsed.error&&parsed.value>=0)draft.seams[key]=parsed.value;}
   const width=parseLength(data.fabric?.fab_width||'');if(width.value>0)draft.fabricWidth=width.value;
  }else throw new Error('This is not a Selvedge backup.');
  if(!confirm('Load the imported workspace and add its saved drafts? Export your current workspace first if you need it.'))return;
  if(otherTabChanged)throw new Error('Load the latest workspace or export this copy before importing.');
  // Merge saved drafts instead of deleting this device’s notebook.
  let skipped=0;
  for(const p of profiles)if(!state.profiles.some(old=>old.name===p.name&&JSON.stringify(old.draft)===JSON.stringify(p.draft))){if(state.profiles.length<MAX_PROFILES)state.profiles.push(p);else skipped++;}
  state.unit=importUnit;state.fractions=importFractions;replaceDraft(draft,null,pendingInputs);$('moreMenu').open=false;toast(skipped?`Workspace imported. ${skipped} saved drafts remain in the backup because this notebook has reached 200 drafts.`:'Backup imported. Your saved drafts are ready.');
 }catch(error){toast(error.message||'Could not read this backup.');}finally{e.target.value='';}
});
$('copyDraft').addEventListener('click',async()=>{
 if(!result.valid)return;
 const d=state.draft,lines=['SELVEDGE — '+(state.profiles.find(p=>p.id===state.activeId)?.name||'Current draft'),'Stitching-line dimensions; add cutting allowances.',`Waist ${fl(result.W)} · Seat ${fl(result.H)} · Finished length ${fl(result.total)}`,`Front / back leg split: ${d.frontShare*100}% / ${100-d.frontShare*100}%`,'',...result.rows.map(r=>`${r.label}: front ${fl(r.f)} | back ${fl(r.b)}`),'','CUTTING ALLOWANCES',...Object.entries(d.seams).map(([k,v])=>`${k}: ${fl(v)}`),d.frontRise!==null?`Curved front-rise target: ${fl(d.frontRise)}`:'',d.notes?`\nNOTES\n${d.notes}`:''];
 try{await navigator.clipboard.writeText(lines.join('\n'));toast('Front, back and allowances copied.');}catch{toast('Clipboard unavailable. Use Print draft or Export backup.');}
});
$('printDraft').addEventListener('click',()=>{$('moreMenu').open=false;window.print();});
document.addEventListener('click',e=>{if(!$('moreMenu').contains(e.target))$('moreMenu').open=false;});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();$('saveProfile').click();}if(e.key==='Escape')$('moreMenu').open=false;});
window.addEventListener('storage',event=>{
 if(event.key!==KEY||!event.newValue)return;
 try{const incoming=JSON.parse(event.newValue);if(JSON.stringify([incoming.draft,incoming.profiles,incoming.pendingInputs||{}])===JSON.stringify([state.draft,state.profiles,state.pendingInputs||{}]))return;}catch{return;}
 otherTabChanged=true;clearTimeout(saveTimer);$('syncNotice').hidden=false;$('saveState').textContent='Changed in another tab';
 for(const id of ['saveProfile','newDraft','importBackup','loadExample','profileSelect','deleteProfile'])$(id).disabled=true;
});
$('loadLatest').addEventListener('click',()=>{otherTabChanged=false;state=initialState();inputErrors.clear();touched.clear();syncInputs();renderProfiles();render();$('syncNotice').hidden=true;$('saveState').innerHTML='<i></i> Saved on this device';for(const id of ['saveProfile','newDraft','importBackup','loadExample','profileSelect','deleteProfile'])$(id).disabled=false;document.dispatchEvent(new CustomEvent('draft:loaded'));toast('Latest workspace loaded.');});
$('exportThisTab').addEventListener('click',()=>$('exportBackup').click());
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
syncInputs();renderProfiles();render();persist();
if(state.profiles.some(p=>p.draft.depth===null&&p.draft.frontRise!==null))toast('Your old presets are here. Add vertical depth when you load one.');

// Keep installed copies current and ready to reopen offline.
if('serviceWorker'in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});},{once:true});
