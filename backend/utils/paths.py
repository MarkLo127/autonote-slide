from pathlib import Path

root = Path(__file__).resolve().parents[1]
uploads_dir = root / "storage" / "uploads"
outputs_dir = root / "storage" / "outputs"

def ensure_dirs():
    uploads_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

def with_outputs(name: str) -> Path:
    return (outputs_dir / name).resolve()
