import os
import logging
from datetime import datetime, timezone

from fastapi import UploadFile

from backend.app.core.config import UPLOAD_DIR, STATIC_MOUNT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def save_upload(content: bytes, filename: str) -> str:
    # ✅ 用到時才建
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    _, ext = os.path.splitext(filename)
    path = os.path.join(UPLOAD_DIR, f"up_{ts}{ext}")
    
    logger.info(f"Saving uploaded file to: {path}")
    try:
        with open(path, "wb") as f:
            logger.info("Writing content to disk.")
            f.write(content)
            logger.info("Finished writing content to disk.")
            
    except Exception as e:
        logger.error(f"Error during file save: {e}", exc_info=True)
        raise
    
    return path

def make_public_url(abs_path: str) -> str:
    # e.g. storage/wordclouds/xxx.png -> /static/wordclouds/xxx.png
    rel = abs_path.replace("\\", "/").split("storage/")[-1]
    return f"{STATIC_MOUNT}/{rel}"
