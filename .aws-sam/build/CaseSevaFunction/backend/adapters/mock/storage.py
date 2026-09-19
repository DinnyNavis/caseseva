import os
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote

from ..storage import StorageAdapter


class MockStorageAdapter(StorageAdapter):
    def __init__(self, root: str | Path | None = None):
        self.root = Path(root or os.getenv("MOCK_STORAGE_PATH", ".localdev/uploads"))
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        safe_key = Path(key)
        if safe_key.is_absolute() or ".." in safe_key.parts:
            raise ValueError("Invalid storage key")
        path = self.root / safe_key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def upload(self, key: str, content: bytes | BinaryIO, content_type: str = "application/octet-stream") -> str:
        data = content if isinstance(content, bytes) else content.read()
        self._path(key).write_bytes(data)
        return f"local://uploads/{quote(key)}"

    def download(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def list(self, prefix: str = "") -> list[str]:
        return [
            path.relative_to(self.root).as_posix()
            for path in self.root.rglob("*")
            if path.is_file() and path.relative_to(self.root).as_posix().startswith(prefix)
        ]
