// app/billing/page.tsx

import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { centsToEur, type InvoiceStatus } from '@/types/billing';

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      *,
      properties (
        id,
        name
      ),
      profiles:user_id (
        id,
        full_name,
        email
      )
    `)
    .order('issue_date', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-600">Error loading invoices</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage invoices and payments
          </p>
        </div>
        <Link href="/billing/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Invoices Table */}
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Invoice #</th>
              <th className="text-left p-4 font-medium">Property</th>
              <th className="text-left p-4 font-medium">Tenant</th>
              <th className="text-left p-4 font-medium">Issue Date</th>
              <th className="text-left p-4 font-medium">Due Date</th>
              <th className="text-right p-4 font-medium">Amount</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t hover:bg-muted/30">
                  <td className="p-4 font-mono text-sm">
                    {invoice.invoice_number}
                  </td>
                  <td className="p-4">{invoice.properties?.name || 'N/A'}</td>
                  <td className="p-4">
                    {invoice.profiles?.full_name || invoice.profiles?.email || 'N/A'}
                  </td>
                  <td className="p-4">
                    {new Date(invoice.issue_date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right font-medium">
                    €{centsToEur(invoice.total_cents).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/billing/${invoice.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No invoices found. Create your first invoice to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const variants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    sent: 'outline',
    paid: 'default',
    overdue: 'destructive',
    cancelled: 'secondary',
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
}
