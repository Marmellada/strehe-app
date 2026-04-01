// app/billing/[id]/page.tsx

import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge'; 
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import {
  centsToEur,
  amountPaidCents,
  balanceDueCents,
  type InvoiceStatus,
  type InvoiceWithRelations,
} from '@/types/billing';
import { DeleteInvoiceButton } from '@/components/billing/DeleteInvoiceButton';
import { UpdateInvoiceStatusButton } from '@/components/billing/UpdateInvoiceStatusButton';

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      properties (
        id,
        name,
        address_line_1,
        address_line_2,
        city,
        postal_code,
        country
      ),
      clients (
        id,
        full_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        city,
        postal_code,
        country
      ),
      invoice_items (
        id,
        description,
        quantity,
        unit_price_cents,
        vat_rate,
        total_cents
      ),
      payments (
        id,
        amount_cents,
        payment_date,
        payment_method,
        reference_number,
        banks (
          id,
          name,
          account_number
        )
      )
    `)
    .eq('id', params.id)
    .single();

  if (error || !invoice) {
    notFound();
  }

  // Fetch general settings for company address
  const { data: settings } = await supabase
    .from('general_settings')
    .select('company_name, company_address, company_city, company_postal_code, company_country, company_email, company_phone, company_vat_number')
    .single();

  const typedInvoice = invoice as unknown as InvoiceWithRelations;
  const amountPaid = amountPaidCents(typedInvoice.payments);
  const balanceDue = balanceDueCents(typedInvoice, typedInvoice.payments);

  // Helper to format address
  const formatAddress = (data: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  }) => {
    return [
      data.address_line_1,
      data.address_line_2,
      data.city,
      data.postal_code,
      data.country
    ].filter(Boolean).join(', ');
  };

  // Determine customer info based on invoice type
  const customerInfo = typedInvoice.invoice_type === 'client' 
    ? {
        name: typedInvoice.clients?.full_name || 'N/A',
        email: typedInvoice.clients?.email,
        phone: typedInvoice.clients?.phone,
        address: typedInvoice.clients ? formatAddress(typedInvoice.clients) : 'N/A'
      }
    : {
        name: typedInvoice.properties?.name || 'N/A',
        email: 'N/A',
        phone: 'N/A',
        address: typedInvoice.properties ? formatAddress(typedInvoice.properties) : 'N/A'
      };

  // Company info from settings
  const companyAddress = settings ? [
    settings.company_address,
    settings.company_city,
    settings.company_postal_code,
    settings.company_country
  ].filter(Boolean).join(', ') : 'Not configured';

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
            <h1 className="text-3xl font-bold">{typedInvoice.invoice_number}</h1>
            <p className="text-muted-foreground mt-1">
              {typedInvoice.invoice_type === 'client' ? 'Client Invoice' : 'Property Invoice'}
            </p>
          </div>
          <StatusBadge status={typedInvoice.status} />
        </div>
        <div className="flex items-center gap-2">
          {typedInvoice.status === 'draft' && (
            <>
              <Link href={`/billing/${typedInvoice.id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <DeleteInvoiceButton invoiceId={typedInvoice.id} />
            </>
          )}
          {typedInvoice.status !== 'paid' && typedInvoice.status !== 'cancelled' && (
            <Link href={`/billing/${typedInvoice.id}/payment`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Management */}
      {typedInvoice.status === 'draft' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-3">
            This invoice is in draft status. Mark it as sent when ready.
          </p>
          <UpdateInvoiceStatusButton invoiceId={typedInvoice.id} newStatus="sent" />
        </div>
      )}

      {/* Invoice Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* From (Company) */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">From</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{settings?.company_name || 'Company Name'}</p>
            <p className="text-muted-foreground">{companyAddress}</p>
            {settings?.company_email && (
              <p className="text-muted-foreground">{settings.company_email}</p>
            )}
            {settings?.company_phone && (
              <p className="text-muted-foreground">{settings.company_phone}</p>
            )}
            {settings?.company_vat_number && (
              <p className="text-muted-foreground">VAT: {settings.company_vat_number}</p>
            )}
          </div>
        </div>

        {/* To (Customer) */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">
            Bill To ({typedInvoice.invoice_type === 'client' ? 'Client' : 'Property'})
          </h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{customerInfo.name}</p>
            <p className="text-muted-foreground">{customerInfo.address}</p>
            {customerInfo.email !== 'N/A' && (
              <p className="text-muted-foreground">{customerInfo.email}</p>
            )}
            {customerInfo.phone !== 'N/A' && customerInfo.phone && (
              <p className="text-muted-foreground">{customerInfo.phone}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">Dates</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Issue Date</p>
              <p className="font-medium">
                {new Date(typedInvoice.issue_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {new Date(typedInvoice.due_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">Financial Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>€{centsToEur(typedInvoice.subtotal_cents).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT ({typedInvoice.vat_rate}%)</span>
              <span>€{centsToEur(typedInvoice.vat_amount_cents).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Total</span>
              <span>€{centsToEur(typedInvoice.total_cents).toFixed(2)}</span>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-green-600 pt-2">
                <span>Amount Paid</span>
                <span>€{centsToEur(amountPaid).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                €{centsToEur(balanceDue).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-lg">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-right p-3 font-medium">Quantity</th>
                <th className="text-right p-3 font-medium">Unit Price</th>
                <th className="text-right p-3 font-medium">VAT</th>
                <th className="text-right p-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {typedInvoice.invoice_items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.description}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">
                    €{centsToEur(item.unit_price_cents).toFixed(2)}
                  </td>
                  <td className="p-3 text-right">{item.vat_rate}%</td>
                  <td className="p-3 text-right font-medium">
                    €{centsToEur(item.total_cents).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      {typedInvoice.payments.length > 0 && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">Payment History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Bank</th>
                  <th className="text-left p-3 font-medium">Reference</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {typedInvoice.payments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="p-3">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="p-3 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                    <td className="p-3">{payment.banks?.name || 'N/A'}</td>
                    <td className="p-3 font-mono text-sm">
                      {payment.reference_number || '—'}
                    </td>
                    <td className="p-3 text-right font-medium text-green-600">
                      €{centsToEur(payment.amount_cents).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {typedInvoice.notes && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-lg">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {typedInvoice.notes}
          </p>
        </div>
      )}
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

  return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
}
