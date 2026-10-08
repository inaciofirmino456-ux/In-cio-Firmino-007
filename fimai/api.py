import json, os, urllib.request, urllib.error
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="FIRMI AI API", version="1.1.0")
app.mount("/static", StaticFiles(directory=ROOT), name="static")

DEFAULT_VIDEO_MODEL = "bytedance/seedance-1-pro"
FAST_VIDEO_MODEL = "bytedance/seedance-1-pro-fast"

MODEL_ALIASES = {
    "FIRMI Video Ultra": DEFAULT_VIDEO_MODEL,
    "FIRMI Video Pro": FAST_VIDEO_MODEL,
}

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=12000)
    model: str = Field(default="FIRMI Video Ultra", max_length=120)
    duration: int = Field(default=5, ge=2, le=12)
    aspect_ratio: str = Field(default="16:9")
    quality: str = Field(default="Ultra")

def replicate(path, method="GET", payload=None):
    token = os.getenv("REPLICATE_API_TOKEN")
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
    # An explicit server-side model can override the default, while the UI
    # aliases always remain valid without another Render environment variable.
    configured = os.getenv("REPLICATE_VIDEO_MODEL", "").strip()
    if configured and "/" in configured:
        return configured
    return MODEL_ALIASES.get(ui_model, DEFAULT_VIDEO_MODEL)

@app.get("/api/health")
def health():
    return {
        "ok": True,
        "provider": "replicate" if os.getenv("REPLICATE_API_TOKEN") else "not_configured",
        "model": os.getenv("REPLICATE_VIDEO_MODEL") or DEFAULT_VIDEO_MODEL,
    }

@app.post("/api/generate")
def generate(body: GenerateRequest):
    model = selected_model(body.model)
    quality = body.quality.lower()
    resolution = "1080p" if quality == "ultra" else "480p"

    payload = {
        "input": {
            "prompt": body.prompt,
            "duration": body.duration,
            "aspect_ratio": body.aspect_ratio,
            "resolution": resolution,
            "fps": 24,
            "camera_fixed": False,
        }
    }

    prediction = replicate(
        "models/" + model + "/predictions",
        "POST",
        payload,
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
    output = result.get("output")
    return {
        "id": result.get("id"),
        "status": result.get("status"),
        "output": output,
        "error": result.get("error"),
        "urls": result.get("urls", {}),
    }

@app.get("/")
def index():
    return FileResponse(ROOT / "fimai.html")
