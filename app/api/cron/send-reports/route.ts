import { NextRequest, NextResponse } from 'next/server';
import { listStores } from '@/lib/stores';
import { getDayLedger } from '@/lib/movements';
import { formatReportMessage, sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
import { todayISOCaracas } from '@/lib/date';

export const dynamic = 'force-dynamic';

interface SendResult {
  slug: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = todayISOCaracas();
  const stores = await listStores();
  const results: SendResult[] = [];

  for (const store of stores) {
    if (!store.telegram_chat_id) {
      results.push({ slug: store.slug, status: 'skipped' });
      continue;
    }

    try {
      const showCop = store.slug === 'san-cristobal';
      const ledger = await getDayLedger(store.id, date);
      const caption = formatReportMessage(store.name, date, ledger, undefined, showCop);
      const imageBuffer = await generateReportImageBuffer(store.name, date, ledger, undefined, showCop);
      await sendTelegramPhoto(store.telegram_chat_id, imageBuffer, caption, store.telegram_thread_id);
      results.push({ slug: store.slug, status: 'sent' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Failed to send Telegram report for ${store.slug}:`, error);
      results.push({ slug: store.slug, status: 'failed', error });
    }
  }

  console.log('Telegram cron report results:', JSON.stringify({ date, results }));
  return NextResponse.json({ date, results });
}
