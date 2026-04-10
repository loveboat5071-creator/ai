"""설정 관리 — API 키, 파일 경로, 기본값"""
from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List


@dataclass
class Config:
    """전역 설정. 환경변수 또는 직접 주입으로 구성."""

    # ── API 키 ──────────────────────────────────────────────
    kakao_api_key: str = ""
    vworld_api_key: str = ""

    # ── 파일 경로 ──────────────────────────────────────────
    project_root: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)

    @property
    def master_excel_path(self) -> Path:
        return self.project_root / "엘리베이터TV 설치리스트(외부용)_260202.xlsx"

    @property
    def template_excel_path(self) -> Path:
        return self.project_root / "★포커스미디어 제안서 샘플★.xlsx"

    @property
    def geocode_cache_path(self) -> Path:
        return self.project_root / "focusmap" / "data" / "master_geocoded.parquet"

    # ── 기본값 ──────────────────────────────────────────────
    master_sheet_name: str = "서울생활권 동네상권정보"
    master_header_row: int = 3  # 0-indexed (엑셀 기준 4행)
    default_radii: List[float] = field(default_factory=lambda: [1.0, 1.5, 3.0])
    geocoding_provider: str = "kakao"  # "kakao" | "vworld"

    def __post_init__(self):
        # 환경변수에서 API 키 로드
        if not self.kakao_api_key:
            self.kakao_api_key = os.environ.get("KAKAO_API_KEY", "")
        if not self.vworld_api_key:
            self.vworld_api_key = os.environ.get("VWORLD_API_KEY", "")
        # data 디렉토리 보장
        self.geocode_cache_path.parent.mkdir(parents=True, exist_ok=True)
