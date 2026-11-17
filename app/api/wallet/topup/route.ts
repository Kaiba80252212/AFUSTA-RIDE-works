import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const channel = String(body.channel || 'Bank Transfer / Card');

    if (!Number.isFinite(amount) || amount < 100 || amount > 50000) {
      return NextResponse.json(
        { error: 'Top-up amount must be between ₦100 and ₦50,000' },
        { status: 400 }
      );
    }

    const result = await mutateDatabase((db) => {
      const user = db.users.find((u) => u.id === auth.user.id && u.role === 'STUDENT');
      if (!user) throw new Error('Student account not found');
      user.walletBalance = (user.walletBalance ?? 0) + Math.round(amount);
      const tx = {
        id: `tx-top-${Date.now()}`,
        userId: user.id,
        type: 'Top-Up' as const,
        amount: Math.round(amount),
        description: `Wallet Deposit via ${channel}`,
        createdAt: new Date().toISOString(),
        reference: `DEP-${Math.floor(100000 + Math.random() * 899999)}`,
      };
      db.transactions.unshift(tx);
      return { user: sanitizeUser(user), transaction: tx };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Wallet top-up failed' },
      { status: 400 }
    );
  }
}
