import {drawMeasurement} from '../measure-visuals.js';

const methods=[
  ['garment-around','Pants · around'],
  ['garment-flat','Pants · flat ×2'],
  ['body-around','Body · around']
];
const lesson=(definition,visual,steps,note)=>({definition,visual,steps,note});

function guidance(field,mode,belowBand){
  const body=mode==='body-around',flat=mode==='garment-flat';
  switch(field){
    case 'waist':
      if(body)return lesson('The distance around your body where the top of your waistband will sit.','body-waist',[
        'Mark where you want the top of the waistband to sit.',
        'Wrap a flexible tape around that level. Keep it level and snug without squeezing.',
        'Enter the full reading and choose Body · around.'
      ],'Add any extra room in Step 2 → Body waist ease.');
      if(flat)return lesson('The width across the waistband of your pants, laid flat.','jeans-waist',[
        'Fasten the pants and lay them flat. Align the waistband edges without stretching.',
        'Measure straight across the waistband, from one side to the other.',
        'Enter that width and choose Pants · flat ×2. The calculator doubles it.'
      ],'Example: 16″ across → enter 16 → 32″ around.');
      return lesson('The full distance around the waistband of your pants.','jeans-waist-around',[
        'Fasten a pair of pants that fits you well.',
        'Run a flexible tape around the inside of the waistband, along its top edge. Follow the front and back all the way around.',
        'Enter the full reading and choose Pants · around.'
      ],'Enter the full circumference once.');
    case 'seat':
      if(body)return lesson('The distance around the fullest part of your seat.','body-seat',[
        'Stand naturally with your feet together.',
        'Wrap the tape around the fullest part of your seat. Keep it level and avoid squeezing.',
        'Enter the full reading and choose Body · around.'
      ],'Add any extra room in Step 2 → Body seat ease.');
      if(flat)return lesson('The width across the fullest seat of your pants, laid flat.','jeans-seat',[
        'Fasten the pants and smooth both layers flat without stretching.',
        'Find the fullest seat above the crotch. Measure across both layers, from edge to edge.',
        'Enter that width and choose Pants · flat ×2. The calculator doubles it.'
      ],'Example: 20″ across → enter 20 → 40″ around.');
      return lesson('The full distance around your pants at the fullest seat.','jeans-seat-around',[
        'Fasten the pants and find the fullest seat above the crotch.',
        'Follow that same level with a flexible tape, across the front and around the back.',
        'Enter the full reading and choose Pants · around.'
      ],'Keep the tape at one level all the way around.');
    case 'band':
      return lesson('The finished height of your waistband.', 'jeans-band',body?[
        'Choose how tall you want the finished waistband to be. You can use a pair you like as a reference.',
        'On reference pants, measure from the band’s top edge to its lower attachment seam, away from belt loops.',
        'Enter that height in Band height.'
      ]:[
        'Find a straight section of the waistband, away from belt loops.',
        'Measure from the top edge down to the seam that attaches the band to the pants.',
        'Enter that finished height in Band height.'
      ],'Use the height once in every method. Leave cutting allowances out.');
    case 'depth':
      return lesson('The straight vertical distance from waistband level to crotch level.',body?'body-depth':'jeans-depth',[
        body?'Mark where the top of your finished waistband will sit.':'Put on your reference pants. Use the top of their waistband as your starting level.',
        'Sit upright on a firm, flat chair with your feet supported.',
        'Measure straight down at your side, from the waistband level to the chair surface. Enter that distance.'
      ],'Use this distance once. The curved front-rise seam is a separate measurement.');
    case 'length': {
      const start=belowBand?'the seam below the waistband':'the top of the waistband';
      return lesson(`The outside length from ${start} to the finished hem.`,`${body?'body':'jeans'}-length${belowBand?'-below':''}`,body?[
        `Mark ${belowBand?'where the lower edge of your finished waistband will sit':'where the top of your finished waistband will sit'}.`,
        'Choose where you want the hem to end. Have someone measure straight down your side to that level.',
        `Enter the distance and choose ${belowBand?'Below band':'Includes band'}.`
      ]:[
        'Lay the pants flat and smooth the outside of one leg.',
        `Measure down the outside, from ${start} to the finished hem.`,
        `Enter the distance and choose ${belowBand?'Below band':'Includes band'}.`
      ],'Use this length once. Match the starting point to the dropdown.');
    }
    case 'opening':
      return lesson('The width across the finished opening of one leg.','jeans-hem',body?[
        'Choose the flat hem width you want. Use a pair you like as a reference.',
        'Lay one leg flat and measure edge to edge, just above the bulky hem fold.',
        'Enter that one flat width in Hem width.'
      ]:[
        'Lay one leg flat and smooth it without stretching.',
        'Measure straight across, edge to edge, just above the bulky hem fold.',
        'Enter that one flat width in Hem width.'
      ],'Always enter one flat width here. Example: an 8″ flat hem → enter 8.');
    default:
      if(body)return lesson('Use your body for waist and seat, then choose your finished lengths and hem.','body-waist',[
        'Mark where the top of the waistband will sit. Measure your waist and full seat around your body.',
        'Choose Body · around for each of those fields. Add extra room in Step 2.',
        'Use each field’s info button for band height, seated depth, outside length and flat hem width.'
      ],'Browsing these tabs does not change your measurements or selected method.');
      return lesson(flat?'Measure the waist and seat across your pants, laid flat.':'Measure the full waist and seat around a pair that fits.',flat?'jeans-waist':'jeans-waist-around',[
        'Use a pair of pants that fits you well. Fasten them and smooth the fabric without stretching.',
        flat?'Enter the flat waist and seat widths. Choose Pants · flat ×2 for each; the calculator doubles them.':'Measure all the way around the waist and full seat. Choose Pants · around for each.',
        'Use each field’s info button for band height, seated depth, outside length and flat hem width.'
      ],'The ×2 setting applies to waist and seat. Enter heights, lengths and hem width once.');
  }
}

// Browsing help is independent of the calculator's measurement settings.
export function openMeasurementHelp(field,title,openInfo){
  const source=document.getElementById(`${field}Mode`)||document.getElementById('waistMode');
  const initial=source?.value||'garment-around';
  openInfo(title,`<div class="measurement-help-tabs" role="tablist" aria-label="Measurement method">${methods.map(([mode,label])=>`<button type="button" role="tab" id="help-${mode}" aria-controls="measurementHelpPanel" aria-selected="${mode===initial}" tabindex="${mode===initial?0:-1}" data-help-method="${mode}">${label}</button>`).join('')}</div><section id="measurementHelpPanel" role="tabpanel" tabindex="0"></section>`,true);
  const tabs=[...document.querySelectorAll('[data-help-method]')];
  const panel=document.getElementById('measurementHelpPanel');
  function select(mode,focus=false){
    const active=tabs.find(tab=>tab.dataset.helpMethod===mode);
    for(const tab of tabs){const selected=tab===active;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    const help=guidance(field,mode,document.getElementById('lengthOrigin').value==='below');
    panel.setAttribute('aria-labelledby',active.id);
    panel.innerHTML=`<p class="measurement-help-definition">${help.definition}</p><figure class="measurement-help-figure">${drawMeasurement(help.visual)}</figure><ol class="measurement-help-steps">${help.steps.map(text=>`<li>${text}</li>`).join('')}</ol><p class="measurement-help-note">${help.note}</p>`;
    if(focus)active.focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab.dataset.helpMethod));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next===undefined)return;
      event.preventDefault();select(tabs[next].dataset.helpMethod,true);
    });
  });
  select(initial);
}
