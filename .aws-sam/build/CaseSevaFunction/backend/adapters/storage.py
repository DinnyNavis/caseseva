from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageAdapter(ABC):
    @abstractmethod
    def upload(self, key: str, content: bytes | BinaryIO, content_type: str = "application/octet-stream") -> str:
        raise NotImplementedError

    @abstractmethod
    def download(self, key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def list(self, prefix: str = "") -> list[str]:
        raise NotImplementedError
