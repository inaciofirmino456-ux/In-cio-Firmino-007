const $=(s)=>document.querySelector(s), $$=(s)=>document.querySelectorAll(s);
const sections={studio:".workspace",models:"#models",training:"#training",docs:"#docs"};
function showView(view){
  $$(".view-section").forEach(x=>x.classList.add("hidden"));
  if(view==="studio") $(".workspace").scrollIntoView({behavior:"smooth",block:"start"});
  else {$(sections[view]).classList.remove("hidden");$(sections[view]).scrollIntoView({behavior:"smooth",block:"start"});}
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
}
$$(".nav-btn").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-scroll]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth"})));
$$(".type").forEach(b=>b.addEventListener("click",()=>{$$(".type").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#metaType").textContent=b.dataset.type.toUpperCase()+" · 16:9";$("#model").value=b.dataset.type==="video"?"FIRMI Motion · Coming soon":"FIRMI Vision · Preview"}));
$("#generate").addEventListener("click",()=>{
 const btn=$("#generate"),canvas=$("#canvas"),status=$("#outputStatus");
 const prompt=$("#prompt").value.trim();
 if(!prompt){$("#prompt").focus();return}
 btn.disabled=true;btn.textContent="Preparing…";status.textContent="RUNNING";
 canvas.classList.add("loading");
 setTimeout(()=>{btn.disabled=false;btn.innerHTML='Generate <span>✦</span>';status.textContent="PREVIEW";canvas.classList.remove("loading");canvas.querySelector(".canvas-copy").innerHTML="<strong>Experiment ready.</strong><span>Connect a model + GPU endpoint to generate the real output.</span>";},900);
});
$$(".side-btn").forEach(b=>b.addEventListener("click",()=>{$$(".side-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
document.querySelector(".menu")?.addEventListener("click",()=>{const nav=document.querySelector("nav");nav.style.display=nav.style.display==="flex"?"none":"flex";nav.style.position="absolute";nav.style.top="60px";nav.style.right="15px";nav.style.background="#101014";nav.style.padding="8px";nav.style.flexDirection="column";nav.style.border="1px solid #25252d";nav.style.borderRadius="10px"});
