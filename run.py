"""Chạy VPVie cục bộ:  python run.py  (mặc định http://127.0.0.1:8000)."""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("vpvie.server.app:app", host="127.0.0.1", port=port, reload=False)
