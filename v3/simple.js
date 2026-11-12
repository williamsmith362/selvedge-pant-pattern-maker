import './app.js';
import {openMeasurementHelp} from './measurement-help.js';
const $=id=>document.getElementById(id);
const cards=[$('measure'),null,$('draft'),$('cloth')];
const fit=document.createElement('section');fit.id='adjust';fit.className='card';fit.innerHTML='<div class="section-heading"><h2>Fine-tune your fit</h2></div><p class="adjust-intro">Open only the options you want to change.</p>';
const detailCards=[...$('measure').querySelectorAll(':scope > details')];
for(const d of detailCards)fit.append(d);
$('measure').after(fit);cards[1]=fit;
cards.forEach(c=>c.classList.add('step-panel'));
$('measureTitle').textContent='Your measurements';$('loadExample').textContent='Use example';$('clothTitle').textContent='Fabric estimate';
const stepNames=['Measure','Fit','Pattern','Fabric'];
const titles=['Measure your pants.','Make the fit yours.','Your front & back.','How much fabric?'];
const hints=['Start with pants that fit. Add the six measurements below.','Optional. Keep the defaults, or adjust the fit you want.','Draw each panel from the table. Add cutting allowances before cutting.','Choose your fabric type, then enter its unfolded width.'];
const nextLabels=['Next: Fit','Next: Pattern','Next: Fabric','Calculate'];
const nav=document.querySelector('.steps');
nav.innerHTML=stepNames.map((name,i)=>`<button type="button" data-step="${i}"><span class="step-dot">${i+1}</span>${name}</button>`).join('');
const drafts=document.querySelector('.draft-bar');drafts.hidden=true;
document.querySelector('.drafts-toggle').addEventListener('click',e=>{drafts.hidden=!drafts.hidden;e.currentTarget.setAttribute('aria-expanded',String(!drafts.hidden));$('moreMenu').open=false;});
let step=0;
function show(n,scroll=true){step=Math.max(0,Math.min(3,n));cards.forEach((c,i)=>{c.hidden=i!==step;});[...nav.children].forEach((b,i)=>{if(i===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.classList.toggle('past',i<step);b.querySelector('.step-dot').textContent=String(i+1).padStart(2,'0');});$('stepHeading').textContent=titles[step];$('stepHint').textContent=hints[step];$('stepCount').textContent=`${step+1} of 4`;$('stepBack').disabled=step===0;$('stepNext').innerHTML=`${nextLabels[step]} <span aria-hidden="true">${step===3?'↵':'→'}</span>`;if(scroll){$('stepHeading').focus({preventScroll:true});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
document.addEventListener('draft:loaded',()=>show(0));
document.addEventListener('click',e=>{const b=e.target.closest('[data-recover]');if(!b)return;show(+b.dataset.recover);const field=[...document.querySelectorAll('input[data-field]')].find(input=>input.dataset.field===b.dataset.errorField);if(field){field.closest('details')?.setAttribute('open','');field.focus();}});
nav.addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b)show(+b.dataset.step);});
$('stepBack').addEventListener('click',()=>show(step-1));
$('stepNext').addEventListener('click',()=>{
 if(step===3){
  document.dispatchEvent(new CustomEvent('fabric:calculate'));
  const invalid=$('cloth').querySelector('input[aria-invalid="true"]:not(:disabled)');
  if(invalid){invalid.closest('details')?.setAttribute('open','');invalid.focus();return;}
  $('fabricResult').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  return;
 }
 if(step===0){const ids=['waist','seat','band','depth','length','opening'];for(const id of ids){const input=$(id);if(!input.value.trim()||input.getAttribute('aria-invalid')==='true'){input.setAttribute('aria-invalid','true');$(id+'Error').textContent=input.value.trim()?$(id+'Error').textContent:'Add this measurement to continue.';input.focus();return;}}}
 const invalid=cards[step].querySelector('input[aria-invalid="true"]:not(:disabled)');if(invalid){invalid.closest('details')?.setAttribute('open','');invalid.focus();return;}show(step+1);
});
$('fabricResult').addEventListener('click',e=>{const b=e.target.closest('[data-goto]');if(!b)return;show(+b.dataset.goto);const container=b.dataset.open?$(b.dataset.open):cards[+b.dataset.goto];const invalid=container.querySelector('input[aria-invalid="true"]');if(invalid){invalid.closest('details')?.setAttribute('open','');invalid.focus();}});
$('cloth').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();$('stepNext').click();}});
const info=$('infoDialog');
function openInfo(title,html,measurement=false){info.classList.toggle('measurement-help-dialog',measurement);$('infoTitle').textContent=title;$('infoBody').innerHTML=html;info.showModal();}
function closeInfo(){info.close();}
$('closeInfo').onclick=closeInfo;$('infoDone').onclick=closeInfo;info.addEventListener('click',e=>{if(e.target===info){const r=info.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeInfo();}});
$('fabricTypeHelp').addEventListener('click',()=>openInfo('Fabric type','<p><strong>Selvedge:</strong> each outseam stays on an original fabric edge. A row holds up to two panels.</p><p><strong>Regular:</strong> use the whole usable width. All four panels can share one row when they fit.</p><p>Enter the full, unfolded width. For regular fabric, leave out unusable edges. Both layouts keep the grain lengthwise and the pieces upright.</p><p>Dashed boxes include cutting allowances. Extra fabric is reserved for the waistband and small pieces. Shaped nesting can save more cloth.</p>'));
const mainHelp=new Set(['waist','seat','band','depth','length','opening']);
const quickHelp={
 waist:'Choose around or flat to match your measurement.',
 seat:'Measure at the widest part of the seat.',
 band:'Finished waistband height.',
 depth:'Measure straight down to crotch level.',
 length:'Measure from the waistband to the hem.',
 opening:'Width across one hem, laid flat.',
 waistEase:'Added only to a body waist measurement.',
 seatEase:'Added only to a body seat measurement.',
 frontRise:'Optional. Measure along the curved front seam.',
 hipDepth:'Optional. Straight down to the fullest seat.',
 depthDrop:'Extra room below crotch level. Start with 0.',
 kneeDistance:'Optional. Straight down from crotch to knee.',
 kneeWidth:'Optional. Width across one knee, laid flat.',
 calfWidth:'Optional. Width halfway from knee to hem.',
 frontShare:'How the leg width is split between panels.',
 waistBalance:'Extra back waist width. Total waist stays the same.',
 seatRatio:'Seat-line position when no seat depth is entered.',
 forkDeduction:'Changes the calculated crotch extensions.',
 fabricWidth:'Measure the full, unfolded width of usable cloth.',
 extraLength:'For the waistband, pockets and small pieces.',
 shrinkLength:'Use 0 for cloth already washed and dried.',
 shrinkWidth:'Use your tested rate, or 0 for prewashed cloth.'
};
for(const [id,name] of [['depth','Crotch depth'],['opening','Hem width']])document.querySelector(`label[for="${id}"]`).childNodes[0].textContent=name;
for(const field of document.querySelectorAll('.field')){const label=field.querySelector('label');const help=field.querySelector('.field-help');if(!label)continue;const id=label.htmlFor;const content=help?.innerHTML;if(!mainHelp.has(id)&&!content)continue;const title=label.childNodes[0].textContent.trim();const unit=label.querySelector('span');const row=document.createElement('div');row.className='field-label';label.before(row);row.append(label);const b=document.createElement('button');b.type='button';b.className='info-button';b.textContent='i';b.setAttribute('aria-label',`About ${title.toLowerCase()}`);b.addEventListener('click',()=>{b.focus();if(mainHelp.has(id))openMeasurementHelp(id,title,openInfo);else openInfo(title,content);});row.append(b);if(unit)row.append(unit);if(help){help.classList.replace('field-help','field-guideline');help.textContent=quickHelp[id]||help.textContent;row.after(help);}}
const caption=document.querySelector('.input-caption');if(caption){const b=document.createElement('button');b.className='info-button';b.type='button';b.textContent='i';b.setAttribute('aria-label','About measurements');b.onclick=()=>{b.focus();openMeasurementHelp('overview','Taking measurements',openInfo);};$('measureTitle').append(' ',b);}
for(const detail of document.querySelectorAll('details.disclosure')){const help=detail.querySelector(':scope > .details-body > p.field-help');if(!help)continue;const title=detail.querySelector('summary').childNodes[0].textContent.trim();const btn=document.createElement('button');btn.className='text-button';btn.type='button';btn.textContent='ⓘ About '+title.toLowerCase();btn.onclick=()=>openInfo(title,help.innerHTML);help.before(btn);}
document.querySelectorAll('a[href="#measure"],a[href="#draft"],a[href="#cloth"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.hash==='#draft'?2:a.hash==='#cloth'?3:0);}));
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.key!=='Enter'||!e.target.matches('input[data-field]')||step===3)return;
 e.preventDefault();
 const inputs=[...cards[step].querySelectorAll('input[data-field]:not(:disabled)')].filter(x=>x.offsetParent!==null);
 const i=inputs.indexOf(e.target),next=inputs[i+(e.shiftKey?-1:1)];
 if(next)next.focus();else if(!e.shiftKey)$('stepNext').click();
});
$('aboutTool').addEventListener('click',()=>{openInfo('About the pattern tool','<p>A personal worksheet for drafting selvedge pants. Start with measurements, review the front and back, then plan your fabric.</p><p>Shapes are drafting references. True the curves and check fit on a test pair.</p><p>Your drafts stay in this browser. Export a backup to keep a copy or move to another device.</p><p>Keyboard: Enter moves to the next field. Command or Control + S opens Save draft. Escape closes a dialog.</p>');$('moreMenu').open=false;});
document.querySelectorAll('.guide-links a').forEach(a=>{a.target='_blank';a.rel='noopener';});
for(const [id,title,content] of [['draftTitle','Using your pattern',()=>'<p>These are stitching-line dimensions. Add your cutting allowances before cutting.</p>'+[...$('draft').querySelectorAll('.table-note')].map(p=>'<p>'+p.innerHTML+'</p>').join('')],['clothTitle','Planning fabric',()=>'<p>Choose the fabric type and enter its unfolded width. The estimate uses four leg panels, allowances, extra fabric and shrinkage.</p>'+[...$('fabricResult').querySelectorAll('.fabric-detail,.fabric-limit')].map(p=>'<p>'+p.innerHTML+'</p>').join('')]]){const b=document.createElement('button');b.type='button';b.className='info-button';b.textContent='i';b.setAttribute('aria-label',title);b.onclick=()=>openInfo(title,content());$(id).append(' ',b);}
show(0,false);
// Tutorial links select the field's actual step without changing its value.
const tutorialField=new URLSearchParams(location.search).get('field');
const tutorialInput=[...document.querySelectorAll('input[data-field]')].find(input=>input.dataset.field===tutorialField);
if(tutorialInput){
 const index=cards.findIndex(card=>card.contains(tutorialInput));
 if(index>=0){show(index,false);tutorialInput.closest('details')?.setAttribute('open','');tutorialInput.closest('.field').classList.add('guided-field');requestAnimationFrame(()=>{tutorialInput.focus({preventScroll:true});tutorialInput.scrollIntoView({block:'center',behavior:'instant'});});tutorialInput.addEventListener('input',()=>tutorialInput.closest('.field').classList.remove('guided-field'),{once:true});}
}
