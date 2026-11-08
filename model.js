// All persisted lengths are inches. Render units never change the calculation model.
export const DEFAULT_DRAFT = {
  waist:null, waistSource:'garment', waistFlat:false, waistEase:0.5,
  seat:null, seatSource:'garment', seatFlat:false, seatEase:2,
  band:1.5, depth:null, depthDrop:0, length:null, lengthOrigin:'top', opening:null,
  frontRise:null, hipDepth:null, kneeDistance:null, kneeWidth:null, calfWidth:null,
  frontShare:0.45, waistBalance:0.5, seatRatio:0.75, forkDeduction:0.5,
  fabricWidth:null, extraLength:12, shrinkLength:0, shrinkWidth:0, notes:'',
  seams:{inseam:0.625, frontOut:0.5, backOut:0.5, waist:0.5, frontStraight:0.25, frontCurve:0.5, hem:1}
};
const LENGTH_KEYS = ['waist','waistEase','seat','seatEase','band','depth','depthDrop','length','opening','frontRise','hipDepth','kneeDistance','kneeWidth','calfWidth','waistBalance','forkDeduction','fabricWidth','extraLength'];
const OPTIONAL = new Set(['waist','seat','depth','length','opening','frontRise','hipDepth','kneeDistance','kneeWidth','calfWidth','fabricWidth']);
export const clone = value => JSON.parse(JSON.stringify(value));

export function normalizeDraft(input={}) {
  const d=clone(DEFAULT_DRAFT);
  if (!input || typeof input!=='object' || Array.isArray(input)) return d;
  for (const k of [...LENGTH_KEYS,'frontShare','seatRatio','shrinkLength','shrinkWidth']) {
    const value=input[k];
    if (value===null && OPTIONAL.has(k)) d[k]=null;
    else if (typeof value==='number' && Number.isFinite(value)) d[k]=value;
  }
  for (const k of ['waistSource','seatSource']) if (['body','garment'].includes(input[k])) d[k]=input[k];
  if (['top','below'].includes(input.lengthOrigin)) d.lengthOrigin=input.lengthOrigin;
  for (const k of ['waistFlat','seatFlat']) if(typeof input[k]==='boolean') d[k]=input[k];
  if(typeof input.notes==='string') d.notes=input.notes.slice(0,20000);
  if(input.seams && typeof input.seams==='object') for(const k of Object.keys(d.seams)) {
    if(typeof input.seams[k]==='number' && Number.isFinite(input.seams[k])) d.seams[k]=input.seams[k];
  }
  return d;
}

export function parseLength(text, unit='in') {
  const raw=String(text).trim().replace(/[″”"]/g,'').replace(/[¼½¾⅛⅜⅝⅞]/g,c=>' '+({'¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'}[c])).trim();
  if(!raw) return {value:null,error:null};
  let value;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) value=Number(raw);
  else {
    const m=raw.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
    if(!m || Number(m[3])===0) return {value:null,error:'Use a number, such as 8.5 or 8 1/2.'};
    value=Number(m[1]||0)+Number(m[2])/Number(m[3]);
  }
  return Number.isFinite(value) ? {value:unit==='cm'?value/2.54:value,error:null} : {value:null,error:'Enter a finite number.'};
}

export function formatNumber(inches,unit='in') {
  if(inches===null || !Number.isFinite(inches)) return '';
  return Number((unit==='cm'?inches*2.54:inches).toFixed(unit==='cm'?3:4)).toString();
}
export function formatLength(inches,unit='in',fractions=false) {
  if(inches===null || !Number.isFinite(inches)) return '—';
  if(unit==='cm') return `${Number((inches*2.54).toFixed(2))} cm`;
  if(!fractions) return `${Number(inches.toFixed(3))}″`;
  const sign=inches<0?'−':'';
  let n=Math.round(Math.abs(inches)*16), whole=Math.floor(n/16), numerator=n%16, denominator=16;
  while(numerator && numerator%2===0){numerator/=2;denominator/=2;}
  return `${sign}${whole||!numerator?whole:''}${whole&&numerator?' ':''}${numerator?`${numerator}/${denominator}`:''}″`;
}

export function computeDraft(input) {
  const d=normalizeDraft(input), errors={}, notices=[];
  const required={waist:'Waist',seat:'Seat',depth:'Vertical crotch depth',length:'Total length',opening:'Flat hem opening'};
  for(const [key,label] of Object.entries(required)) if(d[key]===null || d[key]<=0) errors[key]=`Enter a positive ${label.toLowerCase()}.`;
  for(const key of LENGTH_KEYS) if(d[key]!==null && d[key]<0) errors[key]='Use zero or a positive measurement.';
  for(const [k,value] of Object.entries(d.seams)) if(value<0) errors[`seams.${k}`]='Allowances cannot be negative.';
  for(const key of ['frontRise','hipDepth','kneeDistance','kneeWidth','calfWidth','fabricWidth']) if(d[key]!==null && d[key]<=0) errors[key]='Enter a positive measurement or leave blank.';
  if(d.frontShare<0.3 || d.frontShare>0.7) errors.frontShare='Front share must be between 30% and 70%.';
  if(d.seatRatio<=0 || d.seatRatio>=1) errors.seatRatio='Seat-line proportion must be between 0 and 1.';
  for(const k of ['shrinkLength','shrinkWidth']) if(d[k]<0 || d[k]>=50) errors[k]='Use a shrinkage percentage from 0 to less than 50.';
  if(Object.keys(errors).length) return {valid:false,errors,notices};
  const W=d.waist*(d.waistFlat?2:1)+(d.waistSource==='body'?d.waistEase:0);
  const H=d.seat*(d.seatFlat?2:1)+(d.seatSource==='body'?d.seatEase:0);
  const total=d.length+(d.lengthOrigin==='below'?d.band:0);
  const panelLength=total-d.band;
  const overallDepth=d.depth+d.depthDrop;
  const rise=overallDepth-d.band;
  const leg=total-overallDepth;
  const seatY=d.hipDepth===null?rise*d.seatRatio:d.hipDepth-d.band;
  const kneeY=d.kneeDistance===null?leg*0.4:d.kneeDistance;
  const Q=H/8-d.forkDeduction;
  const frontWaist=W/4-d.waistBalance/2, backWaist=W/4+d.waistBalance/2;
  if(rise<=0) errors.depth='Crotch level must be below the bottom of the waistband.';
  if(leg<=0) errors.length='Hem must be below crotch level. Check total length and vertical depth.';
  if(seatY<=0 || seatY>=rise) errors.hipDepth='Full-seat level must fall between the waistband attachment and crotch line.';
  if(kneeY<=0 || kneeY>=leg) errors.kneeDistance='Knee point must fall between crotch level and the hem.';
  if(frontWaist<=0 || backWaist<=0) errors.waistBalance='Waist balance leaves a panel with no waist width.';
  if(Q<=0) errors.forkDeduction='Crotch-extension deduction is too large for the seat target.';
  if(Object.keys(errors).length) return {valid:false,errors,notices};
  const kneeCirc=(d.kneeWidth===null?d.opening+0.5:d.kneeWidth)*2;
  const calfCirc=(d.calfWidth===null?d.opening:d.calfWidth)*2;
  const hemCirc=d.opening*2;
  const section2=(leg-kneeY)/2;
  const front={waist:frontWaist, seat:H/4, riseH:H/4+Q/2, offset:0, knee:kneeCirc*d.frontShare,calf:calfCirc*d.frontShare,hem:hemCirc*d.frontShare};
  const back={waist:backWaist, seat:H/4, riseH:H/4+Q, offset:Q/4, knee:kneeCirc*(1-d.frontShare),calf:calfCirc*(1-d.frontShare),hem:hemCirc*(1-d.frontShare)};
  const insideFront=Math.max(d.seams.inseam,d.seams.frontStraight,d.seams.frontCurve);
  front.cutWidth=Math.max(front.waist,front.seat,front.riseH,front.knee,front.calf,front.hem)+insideFront+d.seams.frontOut;
  back.cutWidth=Math.max(back.waist,back.seat,back.riseH,back.knee,back.calf,back.hem)+d.seams.inseam+d.seams.backOut;
  const cutLength=panelLength+d.seams.waist+d.seams.hem;
  if(d.hipDepth===null) notices.push('Seat-line height uses your block proportion; a measured waist-to-seat distance is more personal.');
  if(d.kneeDistance===null || d.kneeWidth===null) notices.push('Knee position or width uses a starting proportion. Check it on your draft.');
  if(d.frontRise!==null) notices.push(`Front crotch seam target: ${d.frontRise} in. Check along the drawn stitching curve; it does not set vertical depth.`);
  if(d.seams.frontOut===0 || d.seams.backOut===0) notices.push('An outseam allowance is zero. Confirm where the stitching sits relative to the selvedge.');
  const rows=[
    {key:'panelLength',label:'Panel outseam height',f:panelLength,b:panelLength},
    {key:'rise',label:'Crotch level below band',f:rise,b:rise},
    {key:'seatY',label:'Seat level below band',f:seatY,b:seatY},
    {key:'seat',label:'Seat width',f:front.seat,b:back.seat},
    {key:'riseH',label:'Width to crotch point',f:front.riseH,b:back.riseH},
    {key:'offset',label:'Seat offset reference',f:null,b:back.offset},
    {key:'waist',label:'Waist-edge allocation',f:front.waist,b:back.waist},
    {key:'section1',label:'Crotch → knee / point 1',f:kneeY,b:kneeY},
    {key:'knee',label:'Point 1 width',f:front.knee,b:back.knee},
    {key:'section2',label:'Point 1 → point 2',f:section2,b:section2},
    {key:'calf',label:'Point 2 width',f:front.calf,b:back.calf},
    {key:'section3',label:'Point 2 → hem',f:section2,b:section2},
    {key:'hem',label:'Hem width',f:front.hem,b:back.hem}
  ];
  return {valid:true,errors,notices,W,H,total,panelLength,overallDepth,rise,leg,seatY,kneeY,section2,cutLength,front,back,rows};
}

// Whole-panel rectangular envelopes, one fabric edge per panel. No nesting or rotation.
export function planFabric(result,input) {
  if(!result.valid) return {valid:false,reason:'Complete the measurements first.'};
  const d=normalizeDraft(input);
  if(d.fabricWidth===null || d.fabricWidth<=0) return {valid:false,reason:'Enter the full fabric width, selvedge to selvedge.'};
  if(d.shrinkWidth<0 || d.shrinkWidth>=50 || d.shrinkLength<0 || d.shrinkLength>=50 || d.extraLength<0) return {valid:false,reason:'Check shrinkage and extra cloth values.'};
  const usableWidth=d.fabricWidth*(1-d.shrinkWidth/100);
  const pieces=[{name:'Front',width:result.front.cutWidth},{name:'Front',width:result.front.cutWidth},{name:'Back',width:result.back.cutWidth},{name:'Back',width:result.back.cutWidth}];
  if(pieces.some(p=>p.width>usableWidth+1e-9)) return {valid:false,reason:'A panel is wider than the usable fabric. Choose wider cloth or revise the draft.',usableWidth,neededWidth:Math.max(...pieces.map(p=>p.width))};
  function pack(remaining){
    if(!remaining.length) return [];
    const [first,...rest]=remaining;
    let best=[[first],...pack(rest)];
    for(let i=0;i<rest.length;i++) if(first.width+rest[i].width<=usableWidth+1e-9){
      const candidate=[[first,rest[i]],...pack(rest.filter((_,j)=>j!==i))];
      if(candidate.length<best.length) best=candidate;
    }
    return best;
  }
  const rows=pack(pieces), panelCloth=rows.length*result.cutLength;
  const buyLength=(panelCloth+d.extraLength)/(1-d.shrinkLength/100);
  return {valid:true,usableWidth,rows,panelCloth,buyLength,yards:buyLength/36,meters:buyLength*0.0254};
}

export function migrateLegacyPreset(p) {
  return normalizeDraft({waist:p.waist||null,seat:p.seat||null,band:p.waistbandwidth??1.5,
    frontRise:p.rise||null,opening:p.legOpening||null,length:p.totalLength||null,
    notes:'Imported from the original calculator. Enter vertical crotch depth; the old rise was preserved as a curved front-seam target. Confirm whether total length includes the waistband.'});
}

export function compareDrafts(a,b) {
  if(!a.valid || !b.valid) return [];
  return a.rows.map((r,i)=>({...r,df:r.f===null||b.rows[i].f===null?null:r.f-b.rows[i].f,db:r.b===null||b.rows[i].b===null?null:r.b-b.rows[i].b}));
}
