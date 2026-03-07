import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PaymentsApi } from '@/apis/payments.apis';
import { toast } from 'react-toastify';

export default function BatchDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadBatch = async () => {
    if (!id || Array.isArray(id)) return;
    setLoading(true);
    const data = await PaymentsApi.getBatch(token, router, id);
    setBatch(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBatch();
  }, [id]);

  const retryFailed = async () => {
    if (!id || Array.isArray(id)) return;
    const res = await PaymentsApi.retryFailed(token, router, id);
    if (res) {
      toast.success(`Retried ${res.retriedCount} payouts`);
      await loadBatch();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background text-gray-900 dark:text-white p-8">
        <p>Batch not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background text-gray-900 dark:text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Batch {batch.id}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status: {batch.status}</p>
          </div>
          <button
            onClick={retryFailed}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Retry Failed
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Processed</p>
            <p className="text-lg font-semibold">{batch.processedCount}</p>
          </div>
          <div className="p-4 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Failed</p>
            <p className="text-lg font-semibold">{batch.failedCount}</p>
          </div>
          <div className="p-4 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-semibold">{batch.totalCount}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Payouts</h2>
          <div className="space-y-2">
            {(batch.payouts || []).map((payout: any) => (
              <div key={payout.id} className="p-3 rounded border border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold">{payout.status}</div>
                <div className="text-xs text-gray-500">
                  {payout.correlationId || '-'} • INR {(payout.amountPaise / 100).toFixed(2)}
                </div>
                {payout.failureMessage && (
                  <div className="text-xs text-red-500 mt-1">{payout.failureMessage}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
