import json, os, urllib.request, urllib.error
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="FIRMI AI API", version="1.2.0")
app.mount("/static", StaticFiles(directory=ROOT), name="static")

DEFAULT_VIDEO_MODEL = "google/veo-3.1"
FAST_VIDEO_MODEL = "google/veo-3.1-fast"

MODEL_ALIASES = {
    "FIRMI Video Ultra": DEFAULT_VIDEO_MODEL,
    "FIRMI Video Fast": FAST_VIDEO_MODEL,
    "FIRMI Video Studio": DEFAULT_VIDEO_MODEL,
}

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=12000)
    model: str = Field(default="FIRMI Video Ultra", max_length=120)
    duration: int = Field(default=8)
    aspect_ratio: str = Field(default="16:9")
    quality: str = Field(default="Ultra")

def replicate(path, method="GET", payload=None):
    token = os.getenv("REPLICATE_API_TOKEN", "").strip()
    if not token:
        raise HTTPException(503, "REPLICATE_API_TOKEN não configurado no servidor.")
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.replicate.com/v1/" + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise HTTPException(e.code, detail[:1500])
    except urllib.error.URLError as e:
        raise HTTPException(502, f"Falha de ligação ao motor de vídeo: {e.reason}")

def selected_model(ui_model: str) -> str:
    configured = os.getenv("REPLICATE_VIDEO_MODEL", "").strip()
    if configured in (DEFAULT_VIDEO_MODEL, FAST_VIDEO_MODEL):
        return configured
    return MODEL_ALIASES.get(ui_model, DEFAULT_VIDEO_MODEL)

@app.get("/api/health")
def health():
    token = bool(os.getenv("REPLICATE_API_TOKEN", "").strip())
    return {
        "ok": True,
        "provider": "replicate" if token else "not_configured",
        "model": os.getenv("REPLICATE_VIDEO_MODEL") or DEFAULT_VIDEO_MODEL,
        "ready": token,
    }

@app.post("/api/generate")
def generate(body: GenerateRequest):
    if body.duration not in (4, 6, 8):
        raise HTTPException(400, "A duração deve ser 4, 6 ou 8 segundos.")
    if body.aspect_ratio not in ("16:9", "9:16"):
        raise HTTPException(400, "Formato suportado: 16:9 ou 9:16.")

    model = selected_model(body.model)
    resolution = "1080p" if body.quality.lower() == "ultra" else "720p"

    prediction = replicate(
        "models/" + model + "/predictions",
        "POST",
        {
            "input": {
                "prompt": body.prompt,
                "duration": body.duration,
                "aspect_ratio": body.aspect_ratio,
                "resolution": resolution,
                "generate_audio": True,
            }
        },
    )
    return {
        "id": prediction.get("id"),
        "status": prediction.get("status"),
        "model": model,
        "urls": prediction.get("urls", {}),
        "output": prediction.get("output"),
    }

@app.get("/api/generate/{prediction_id}")
def generation_status(prediction_id: str):
    result = replicate("predictions/" + prediction_id)
    return {
        "id": result.get("id"),
        "status": result.get("status"),
        "output": result.get("output"),
        "error": result.get("error"),
        "urls": result.get("urls", {}),
    }

@app.get("/")
def index():
    return FileResponse(ROOT / "fimai.html")
