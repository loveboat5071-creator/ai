"""포커스미디어 지오코더 유틸리티 CLI."""
from __future__ import annotations

import argparse

from .config import Config
from .geocoder import geocode


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description='Focusmap lightweight CLI')
  parser.add_argument('--version', action='store_true', help='현재 패키지 버전 출력')
  parser.add_argument('address', nargs='?', help='좌표 변환할 주소')
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  if args.version:
    print('focusmap 1.0.0')
    return

  if not args.address:
    print('usage: python -m focusmap <주소>')
    return

  config = Config()
  result = geocode(args.address, config.kakao_api_key, config.vworld_api_key, config.geocoding_provider)
  if result:
    lat, lng = result
    print(f'{lat:.6f},{lng:.6f}')
  else:
    print('좌표를 찾지 못했습니다.')


if __name__ == '__main__':
  main()
