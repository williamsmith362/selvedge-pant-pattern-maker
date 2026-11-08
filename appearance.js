// Shared by the calculator and guide; runs in the head to avoid a light flash.
(()=>{
 const key='sp_workspace_v2',themes=['parchment','indigo','midnight'];
 function readTheme(){
  try{
   const workspace=JSON.parse(localStorage.getItem(key));
   if(themes.includes(workspace?.theme))return workspace.theme;
  }catch{}
  try{const old=localStorage.getItem('sp_theme');if(themes.includes(old))return old;}catch{}
  return 'parchment';
 }
 function applyTheme(theme){
  if(!themes.includes(theme))theme='parchment';
  document.documentElement.dataset.theme=theme;
  const dark=theme!=='parchment',label=dark?'Switch to light mode':'Switch to dark mode';
  const button=document.getElementById('themeToggle');
  if(button){button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(dark));button.title=label;}
  const color=document.querySelector('meta[name=theme-color]');
  if(color)color.content=theme==='parchment'?'#f6f3ed':theme==='indigo'?'#111f2d':'#191b1c';
 }
 function notify(theme,external){
  applyTheme(theme);
  document.dispatchEvent(new CustomEvent('appearance:change',{detail:{theme,external}}));
 }
 applyTheme(readTheme());
 document.addEventListener('appearance:apply',event=>applyTheme(event.detail));
 document.addEventListener('DOMContentLoaded',()=>{
  applyTheme(document.documentElement.dataset.theme);
  document.getElementById('themeToggle')?.addEventListener('click',()=>{
   const theme=document.documentElement.dataset.theme==='parchment'?'midnight':'parchment';
   // Only the appearance setting changes; all saved draft data stays intact.
   try{localStorage.setItem('sp_theme',theme);}catch{}
   try{
    const workspace=JSON.parse(localStorage.getItem(key));
    if(workspace?.version===2){workspace.theme=theme;localStorage.setItem(key,JSON.stringify(workspace));}
   }catch{}
   notify(theme,false);
  });
 });
 function syncTheme(){const theme=readTheme();if(theme!==document.documentElement.dataset.theme)notify(theme,true);}
 window.addEventListener('storage',event=>{if(event.key===key||event.key==='sp_theme'||event.key===null)syncTheme();});
 window.addEventListener('pageshow',event=>{if(event.persisted)syncTheme();});
})();
