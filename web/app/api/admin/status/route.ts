import { NextResponse } from 'next/server';
import { getActivityLogStatus } from '@/lib/activityLog';
import { getMasterDataStatus } from '@/lib/masterData';

export async function GET() {
  try {
    const [masterData, activityLogs] = await Promise.all([
      getMasterDataStatus(),
      getActivityLogStatus(),
    ]);

    return NextResponse.json({
      masterData,
      activityLogs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: `관리자 상태를 불러오지 못했습니다: ${error}`,
    }, { status: 500 });
  }
}
