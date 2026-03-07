import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { PaymentsApi, PayerStatus, Recipient, PaymentInstrument, Payout, PayoutBatch } from '@/apis/payments.apis';

const maskVpa = (hash?: string) => (hash ? `${hash.slice(0, 6)}...` : '');

export default function PaymentsPage() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const [payers, setPayers] = useState<PayerStatus[]>([]);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [instruments, setInstruments] = useState<PaymentInstrument[]>([]);
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [upiName, setUpiName] = useState('');

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);

  const selectedPayer = useMemo(
    () => payers.find((p) => p.id === selectedPayerId) || payers[0],
    [payers, selectedPayerId],
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const list = await PaymentsApi.listPayers(token, router);
      setPayers(list);
      if (list.length) {
        setSelectedPayerId(list[0].id);
      }
      setLoading(false);
    };
    if (token) fetchData();
  }, [token, router]);

  useEffect(() => {
    if (!selectedPayer?.id) return;
    const load = async () => {
      const [recipientList, payoutList, batchList] = await Promise.all([
        PaymentsApi.listRecipients(token, router, selectedPayer.id),
        PaymentsApi.listPayouts(token, router),
        PaymentsApi.listBatches(token, router),
      ]);
      setRecipients(recipientList);
      setPayouts(payoutList.items || []);
      setBatches(batchList.items || []);
      if (recipientList.length && !selectedRecipientId) {
        setSelectedRecipientId(recipientList[0].id);
      }
    };
    load();
  }, [selectedPayer?.id, token, router]);

  useEffect(() => {
    if (!selectedPayer?.id || !selectedRecipientId) return;
    const load = async () => {
      const list = await PaymentsApi.listInstruments(token, router, selectedPayer.id, selectedRecipientId);
      setInstruments(list);
    };
    load();
  }, [selectedRecipientId, selectedPayer?.id, token, router]);

  const connectProvider = async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    const res = await PaymentsApi.connectProvider(token, router, {
      providerName: 'razorpay',
      companyName,
    });
    if (res?.onboardingUrl) {
      toast.success('Provider connected');
      window.open(res.onboardingUrl, '_blank');
      const list = await PaymentsApi.listPayers(token, router);
      setPayers(list);
    }
  };

  const refreshStatus = async () => {
    if (!selectedPayer?.id) return;
    const refreshed = await PaymentsApi.getPayerStatus(token, router, selectedPayer.id, true);
    if (refreshed) {
      setPayers((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
    }
  };

  const addRecipient = async () => {
    if (!recipientName.trim()) {
      toast.error('Recipient name is required');
      return;
    }
    if (!selectedPayer?.id) return;
    const created = await PaymentsApi.createRecipient(token, router, selectedPayer.id, {
      name: recipientName,
      email: recipientEmail || undefined,
      phone: recipientPhone || undefined,
    });
    if (created) {
      toast.success('Recipient created');
      setRecipients((prev) => [created, ...prev]);
      setRecipientName('');
      setRecipientEmail('');
      setRecipientPhone('');
    }
  };

  const addBankInstrument = async () => {
    if (!selectedPayer?.id || !selectedRecipientId) return;
    if (!bankAccount || !bankIfsc || !bankName) {
      toast.error('Bank name, account number, and IFSC are required');
      return;
    }
    const created = await PaymentsApi.addBankInstrument(token, router, selectedPayer.id, selectedRecipientId, {
      accountNumber: bankAccount,
      ifsc: bankIfsc,
      name: bankName,
    });
    if (created) {
      toast.success('Bank instrument added');
      setInstruments((prev) => [created, ...prev]);
      setBankAccount('');
      setBankIfsc('');
      setBankName('');
    }
  };

  const addUpiInstrument = async () => {
    if (!selectedPayer?.id || !selectedRecipientId) return;
    if (!upiVpa || !upiName) {
      toast.error('UPI VPA and name are required');
      return;
    }
    const created = await PaymentsApi.addUpiInstrument(token, router, selectedPayer.id, selectedRecipientId, {
      vpa: upiVpa,
      name: upiName,
    });
    if (created) {
      toast.success('UPI instrument added');
      setInstruments((prev) => [created, ...prev]);
      setUpiVpa('');
      setUpiName('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Payments &amp; Payouts</h1>

        <section className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-800 mb-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Connect Provider</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect Razorpay to enable payouts from your account.</p>
            </div>
            {payers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-gray-400">Payer</span>
                <select
                  className="px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                  value={selectedPayer?.id}
                  onChange={(e) => setSelectedPayerId(e.target.value)}
                >
                  {payers.map((payer) => (
                    <option key={payer.id} value={payer.id}>
                      {payer.companyName || payer.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {payers.length === 0 ? (
            <div className="mt-4 flex flex-col gap-3 max-w-md">
              <input
                className="px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                placeholder="Company legal name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <button
                onClick={connectProvider}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Connect Razorpay
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">KYC Status</p>
                <p className="text-sm font-semibold">{selectedPayer?.kycStatus}</p>
              </div>
              <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">Onboarding Status</p>
                <p className="text-sm font-semibold">{selectedPayer?.onboardingStatus}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshStatus}
                  className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Recipients</h2>
            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                placeholder="Recipient name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              <input
                className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                placeholder="Email (optional)"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <input
                className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                placeholder="Phone (optional)"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              <button
                onClick={addRecipient}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Add Recipient
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {recipients.map((recipient) => (
                <button
                  key={recipient.id}
                  onClick={() => setSelectedRecipientId(recipient.id)}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    selectedRecipientId === recipient.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-semibold">{recipient.name}</div>
                  <div className="text-xs text-gray-500">{recipient.email || recipient.phone || 'No contact info'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Payment Instruments</h2>
            {selectedRecipientId ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Add Bank</p>
                  <input
                    className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                    placeholder="Account holder name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                  <input
                    className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                    placeholder="Account number"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                  <input
                    className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                    placeholder="IFSC"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value)}
                  />
                  <button
                    onClick={addBankInstrument}
                    className="px-4 py-2 rounded bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  >
                    Add Bank Instrument
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  <p className="text-sm font-semibold">Add UPI</p>
                  <input
                    className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                    placeholder="UPI VPA"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                  />
                  <input
                    className="w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-800"
                    placeholder="Name"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                  />
                  <button
                    onClick={addUpiInstrument}
                    className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800"
                  >
                    Add UPI Instrument
                  </button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold mb-2">Saved Instruments</p>
                  <div className="space-y-2">
                    {instruments.map((instrument) => (
                      <div key={instrument.id} className="p-3 rounded border border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-semibold uppercase">{instrument.type}</div>
                        {instrument.type === 'bank' ? (
                          <div className="text-xs text-gray-500">
                            {instrument.holderName} • ****{instrument.bankLast4} • {instrument.bankIfsc}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            {instrument.holderName} • {maskVpa(instrument.upiVpaHash)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Select a recipient to add instruments.</p>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-800 mb-8">
          <h2 className="text-lg font-semibold mb-4">Payout Monitoring</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold mb-2">Recent Payouts</h3>
              <div className="space-y-2">
                {payouts.map((payout) => (
                  <div key={payout.id} className="p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div className="text-sm font-semibold">{payout.status}</div>
                    <div className="text-xs text-gray-500">
                      INR {(payout.amountPaise / 100).toFixed(2)} • {payout.mode} • {payout.correlationId || '-'}
                    </div>
                  </div>
                ))}
                {!payouts.length && <p className="text-sm text-gray-500">No payouts yet.</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Batches</h3>
              <div className="space-y-2">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => router.push(`/payments/batches/${batch.id}`)}
                    className="w-full text-left p-3 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="text-sm font-semibold">{batch.status}</div>
                    <div className="text-xs text-gray-500">
                      {batch.processedCount}/{batch.totalCount} processed • {batch.failedCount} failed
                    </div>
                  </button>
                ))}
                {!batches.length && <p className="text-sm text-gray-500">No batches yet.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Bulk Payout Input Example</h2>
          <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-auto">
{`[
  {
    "recipient": { "name": "Asha", "email": "asha@demo.com" },
    "instrument": { "accountNumber": "1234567890", "ifsc": "HDFC0001234", "name": "Asha" },
    "amountPaise": 250000,
    "mode": "imps",
    "purpose": "vendor_payment",
    "correlationId": "sheet-row-1"
  }
]`}
          </pre>
        </section>
      </div>
    </div>
  );
}
