import {DEFAULT_DRAFT,clone,normalizeDraft,parseLength,formatNumber,formatLength,computeDraft,planFabric,migrateLegacyPreset,compareDrafts} from './model.js';

const $=id=>document.getElementById(id);
const KEY='sp_workspace_v2';
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||`draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inputErrors=new Map(),touched=new Set(),fieldKinds=new Map();
let saveTimer,toastTimer,storageAvailable=true,result;
function readStored(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function getLegacy(){return {presets:readStored('sp_presets',{}),notes:readStored('sp_notes',{}),history:readStored('sp_history',[])};}
function cleanProfiles(profiles){return profiles.slice(0,200).filter(p=>p&&typeof p.name==='string'&&p.draft&&typeof p.draft==='object').map(p=>({id:uid(),name:p.name.slice(0,100),draft:normalizeDraft(p.draft),updatedAt:typeof p.updatedAt==='string'?p.updatedAt:new Date().toISOString()}));}
function initialState(){
  const saved=readStored(KEY,null);
  if(saved?.version===2 && saved.draft && Array.isArray(saved.profiles)){
    const profiles=saved.profiles.slice(0,200).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.draft).map(p=>({id:p.id,name:p.name.slice(0,100),draft:normalizeDraft(p.draft),updatedAt:p.updatedAt}));
    return {version:2,draft:normalizeDraft(saved.draft),profiles,activeId:profiles.some(p=>p.id===saved.activeId)?saved.activeId:null,comparisonId:profiles.some(p=>p.id===saved.comparisonId)?saved.comparisonId:null,unit:saved.unit==='cm'?'cm':'in',fractions:!!saved.fractions,theme:['parchment','indigo','midnight'].includes(saved.theme)?saved.theme:'parchment'};
  }
  const legacy=getLegacy(),profiles=[];
  if(legacy.presets&&typeof legacy.presets==='object')for(const [name,p] of Object.entries(legacy.presets).slice(0,200))if(p&&typeof p==='object') profiles.push({id:uid(),name:name.slice(0,100),draft:migrateLegacyPreset(p),updatedAt:new Date().toISOString()});
  const d=normalizeDraft();
  d.notes=[legacy.notes?.front&&`Front: ${legacy.notes.front}`,legacy.notes?.back&&`Back: ${legacy.notes.back}`].filter(Boolean).join('\n\n');
  let oldTheme;try{oldTheme=localStorage.getItem('sp_theme');}catch{oldTheme=null;}
  return {version:2,draft:d,profiles,activeId:null,comparisonId:null,unit:'in',fractions:false,theme:oldTheme==='indigo'?'indigo':oldTheme==='midnight'?'midnight':'parchment'};
}
let state=initialState();
function persist(){clearTimeout(saveTimer);try{localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;$('saveState').innerHTML='<i></i> Saved on this device';}catch{storageAvailable=false;$('saveState').textContent='Storage unavailable · Export a backup';}}
function scheduleSave(){$('saveState').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);}
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
 fabricFields:[['fabricWidth','Full fabric width','Selvedge to selvedge.'],['extraLength','Extra cloth reserve','For small pieces, layout adjustments and waste. Check that it covers your pieces.']],
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
 $('draftNotes').value=state.draft.notes;$('themeSelect').value=state.theme;$('fractionToggle').checked=state.fractions;
 document.documentElement.dataset.theme=state.theme;
 document.querySelector('meta[name=theme-color]').content=state.theme==='parchment'?'#f6f3ed':state.theme==='indigo'?'#111f2d':'#191b1c';
 document.querySelectorAll('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===state.unit)));
 document.querySelectorAll('.input-unit').forEach(e=>e.textContent=state.unit);
 updateSources();
}
function updateSources(){for(const k of ['waist','seat']){const body=state.draft[`${k}Source`]==='body';$(k+'Mode').value=body?'body-around':state.draft[`${k}Flat`]?'garment-flat':'garment-around';$(k+'Source').value=state.draft[`${k}Source`];$(k+'Flat').value=String(state.draft[`${k}Flat`]);$(k+'Ease').disabled=!body;}}
function renderProfiles(){
 for(const [id,blank,value]of [['profileSelect','Unsaved draft',state.activeId],['compareSelect','Choose a saved draft',state.comparisonId]]){
  const select=$(id);select.replaceChildren(new Option(blank,''));
  for(const p of state.profiles)select.add(new Option(p.name,p.id));select.value=value||'';
 }
}
const fl=value=>formatLength(value,state.unit,state.fractions);
function draftMap(){return `<svg class="draft-map" viewBox="0 0 480 150" role="img" aria-label="Schematic front and back panels with horizontal seat, crotch and knee reference lines; not a cutting pattern"><path class="outline" d="M65 17 L124 17 L128 49 Q129 65 145 66 L126 100 L126 139 L65 139 Z"/><path class="outline" d="M280 17 L346 13 L351 47 Q352 65 379 66 L353 100 L353 139 L280 139 Z"/><path class="level" d="M57 47 H154 M57 66 H154 M57 100 H154 M271 47 H389 M271 66 H389 M271 100 H389"/><text x="82" y="149">FRONT</text><text x="302" y="149">BACK</text><text x="165" y="50">Seat</text><text x="165" y="69">Crotch</text><text x="165" y="103">Point 1</text></svg>`;}
function render(){
 result=computeDraft(state.draft);
 if(inputErrors.size)result={valid:false,errors:{...result.errors,...Object.fromEntries(inputErrors)},notices:[]};
 for(const [key]of fieldKinds){const e=$(domId(key)),error=result.errors[key];const show=error&&(touched.has(key)||getValue(key)!==null);e.setAttribute('aria-invalid',String(!!show));$(domId(key)+'Error').textContent=show?error:'';}
 for(const k of ['waist','seat']){
  const d=state.draft,raw=d[k],ease=d[`${k}Source`]==='body'?d[`${k}Ease`]:0;
  $(k+'Target').textContent=raw>0?`Target ${fl(raw*(d[`${k}Flat`]?2:1)+ease)} around${ease?` · +${fl(ease)} ease`:''}`:'';
 }
 $('copyDraft').disabled=!result.valid;
 let appendix=$('printAppendix');if(!appendix){appendix=document.createElement('div');appendix.id='printAppendix';appendix.className='print-only';$('draft').append(appendix);}
 appendix.innerHTML=result.valid?`<h3>Cutting allowances</h3><p>${Object.entries(state.draft.seams).map(([k,v])=>`${escapeHTML(k)}: ${fl(v)}`).join(' · ')}</p>${state.draft.frontRise!==null?`<p>Curved front-rise target: ${fl(state.draft.frontRise)}. Check on the drawn stitching curve.</p>`:''}<p>Finished total length: ${fl(result.total)} · Band height: ${fl(state.draft.band)}</p><p style="white-space:pre-wrap">${escapeHTML(state.draft.notes)}</p>`:'';
 $('notesIndicator').textContent=state.draft.notes?'Saved with this draft':'Optional';
 if(!result.valid){
  const messages=[...new Set(Object.values(result.errors))];
  $('results').innerHTML=`<div class="empty-draft"><div class="empty-inner"><h3>Your draft measurements</h3><p>Enter your measurements to calculate the front and back panels.</p><div class="missing-list">${messages.map(escapeHTML).join('<br>')}</div></div></div>`;
 }else{
  const share=Math.round(state.draft.frontShare*100);
  $('results').innerHTML=`<div class="draft-summary"><div><small>Waist target</small><strong>${fl(result.W)}</strong></div><div><small>Seat target</small><strong>${fl(result.H)}</strong></div><div><small>Leg split · F / B</small><strong>${share} / ${100-share}</strong></div></div><figure class="draft-visual">${draftMap()}<figcaption>Reference diagram · not a scaled cutting pattern</figcaption></figure><table class="measure-table"><caption>Per panel · add cutting allowances separately</caption><thead><tr><th scope="col">Measurement</th><th scope="col">Front</th><th scope="col">Back</th></tr></thead><tbody>${result.rows.map((r,i)=>`<tr class="${i===7?'group-start ':''}${r.key==='hem'?'highlight':''}"><td>${r.label}</td><td>${fl(r.f)}</td><td>${fl(r.b)}</td></tr>`).join('')}</tbody></table><p class="table-note">${state.draft.hipDepth===null?'Seat height is estimated. ':''}${state.draft.kneeDistance===null||state.draft.kneeWidth===null?'Knee uses starting proportions. ':''}${state.draft.frontRise!==null?`Curved front-rise target: ${fl(state.draft.frontRise)}; check it on your drawn seam. `:''}${state.draft.seams.frontOut===0||state.draft.seams.backOut===0?'Zero outseam allowance: confirm the selvedge stitching position.':''}</p>`;
 }
 $("draftReference").innerHTML='<p class="table-note">Lengths below the crotch are consecutive vertical sections. The sketch is a reference map, not a scaled cutting pattern. Waist widths are allocations to true along your shaped waist edge.</p>';
 renderFormulas();renderComparison();renderFabric();
}
function renderFormulas(){
 const d=state.draft;
 $('formulaNotes').innerHTML=`<p><strong>Measurement convention.</strong> Waist and seat are converted to full circumferences. Finished-pants inputs get no added ease. Body inputs receive only their selected ease.</p><p><code>Panel height = finished total length − band height</code><br><code>Crotch level = vertical depth + drop − band height</code><br><code>Leg span = panel height − crotch level</code></p><p><code>Front waist = waist target / 4 − back advantage / 2</code><br><code>Back waist = waist target / 4 + back advantage / 2</code><br>The two fronts plus two backs total your waist target before manual shaping.</p><p><code>Base seat width = seat target / 4</code><br><code>Q = seat target / 8 − deduction</code><br><code>Front crotch width = seat width + Q/2</code><br><code>Back crotch width = seat width + Q</code><br><code>Back seat offset reference = Q/4</code><br>Offset is a construction reference; confirm how it is used when shaping your back curve.</p><p><code>Front leg width = circumference × ${Number((d.frontShare*100).toFixed(2))}%</code><br><code>Back leg width = circumference × ${Number(((1-d.frontShare)*100).toFixed(2))}%</code><br>The split preserves each selected circumference. Blank knee uses flat hem + ½″; blank point 2 uses hem width.</p><p>Without measured positions: seat level is ${Number((d.seatRatio*100).toFixed(2))}% of panel crotch depth; knee is 40% of the leg span. Point 2 is halfway from knee to hem.</p><p>Front-rise seam length is a curved target and is never converted into vertical depth. The calculator does not generate crotch curves, darts or yoke shaping, or establish that seam lengths match.</p><p><a href="https://pubs.nmsu.edu/_c/C227/index.html" target="_blank" rel="noopener">Measurement reference: crotch depth vs. crotch length ↗</a></p>`;
}
function renderComparison(){
 const p=state.profiles.find(p=>p.id===state.comparisonId);
 if(!p){$('comparison').innerHTML='<p class="compare-note">Save a draft, then choose it here to compare both panels.</p>';return;}
 const other=computeDraft(p.draft);
 if(!result.valid||!other.valid){$('comparison').innerHTML='<p class="compare-note">Both drafts need valid measurements. Imported old presets need a vertical crotch depth before comparison.</p>';return;}
 const delta=x=>x===null?'—':`${Math.abs(x)<0.00001?'':x>0?'+':'−'}${fl(Math.abs(x))}`;
 $('comparison').innerHTML=`<p class="compare-note">Current minus ${escapeHTML(p.name)}. Updates as you measure.</p><table class="measure-table compare-table"><thead><tr><th scope="col">Difference</th><th scope="col">Front Δ</th><th scope="col">Back Δ</th></tr></thead><tbody>${compareDrafts(result,other).map(r=>`<tr><td>${r.label}</td><td class="${r.df>0?'positive':r.df<0?'negative':''}">${delta(r.df)}</td><td class="${r.db>0?'positive':r.db<0?'negative':''}">${delta(r.db)}</td></tr>`).join('')}</tbody></table>`;
}
function renderFabric(){
 const plan=planFabric(result,state.draft);
 if(!plan.valid){$('fabricResult').innerHTML=`<div class="fabric-empty ${plan.neededWidth?'warning':''}"><div>${escapeHTML(plan.reason)}${plan.neededWidth?`<p class="fabric-detail">Required envelope: ${fl(plan.neededWidth)}<br>Usable width: ${fl(plan.usableWidth)}</p>`:''}</div></div>`;return;}
 $('fabricResult').innerHTML=`<p class="fabric-caption">Planning estimate · includes your reserve</p><div class="fabric-metrics"><strong>${(Math.ceil(plan.yards*100)/100).toFixed(2)} yd</strong><span>${(Math.ceil(plan.meters*100)/100).toFixed(2)} m</span></div><div class="fabric-roll"><div class="fabric-roll-head"><span>Selvedge</span><span>${fl(plan.usableWidth)} usable</span><span>Selvedge</span></div>${plan.rows.map(row=>`<div class="fabric-row">${row.map(p=>`<div class="fabric-piece ${p.name==='Back'?'back':''}" style="width:${(p.width/plan.usableWidth*100).toFixed(3)}%">${p.name}</div>`).join('')}</div>`).join('')}</div><p class="fabric-detail">${plan.rows.length} rows × ${fl(result.cutLength)} panel envelopes<br>Leg-panel cloth: ${fl(plan.panelCloth)} + reserve: ${fl(state.draft.extraLength)}<br>Envelope widths · front ${fl(result.front.cutWidth)} / back ${fl(result.back.cutWidth)}</p><p class="fabric-limit">A conservative arrangement of four whole leg panels, with cutting allowances and up to two selvedge edges per row. Verify space for the waistband, yoke, fly, pockets and belt loops; the reserve is your allowance for these pieces. Curves and nesting can change the actual layout.${state.draft.shrinkLength||state.draft.shrinkWidth?' Purchase length accounts for your expected shrinkage before cutting.':''}</p>`;
}
document.addEventListener('input',e=>{
 const el=e.target,key=el.dataset.field;if(!key||el.tagName==='SELECT')return;
 if(key==='notes'){state.draft.notes=el.value.slice(0,20000);$('notesIndicator').textContent=el.value?'Saved with this draft':'Optional';scheduleSave();return;}
 if(!fieldKinds.has(key))return;touched.add(key);
 const kind=fieldKinds.get(key),parsed=parseLength(el.value,['ratio','percent'].includes(kind)?'in':state.unit);
 if(parsed.error)inputErrors.set(key,parsed.error);
 else if(parsed.value===null && !['waist','seat','depth','length','opening','frontRise','hipDepth','kneeDistance','kneeWidth','calfWidth','fabricWidth'].includes(key)) inputErrors.set(key,'Enter a value; use 0 if none.');
 else{inputErrors.delete(key);setValue(key,kind==='ratio'&&parsed.value!==null?parsed.value/100:parsed.value);}
 render();scheduleSave();
});
document.addEventListener('change',e=>{
 const measurement=e.target.dataset.measurement;
 if(['waist','seat'].includes(measurement)){
  const value=e.target.value;
  state.draft[measurement+'Source']=value==='body-around'?'body':'garment';
  state.draft[measurement+'Flat']=value==='garment-flat';
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
 if(state.unit===b.dataset.unit)return;if(inputErrors.size){toast('Correct the highlighted entries before switching units.');return;}
 state.unit=b.dataset.unit;syncInputs();render();persist();
}));
$('fractionToggle').addEventListener('change',e=>{state.fractions=e.target.checked;render();persist();});
$('themeSelect').addEventListener('change',e=>{state.theme=e.target.value;syncInputs();persist();});
function replaceDraft(d,activeId=null){state.draft=normalizeDraft(d);state.activeId=activeId;inputErrors.clear();touched.clear();syncInputs();renderProfiles();render();persist();}
$('loadExample').addEventListener('click',()=>{
 if(state.draft.waist!==null&&!confirm('Replace the current workspace with the example? Saved drafts stay in your notebook.'))return;
 replaceDraft({...clone(DEFAULT_DRAFT),waist:32,seat:40,depth:12,length:42,opening:8,fabricWidth:30,frontRise:12.5});$('moreMenu').open=false;toast('Example loaded. Replace these with your measurements.');
});
 $('profileSelect').addEventListener('change',e=>{const p=state.profiles.find(p=>p.id===e.target.value);if(!p){renderProfiles();return;}replaceDraft(p.draft,p.id);toast('Draft loaded. Edits autosave to your workspace; use Save draft to update the named copy.');});
$('compareSelect').addEventListener('change',e=>{state.comparisonId=e.target.value||null;renderComparison();persist();});
$('saveProfile').addEventListener('click',()=>{const p=state.profiles.find(p=>p.id===state.activeId);$('profileName').value=p?.name||'';$('deleteProfile').hidden=!p;$('saveDialog').showModal();});
$('cancelSave').addEventListener('click',()=>$('saveDialog').close());
$('saveForm').addEventListener('submit',e=>{
 e.preventDefault();if(inputErrors.size){toast('Correct invalid entries before saving this draft.');return;}
 const name=$('profileName').value.trim();if(!name)return;
 let p=state.profiles.find(p=>p.name===name);
 if(p&&p.id!==state.activeId&&!confirm('Replace the saved draft with this name?'))return;
 if(!p){p={id:uid(),name};state.profiles.push(p);}
 Object.assign(p,{name,draft:clone(state.draft),updatedAt:new Date().toISOString()});state.activeId=p.id;$('saveDialog').close();renderProfiles();renderComparison();persist();toast('Draft saved to your notebook.');
});
$('deleteProfile').addEventListener('click',()=>{if(!confirm('Delete this named draft? The current measurements remain in your workspace.'))return;state.profiles=state.profiles.filter(p=>p.id!==state.activeId);state.activeId=null;$('saveDialog').close();renderProfiles();renderComparison();persist();toast('Named draft deleted.');});
$('newDraft').addEventListener('click',()=>{if(!confirm('Start a blank workspace? Save or export the current draft first if you want to keep it.'))return;replaceDraft(DEFAULT_DRAFT);$('moreMenu').open=false;document.getElementById('measure').scrollIntoView();});
$('resetSeams').addEventListener('click',()=>{state.draft.seams=clone(DEFAULT_DRAFT.seams);for(const k of Object.keys(state.draft.seams))inputErrors.delete('seams.'+k);syncInputs();render();persist();});
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('exportBackup').addEventListener('click',()=>{persist();download({...state,legacy:getLegacy(),exported:new Date().toISOString()},`selvedge-backup-${new Date().toISOString().slice(0,10)}.json`);$('moreMenu').open=false;toast('Backup exported. Keep it to move your drafts between devices.');});
$('importBackup').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>2_000_000)throw new Error('Backup must be smaller than 2 MB.');
  const data=JSON.parse(await file.text());let profiles,draft;
  if(data?.version===2&&data.draft&&Array.isArray(data.profiles)){profiles=cleanProfiles(data.profiles);draft=normalizeDraft(data.draft);}
  else if(data?.measurements&&typeof data.measurements==='object'&&data.presets&&typeof data.presets==='object'){
   draft=migrateLegacyPreset(data.measurements);draft.notes+=[data.notes?.front&&`\nFront: ${data.notes.front}`,data.notes?.back&&`\nBack: ${data.notes.back}`].filter(Boolean).join('\n');
   profiles=Object.entries(data.presets).slice(0,200).filter(([,p])=>p&&typeof p==='object').map(([name,p])=>({id:uid(),name:name.slice(0,100),draft:migrateLegacyPreset(p),updatedAt:new Date().toISOString()}));
   for(const [old,key]of Object.entries({sa_flatfelled:'inseam',sa_back_out:'backOut',sa_front_out:'frontOut',sa_waistband:'waist',sa_curve_str:'frontStraight',sa_curve_crv:'frontCurve'}))if(data.seams?.[old]){const parsed=parseLength(data.seams[old]);if(parsed.value!==null&&!parsed.error&&parsed.value>=0)draft.seams[key]=parsed.value;}
   const width=parseLength(data.fabric?.fab_width||'');if(width.value>0)draft.fabricWidth=width.value;
  }else throw new Error('This is not a Selvedge backup.');
  if(!confirm('Load the imported workspace and add its saved drafts? Export your current workspace first if you need it.'))return;
  // Merge saved drafts instead of deleting this device’s notebook.
  for(const p of profiles)if(!state.profiles.some(old=>old.name===p.name&&JSON.stringify(old.draft)===JSON.stringify(p.draft)))state.profiles.push(p);
  replaceDraft(draft);$('moreMenu').open=false;toast('Backup imported. Old rise values remain curved targets; add vertical depth.');
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
const links=[...document.querySelectorAll('.mobile-nav a')];
const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)links.forEach(a=>a.classList.toggle('active',a.hash==='#'+visible.target.id));},{rootMargin:'-80px 0px -50% 0px',threshold:0});
for(const id of ['measure','draft','cloth'])observer.observe($(id));
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
syncInputs();renderProfiles();render();persist();
// Tutorial links focus only a known field. Visiting a lesson never edits a draft.
const tutorialField=new URLSearchParams(location.search).get('field');
if(fieldKinds.has(tutorialField)){
 const input=$(domId(tutorialField)),details=input.closest('details');
 if(details)details.open=true;
 input.closest('.field').classList.add('guided-field');
 requestAnimationFrame(()=>{input.focus({preventScroll:true});input.scrollIntoView({block:'center',behavior:'instant'});});
 input.addEventListener('input',()=>input.closest('.field').classList.remove('guided-field'),{once:true});
}
if(state.profiles.some(p=>p.draft.depth===null&&p.draft.frontRise!==null))toast('Your old presets are here. Add vertical depth when you load one.');
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offlineState').textContent='Ready for offline use · Saved on this device';}).catch(()=>{$('offlineState').textContent='Local saves · Internet needed to reopen';});}
