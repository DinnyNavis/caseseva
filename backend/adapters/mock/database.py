import json
import os
from pathlib import Path
from threading import Lock
from typing import Any

from ..database import DatabaseAdapter


class MockDatabaseAdapter(DatabaseAdapter):
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path or os.getenv("MOCK_DATABASE_PATH", ".localdev/database.json"))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self.path.exists():
            self.path.write_text(json.dumps({}, indent=2), encoding="utf-8")

    def _read(self) -> dict[str, dict[str, dict[str, Any]]]:
        if not self.path.exists():
            self.path.write_text(json.dumps({}, indent=2), encoding="utf-8")
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, data: dict[str, dict[str, dict[str, Any]]]) -> None:
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def create(self, collection: str, record: dict[str, Any]) -> dict[str, Any]:
        record_id = str(record["id"])
        with self._lock:
            data = self._read()
            bucket = data.setdefault(collection, {})
            if record_id in bucket:
                raise ValueError(f"Record already exists: {record_id}")
            bucket[record_id] = dict(record)
            self._write(data)
        return dict(record)

    def get(self, collection: str, record_id: str) -> dict[str, Any] | None:
        with self._lock:
            record = self._read().get(collection, {}).get(record_id)
            return dict(record) if record else None

    def update(self, collection: str, record_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            data = self._read()
            record = data.get(collection, {}).get(record_id)
            if record is None:
                raise KeyError(record_id)
            record.update(changes)
            self._write(data)
            return dict(record)

    def delete(self, collection: str, record_id: str) -> bool:
        with self._lock:
            data = self._read()
            deleted = record_id in data.get(collection, {})
            if deleted:
                del data[collection][record_id]
                self._write(data)
            return deleted

    def list(self, collection: str) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(record) for record in self._read().get(collection, {}).values()]
