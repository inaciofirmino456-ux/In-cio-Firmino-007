const saved=JSON.parse(localStorage.getItem("boutique_demo_posts")||"[]");
const root=document.querySelector("#posts");
for(const p of saved){
  const a=document.createElement("article");
  a.className="card";
  a.innerHTML='<div class="visual" style="'+(p.image?'background:url('+JSON.stringify(p.image)+') center/cover':'')+'">'+(p.image?'':'NOVIDADE')+'</div><div class="card-body"><h3>'+safe(p.title)+'</h3><p>'+safe(p.description)+'</p></div>';
  root.prepend(a)
}
function safe(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
const menu=document.querySelector(".menu-toggle");
const nav=document.querySelector("#site-menu");
if(menu&&nav){
  menu.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menu.setAttribute("aria-expanded",String(open));
  });
  nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
}
