// Apply the saved appearance before the page paints.
(()=>{
 const key='sp_theme';
 const system=matchMedia('(prefers-color-scheme: dark)');
 let explicit=null;
 try{const saved=JSON.parse(localStorage.getItem('sp_workspace_v2'));const value=saved?.theme||localStorage.getItem(key);if(['parchment','indigo','midnight'].includes(value))explicit=value;}catch{try{explicit=localStorage.getItem(key);}catch{}}
 function apply(theme,notify=false){
  const dark=theme==='midnight'||theme==='indigo';
  const value=dark?'midnight':'parchment';
  document.documentElement.dataset.theme=value;
  const button=document.getElementById('themeToggle');
  if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');button.title=dark?'Switch to light mode':'Switch to dark mode';}
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#171717':'#ffffff';
  if(notify)document.dispatchEvent(new CustomEvent('appearance:change',{detail:{theme:value,external:false}}));
 }
 apply(explicit|| (system.matches?'midnight':'parchment'));
 document.addEventListener('appearance:apply',e=>apply(e.detail));
 document.addEventListener('DOMContentLoaded',()=>{
  apply(document.documentElement.dataset.theme);
  document.getElementById('themeToggle')?.addEventListener('click',()=>{
   explicit=document.documentElement.dataset.theme==='parchment'?'midnight':'parchment';
   try{localStorage.setItem(key,explicit);}catch{}
   apply(explicit,true);
  });
 });
 system.addEventListener('change',()=>{if(!explicit)apply(system.matches?'midnight':'parchment',true);});
 window.addEventListener('storage',e=>{if(e.key===key){explicit=e.newValue;apply(explicit||(system.matches?'midnight':'parchment'),true);}});
})();
