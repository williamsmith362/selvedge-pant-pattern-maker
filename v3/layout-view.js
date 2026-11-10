import {panelBounds,panelOutline} from './pattern-view.js';
import {formatLength} from './model.js';

// An unfolded, single-layer layout. All shapes keep the drafting preview's curves
// and lengthwise grain. Dashed envelopes reserve each panel's cutting allowances.
export function layoutView(r,plan,d,unit='in',fractions=false){
 if(!r?.valid||!plan?.valid)return '';
 const width=640,pad=26,top=40,s=(width-2*pad)/plan.usableWidth;
 const clothHeight=(plan.panelCloth+d.extraLength)*s,height=top+clothHeight+14;
 const n=x=>Number(x.toFixed(3)),fl=x=>formatLength(x,unit,fractions);
 let panels='';
 plan.rows.forEach((row,rowIndex)=>{
  let cursor=0;
  row.forEach((piece,index)=>{
   const v=r[piece.panel],b=panelBounds(v);
   const mirror=plan.fabricType==='selvedge'?index===1:piece.copy===2;
   const x=plan.fabricType==='selvedge'&&index===1?plan.usableWidth-piece.width:cursor;
   const y=rowIndex*r.cutLength,out=d.seams[piece.panel==='front'?'frontOut':'backOut'];
   const px=raw=>pad+(x+(mirror?piece.width-out-(raw-b.min):out+raw-b.min))*s;
   const py=raw=>top+(y+d.seams.waist+raw)*s;
   const xy=(a,b)=>`${n(px(a))} ${n(py(b))}`;
   const path=panelOutline(r,piece.panel,xy);
   const gx=px(v.hem/2),gy=py(r.rise+Math.min(2,r.leg*.1)),end=py(r.panelLength-Math.min(2,r.leg*.1));
   const labelX=px((b.inside+b.outside)/2),labelY=py(r.seatY*.45);
   panels+=`<g class="layout-panel" data-panel="${piece.panel}" data-copy="${piece.copy}"><title>${piece.name} ${piece.copy}, row ${rowIndex+1}. Allowance width ${fl(piece.width)}.</title><rect class="layout-envelope" x="${n(pad+x*s)}" y="${n(top+y*s)}" width="${n(piece.width*s)}" height="${n(r.cutLength*s)}"/><path class="layout-outline" d="${path}"/><path class="layout-grain" d="M ${n(gx)} ${n(end)} V ${n(gy)} m -3 6 l 3 -6 l 3 6"/><text class="layout-panel-label" x="${n(labelX)}" y="${n(labelY)}" text-anchor="middle">${piece.name} ${piece.copy}</text></g>`;
   cursor+=piece.width;
  });
 });
 const reserveY=top+plan.panelCloth*s;
 const extra=d.extraLength>0?`<g class="layout-extra"><rect x="${pad}" y="${n(reserveY)}" width="${width-pad*2}" height="${n(d.extraLength*s)}"/><text x="${width/2}" y="${n(reserveY+d.extraLength*s/2)}" text-anchor="middle" dominant-baseline="middle">Extra · ${fl(d.extraLength)}</text></g>`:'';
 const dividers=plan.rows.slice(1).map((_,i)=>`M ${pad} ${n(top+(i+1)*r.cutLength*s)} H ${width-pad}`).join(' ');
 return `<svg class="cutting-layout ${plan.fabricType}" viewBox="0 0 ${width} ${n(height)}" role="img" aria-labelledby="layoutTitle layoutDescription"><title id="layoutTitle">${plan.fabricType==='regular'?'Regular':'Selvedge'} fabric cutting layout</title><desc id="layoutDescription">Two front and two back panels in ${plan.rows.length} ${plan.rows.length===1?'row':'rows'}, ${fl(r.cutLength)} per row, on ${fl(plan.usableWidth)} usable fabric width. ${fl(d.extraLength)} extra. Single layer, all grainlines lengthwise.</desc><path class="layout-dimension" d="M ${pad} 23 H ${width-pad} M ${pad} 18 V 28 M ${width-pad} 18 V 28"/><text class="layout-width" x="${width/2}" y="14" text-anchor="middle">${fl(plan.usableWidth)} wide</text><rect class="layout-cloth" x="${pad}" y="${top}" width="${width-pad*2}" height="${n(clothHeight)}"/>${panels}${extra}<path class="layout-row-divider" d="${dividers}"/><path class="layout-edges" d="M ${pad} ${top} V ${n(top+clothHeight)} M ${width-pad} ${top} V ${n(top+clothHeight)}"/></svg>`;
}
