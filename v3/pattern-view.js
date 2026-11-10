export const panelBounds=v=>{const inside=v.seat-v.offset;return {inside,outside:inside-v.waist,min:Math.min(0,inside-v.waist),max:Math.max(inside,v.seat,v.riseH,v.knee,v.calf,v.hem)};};
export function panelOutline(r,side,xy){
 const v=r[side],bounds=panelBounds(v);
  const ys=[r.rise,r.rise+r.kneeY,r.rise+r.kneeY+r.section2,r.panelLength];
  const xs=[v.riseH,v.knee,v.calf,v.hem];
  const ds=ys.slice(1).map((y,i)=>(xs[i+1]-xs[i])/(y-ys[i]));
  const m=[ds[0],0,0,ds[2]];
  for(let i=1;i<3;i++)m[i]=ds[i-1]*ds[i]<=0?0:2/(1/ds[i-1]+1/ds[i]);
  for(let i=0;i<3;i++){
   if(ds[i]===0){m[i]=m[i+1]=0;continue;}
   const a=m[i]/ds[i],b=m[i+1]/ds[i],norm=a*a+b*b;
   if(norm>9){const t=3/Math.sqrt(norm);m[i]=t*a*ds[i];m[i+1]=t*b*ds[i];}
  }
  let d=`M ${xy(bounds.outside,0)} L ${xy(bounds.inside,0)} `;
  if(side==='back'){
   const ty=(r.rise-r.seatY)*.505,tx=ty*.6;
   d+=`C ${xy(bounds.inside+.05,r.seatY*.34)} ${xy(v.seat-tx,r.seatY-ty)} ${xy(v.seat,r.seatY)} C ${xy(v.seat+tx,r.seatY+ty)} ${xy(v.riseH-(v.riseH-v.seat)*.4,r.rise)} ${xy(v.riseH,r.rise)} `;
  }else{
   const k=.5522847498;
   d+=`C ${xy(bounds.inside,r.seatY*.34)} ${xy(v.seat,r.seatY*.7)} ${xy(v.seat,r.seatY)} C ${xy(v.seat,r.seatY+k*(r.rise-r.seatY))} ${xy(v.riseH-k*(v.riseH-v.seat),r.rise)} ${xy(v.riseH,r.rise)} `;
  }
  for(let i=0;i<3;i++){const h=ys[i+1]-ys[i];d+=`C ${xy(xs[i]+m[i]*h/3,ys[i]+h/3)} ${xy(xs[i+1]-m[i+1]*h/3,ys[i+1]-h/3)} ${xy(xs[i+1],ys[i+1])} `;}
  d+=`L ${xy(0,r.panelLength)} L ${xy(0,r.seatY)} C ${xy(0,r.seatY*.58)} ${xy(bounds.outside*.45,r.seatY*.2)} ${xy(bounds.outside,0)} Z`;
 return d;
}

// Reduced drafting reference from the same stations as the results table.
export function patternView(r){
 if(!r?.valid)return '';
 const width=340,pad=24,gap=40,top=22;
 const f=panelBounds(r.front),b=panelBounds(r.back);
 const s=Math.min(10,(width-2*pad-gap)/(f.max-f.min+b.max-b.min),390/r.panelLength);
 const height=top+r.panelLength*s+24;
 const n=v=>Number(v.toFixed(3));
 function panel(v,bounds,side){
  const direction=side==='front'?1:-1;
  const origin=side==='front'?pad-bounds.min*s:width-pad+bounds.min*s;
  const xy=(x,y)=>`${n(origin+direction*x*s)} ${n(top+y*s)}`;
  const ys=[r.rise,r.rise+r.kneeY,r.rise+r.kneeY+r.section2,r.panelLength];
  const d=panelOutline(r,side,xy);
  const levels=[[r.seatY,v.seat],[r.rise,v.riseH],[ys[1],v.knee],[ys[2],v.calf]].map(([y,x])=>`M ${xy(0,y)} L ${xy(x,y)}`).join(' ');
  const gx=origin+direction*v.hem*s/2,gy1=top+(r.rise+2)*s,gy2=top+(r.panelLength-2)*s;
  const arrow=`M ${n(gx)} ${n(gy1)} L ${n(gx)} ${n(gy2)} M ${n(gx-2)} ${n(gy1+5)} L ${n(gx)} ${n(gy1)} L ${n(gx+2)} ${n(gy1+5)} M ${n(gx-2)} ${n(gy2-5)} L ${n(gx)} ${n(gy2)} L ${n(gx+2)} ${n(gy2-5)}`;
  const lx=origin+direction*(bounds.inside+bounds.outside)*s/2;
  return `<path class="level" d="${levels}"/><path class="outline" d="${d}"/><path class="grain" d="${arrow}"/><text x="${n(lx)}" y="${n(top+3.3*s)}" text-anchor="middle">${side.toUpperCase()}</text>`;
 }
 return `<svg class="current-pattern" viewBox="0 0 ${width} ${n(height)}" role="img" aria-labelledby="currentPatternTitle"><title id="currentPatternTitle">Front and back drafting reference for your current measurements</title>${panel(r.front,f,'front')}${panel(r.back,b,'back')}</svg>`;
}
