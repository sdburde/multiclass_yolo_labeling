from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import base64
from typing import List, Optional
import uvicorn

app = FastAPI(title="MultiLabel - Universal Annotation Tool")

# Get the package directory for static files
PACKAGE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(PACKAGE_DIR / "static")), name="static")


# ── Models ────────────────────────────────────────────────────────────────────

class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float
    class_id: int
    class_name: str
    conf: Optional[float] = None   # preserve confidence if present

class SaveLabelsRequest(BaseModel):
    folder: str
    filename: str
    labels: List[BBox]
    img_width: int
    img_height: int

class BrowseRequest(BaseModel):
    path: str

class SaveClassesRequest(BaseModel):
    folder: str
    classes: List[str]

class FolderLoadRequest(BaseModel):
    folder: str          # the session sub-folder (contains images + txts)


# ── Helpers ───────────────────────────────────────────────────────────────────

def read_classes(folder: Path) -> List[str]:
    cf = folder / "classes.txt"
    if cf.exists():
        lines = [l.strip() for l in cf.read_text().splitlines() if l.strip()]
        if lines:
            return lines
    return []

def write_classes(folder: Path, classes: List[str]):
    (folder / "classes.txt").write_text("\n".join(classes) + "\n")

def parse_yolo(txt_path: Path, classes: List[str]) -> List[dict]:
    """
    Supports both:
      5-value:  class cx cy bw bh
      6-value:  class cx cy bw bh conf   (Ultralytics auto-annotate)
    """
    boxes = []
    if not txt_path.exists():
        return boxes
    for line in txt_path.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        cid = int(float(parts[0]))
        cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        conf = float(parts[5]) if len(parts) >= 6 else None
        boxes.append({
            "class_id": cid,
            "class_name": classes[cid] if cid < len(classes) else f"class_{cid}",
            "cx": cx, "cy": cy, "bw": bw, "bh": bh,
            "conf": conf,
        })
    return boxes

def list_images(folder: Path) -> List[Path]:
    exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp",
            "*.JPG", "*.JPEG", "*.PNG", "*.BMP", "*.WEBP")
    imgs = []
    for ext in exts:
        imgs.extend(folder.glob(ext))
    return sorted(set(imgs), key=lambda p: p.name)

def scan_sessions(root: Path):
    """
    Detect whether root itself has images (flat layout) OR
    contains sub-folders with images (nested layout like annotated_tp).
    Returns list of session dicts.
    """
    sessions = []

    # Check direct images in root
    direct = list_images(root)
    if direct:
        classes = read_classes(root)
        labeled = sum(1 for img in direct
                      if (root / f"{img.stem}.txt").exists()
                      and (root / f"{img.stem}.txt").stat().st_size > 0)
        sessions.append({
            "folder": str(root),
            "name": root.name,
            "images": [img.name for img in direct],
            "classes": classes,
            "total": len(direct),
            "labeled": labeled,
        })
    else:
        # Walk sub-folders
        for sub in sorted(root.iterdir()):
            if not sub.is_dir() or sub.name.startswith("."):
                continue
            imgs = list_images(sub)
            if not imgs:
                continue
            classes = read_classes(sub)
            labeled = sum(1 for img in imgs
                          if (sub / f"{img.stem}.txt").exists()
                          and (sub / f"{img.stem}.txt").stat().st_size > 0)
            sessions.append({
                "folder": str(sub),
                "name": sub.name,
                "images": [img.name for img in imgs],
                "classes": classes,
                "total": len(imgs),
                "labeled": labeled,
            })

    return sessions


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return FileResponse(str(PACKAGE_DIR / "static" / "index.html"))


@app.post("/api/browse")
async def browse(req: BrowseRequest):
    """Directory browser — returns subdirs with image counts."""
    p = Path(req.path).expanduser().resolve() if req.path else Path.home()
    if not p.exists():
        p = Path.home()
    try:
        entries = []
        if p.parent != p:
            entries.append({"name": "..", "path": str(p.parent), "type": "parent"})

        for child in sorted(p.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            try:
                imgs = list_images(child)
                # also count images in immediate sub-folders (nested datasets)
                sub_img_total = sum(len(list_images(s)) for s in child.iterdir()
                                    if s.is_dir() and not s.name.startswith("."))
            except PermissionError:
                imgs = []; sub_img_total = 0
            entries.append({
                "name": child.name,
                "path": str(child),
                "type": "dir",
                "direct_images": len(imgs),
                "nested_images": sub_img_total,
                "has_images": len(imgs) > 0 or sub_img_total > 0,
            })

        direct = list_images(p)
        return {
            "current": str(p),
            "entries": entries,
            "direct_images": len(direct),
        }
    except PermissionError:
        raise HTTPException(403, "Permission denied")


@app.post("/api/load_dataset")
async def load_dataset(req: FolderLoadRequest):
    """
    Load a root folder. Auto-detects flat vs nested layout.
    Returns all sessions found.
    """
    root = Path(req.folder).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(404, f"Folder not found: {root}")

    sessions = scan_sessions(root)
    if not sessions:
        raise HTTPException(404, "No images found in this folder or its sub-folders")

    total_imgs = sum(s["total"] for s in sessions)
    total_labeled = sum(s["labeled"] for s in sessions)

    return {
        "root": str(root),
        "root_name": root.name,
        "sessions": sessions,
        "total_images": total_imgs,
        "total_labeled": total_labeled,
    }


@app.get("/api/image")
async def get_image(folder: str, filename: str):
    img_path = Path(folder) / filename
    if not img_path.exists():
        raise HTTPException(404, "Image not found")
    with open(img_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = img_path.suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    return {"data": f"data:{mime};base64,{data}"}


@app.get("/api/labels")
async def get_labels(folder: str, filename: str):
    fp = Path(folder)
    stem = Path(filename).stem
    classes = read_classes(fp)
    boxes = parse_yolo(fp / f"{stem}.txt", classes)
    return {"boxes": boxes, "classes": classes}


@app.post("/api/labels")
async def save_labels(req: SaveLabelsRequest):
    """
    Save labels. Writes 5-value YOLO (drops confidence on edit,
    preserves it only if unchanged — here we always write clean 5-value
    so edited annotations are standard YOLO).
    """
    fp = Path(req.folder)
    if not fp.exists():
        raise HTTPException(404, "Folder not found")
    stem = Path(req.filename).stem
    W, H = req.img_width, req.img_height
    lines = []
    for b in req.labels:
        cx = (b.x + b.w / 2) / W
        cy = (b.y + b.h / 2) / H
        bw = b.w / W
        bh = b.h / H
        # preserve conf if present (keep Ultralytics format intact)
        if b.conf is not None:
            lines.append(f"{b.class_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f} {b.conf:.4f}")
        else:
            lines.append(f"{b.class_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
    (fp / f"{stem}.txt").write_text("\n".join(lines))
    return {"saved": len(lines)}


@app.post("/api/save_classes")
async def save_classes(req: SaveClassesRequest):
    fp = Path(req.folder)
    if not fp.exists():
        raise HTTPException(404, "Folder not found")
    write_classes(fp, req.classes)
    return {"saved": len(req.classes)}


def run_server(host: str = "127.0.0.1", port: int = 7182, reload: bool = True):
    """Run the MultiLabel YOLO server."""
    uvicorn.run(
        "multilabel_yolo.server:app",
        host=host,
        port=port,
        reload=reload
    )
