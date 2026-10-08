const q=s=>document.querySelector(s),qa=s=>document.querySelectorAll(s);
function show(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth"})}
qa("[data-view]").forEach(b=>b.onclick=()=>show(b.dataset.view));
qa("[data-scroll]").forEach(b=>b.onclick=()=>show(b.dataset.scroll));
q("#menu").onclick=()=>{const n=document.querySelector("nav");n.style.display=n.style.display==="flex"?"none":"flex"};

async function poll(id){
  for(let i=0;i<180;i++){
    await new Promise(r=>setTimeout(r,2000));
    const r=await fetch("/api/generate/"+encodeURIComponent(id));
    const data=await r.json();
    if(!r.ok) throw new Error(data.detail||"Falha ao consultar a geração.");
    if(data.status==="succeeded"){
      const out=Array.isArray(data.output)?data.output[0]:data.output;
      if(out){q("#previewContent").innerHTML='<video controls autoplay loop playsinline src="'+out+'"></video><p>Vídeo gerado pelo motor FIRMI.</p>';return;}
      throw new Error("O motor terminou sem devolver um vídeo.");
    }
    if(data.status==="failed"||data.status==="canceled") throw new Error(data.error||"A geração foi interrompida.");
  }
  throw new Error("Tempo limite atingido.");
}

q("#generate").onclick=async()=>{
  const st=q("#runState"),p=q("#preview"),btn=q("#generate");
  const prompt=q("#prompt").value.trim();
  if(prompt.length<3){st.textContent="PROMPT";return;}
  st.textContent="RUNNING";btn.disabled=true;
  p.querySelector("#previewContent").innerHTML="<strong>GENERATING</strong><p>A criar o vídeo com o motor FIRMI…</p>";
  try{
    const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      prompt,model:q("#model").value,duration:Number(q("#duration").value),aspect_ratio:q("#format").value,quality:q("#quality").value
    })});
    const data=await r.json();
    if(!r.ok) throw new Error(data.detail||"Motor não configurado.");
    await poll(data.id);
    st.textContent="READY";
  }catch(e){
    st.textContent="ERROR";
    p.querySelector("#previewContent").innerHTML="<strong>ENGINE ERROR</strong><p>"+e.message+"</p>";
  }finally{btn.disabled=false;}
};
