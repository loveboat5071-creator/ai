import { NextRequest } from 'next/server';

import { handleMiningEnrichOptions, handleMiningEnrichPost } from './shared';

export async function POST(req: NextRequest) {
  return handleMiningEnrichPost(req);
}

export async function OPTIONS() {
  return handleMiningEnrichOptions();
}
