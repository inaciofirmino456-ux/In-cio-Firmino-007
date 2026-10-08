import json, os, urllib.request, urllib.error
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="FIRMI AI API", version="1.0.0")
app.mount("/static", StaticFiles(directory=ROOT), name="static")

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=12000)
    model: str = Field(default="FIRMI Video Ultra", max_length=120)
    duration: int = Field(default=5, ge=1, le=30)
    aspect_ratio: str = Field(default="16:9")
    quality: str = Field(default="Ultra")

def replicate(path, method="GET", payload=None):
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise HTTPException(503, "REPLICATE_API_TOKEN não configurado.")
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.replicate.com/v1/" + path,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise HTTPException(e.code, detail[:1000])

@app.get("/api/health")
def health():
    return {"ok": True, "provider": "replicate" if os.getenv("REPLICATE_API_TOKEN") else "not_configured"}

@app.post("/api/generate")
def generate(body: GenerateRequest):
    # The actual provider model is selected by environment variable so FIRMI
    # can switch between compatible video models without changing the UI.
    model = os.getenv("REPLICATE_VIDEO_MODEL")
    if not model or "/" not in model:
        raise HTTPException(503, "REPLICATE_VIDEO_MODEL não configurado (ex.: owner/model).")
    payload = {
        "input": {
            "prompt": body.prompt,
            "duration": body.duration,
            "aspect_ratio": body.aspect_ratio,
            "quality": body.quality.lower(),
        }
    }
    prediction = replicate("models/" + model + "/predictions", "POST", payload)
    return {"id": prediction.get("id"), "status": prediction.get("status"), "urls": prediction.get("urls", {})}

@app.get("/api/generate/{prediction_id}")
def generation_status(prediction_id: str):
    result = replicate("predictions/" + prediction_id)
    output = result.get("output")
    return {"id": result.get("id"), "status": result.get("status"), "output": output, "error": result.get("error"), "urls": result.get("urls", {})}

@app.get("/")
def index():
    return FileResponse(ROOT / "fimai.html")
