/**
 * master.json 좌표 재검증 + 카카오 재지오코딩
 * 
 * Usage: KAKAO_API_KEY=xxx node scripts/regeocode.js
 * 
 * 도로명주소(addr_road)로 카카오 주소검색 → 좌표 업데이트
 * Rate limit: 초당 10건 (카카오 제한)
 */

const fs = require('fs');
const path = require('path');

const KAKAO_KEY = process.env.KAKAO_API_KEY;
if (!KAKAO_KEY) {
  console.error('KAKAO_API_KEY 환경변수 필요!');
  process.exit(1);
}

async function geocodeAddress(address) {
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data = await resp.json();
  const docs = data.documents || [];
  if (docs.length > 0) {
    return {
      lat: parseFloat(docs[0].y),
      lng: parseFloat(docs[0].x),
      source: 'kakao_address',
    };
  }

  // 주소검색 실패 시 키워드검색
  const url2 = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`;
  const resp2 = await fetch(url2, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const data2 = await resp2.json();
  const docs2 = data2.documents || [];
  if (docs2.length > 0) {
    return {
      lat: parseFloat(docs2[0].y),
      lng: parseFloat(docs2[0].x),
      source: 'kakao_keyword',
    };
  }

  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'master.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`Total entries: ${data.length}`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const addr = entry.addr_road || '';

    if (!addr) {
      skipped++;
      continue;
    }

    try {
      const result = await geocodeAddress(addr);
      if (result) {
        const oldLat = entry.lat;
        const oldLng = entry.lng;
        entry.lat = result.lat;
        entry.lng = result.lng;

        const diff = Math.sqrt(
          Math.pow(result.lat - oldLat, 2) + Math.pow(result.lng - oldLng, 2)
        );

        if (diff > 0.001) {
          updated++;
          if (updated <= 20) {
            console.log(`  ✅ ${entry.name} | ${entry.dong} | ${oldLat},${oldLng} → ${result.lat},${result.lng} (diff=${diff.toFixed(5)}, ${result.source})`);
          }
        }
      } else {
        failed++;
        if (failed <= 10) {
          console.log(`  ❌ ${entry.name}: 좌표 못찾음 (${addr})`);
        }
        errors.push(entry.name);
      }
    } catch (e) {
      failed++;
      if (failed <= 10) {
        console.log(`  ❌ ${entry.name}: 에러 - ${e.message}`);
      }
    }

    // Rate limit: 100ms between requests (10/sec)
    if (i % 10 === 0) {
      await sleep(1100);
      if (i % 100 === 0) {
        process.stdout.write(`\r  Progress: ${i}/${data.length} (updated: ${updated}, failed: ${failed})`);
      }
    } else {
      await sleep(100);
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped (no addr): ${skipped}`);

  // Save
  const outPath = filePath;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main().catch(console.error);
