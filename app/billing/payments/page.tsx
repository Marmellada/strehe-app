// app/billing/payments/page.tsx
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowLeft, Filter } from 'lucide-react';
import { centsToEur } from '@/types/billing';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string; method?: string };
}) {
  const supabase = await createClient();

  // Build query with filters
  let query = supabase
    .from('payments')
    .select(`
      *,
      invoices (
        id,
        invoice_number,
        total_cents
      ),
      banks (
        id,
        name,
        account_number
      )
    `)
    .order('payment_date', { ascending: false });

  if (searchParams.method) {
    query = query.eq('payment_method', searchParams.method);
  }

  const { data: payments, error } = await query;

  if (error) {
    console.error('Error fetching payments:', error);
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-600">Error loading payments: {error.message}</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalPayments = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;
  const bankTransfers = payments?.filter(p => p.payment_method === 'bank_transfer').length || 0;
  const cashPayments = payments?.filter(p => p.payment_method === 'cash').length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Payment History</h1>
            <p className="text-muted-foreground mt-1">
              Track all received payments across invoices
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Total Payments</p>
          <p className="text-2xl font-bold mt-2">€{centsToEur(totalPayments).toFixed(2)}</p>
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Bank Transfers</p>
          <p className="text-2xl font-bold mt-2">{bankTransfers}</p>
        </div>
        <div className="border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Cash Payments</p>
          <p className="text-2xl font-bold mt-2">{cashPayments}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Link href="/billing/payments">
          <Badge variant={!searchParams.method ? 'default' : 'outline'}>
            All
          </Badge>
        </Link>
        <Link href="/billing/payments?method=bank_transfer">
          <Badge variant={searchParams.method === 'bank_transfer' ? 'default' : 'outline'}>
            Bank Transfer
          </Badge>
        </Link>
        <Link href="/billing/payments?method=cash">
          <Badge variant={searchParams.method === 'cash' ? 'default' : 'outline'}>
            Cash
          </Badge>
        </Link>
        <Link href="/billing/payments?method=credit_card">
          <Badge variant={searchParams.method === 'credit_card' ? 'default' : 'outline'}>
            Credit Card
          </Badge>
        </Link>
        <Link href="/billing/payments?method=other">
          <Badge variant={searchParams.method === 'other' ? 'default' : 'outline'}>
            Other
          </Badge>
        </Link>
      </div>

      {/* Payments Table */}
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Payment Date</th>
              <th className="text-left p-4 font-medium">Invoice #</th>
              <th className="text-left p-4 font-medium">Method</th>
              <th className="text-left p-4 font-medium">Bank</th>
              <th className="text-left p-4 font-medium">Reference</th>
              <th className="text-right p-4 font-medium">Amount</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments && payments.length > 0 ? (
              payments.map((payment) => (
                <tr key={payment.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link 
                      href={`/billing/${payment.invoice_id}`}
                      className="text-blue-600 hover:underline font-mono text-sm"
                    >
                      {payment.invoices?.invoice_number || 'N/A'}
                    </Link>
                  </td>
                  <td className="p-4">
                    <PaymentMethodBadge method={payment.payment_method} />
                  </td>
                  <td className="p-4">
                    {payment.banks?.name || 'N/A'}
                  </td>
                  <td className="p-4 font-mono text-sm">
                    {payment.reference_number || '—'}
                  </td>
                  <td className="p-4 text-right font-medium text-green-600">
                    €{centsToEur(payment.amount_cents).toFixed(2)}
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/billing/${payment.invoice_id}`}>
                      <Button variant="ghost" size="sm">
                        View Invoice
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No payments found. Payments will appear here once recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    other: 'Other',
  };

  return (
    <Badge variant="outline" className="capitalize">
      {labels[method] || method}
    </Badge>
  );
}
