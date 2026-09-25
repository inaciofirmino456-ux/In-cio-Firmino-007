const saved=JSON.parse(localStorage.getItem("boutique_demo_posts")||"[]");
const root=document.querySelector("#posts");
for(const p of saved){
  const a=document.createElement("article");
  a.className="card";
  const image=p.image?'<img class="card-image" src="'+safe(p.image)+'" alt="'+safe(p.title)+'" loading="lazy">':'<div class="card-image" style="display:grid;place-items:center;background:#d8cbbb">NOVIDADE</div>';
  a.innerHTML=image+'<div class="card-body"><span class="card-kicker">NOVIDADE</span><h3>'+safe(p.title)+'</h3><p>'+safe(p.description)+'</p></div>';
  root.prepend(a);
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
