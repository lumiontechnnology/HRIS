import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      success: false,
      error: 'Deprecated endpoint. Use /api/auth/onboarding for tenant-safe onboarding operations.',
    },
    { status: 410 }
  );
}
