import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            STREHE Admin Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 border border-red-600 rounded hover:bg-red-50"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/dashboard" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">📊 Dashboard</h2>
              <p className="text-gray-600">Overview and analytics</p>
            </div>
          </Link>

          <Link href="/clients" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">👥 Clients</h2>
              <p className="text-gray-600">Manage your clients</p>
            </div>
          </Link>

          <Link href="/properties" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">🏠 Properties</h2>
              <p className="text-gray-600">Property management</p>
            </div>
          </Link>

          <Link href="/units" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">🚪 Units</h2>
              <p className="text-gray-600">Manage rental units</p>
            </div>
          </Link>

          <Link href="/tenants" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">🔑 Tenants</h2>
              <p className="text-gray-600">Tenant information</p>
            </div>
          </Link>

          <Link href="/leases" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">📄 Leases</h2>
              <p className="text-gray-600">Lease agreements</p>
            </div>
          </Link>

          <Link href="/tasks" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">✅ Tasks</h2>
              <p className="text-gray-600">Task management</p>
            </div>
          </Link>

          <Link href="/billing" className="block">
            <div className="bg-blue-600 text-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">💰 Billing</h2>
              <p className="text-blue-100">Invoices and payments</p>
            </div>
          </Link>

          <Link href="/invoices" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">🧾 Invoices</h2>
              <p className="text-gray-600">Invoice management</p>
            </div>
          </Link>

          <Link href="/payments" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">💳 Payments</h2>
              <p className="text-gray-600">Payment tracking</p>
            </div>
          </Link>

          <Link href="/banks" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">🏦 Banks</h2>
              <p className="text-gray-600">Bank accounts</p>
            </div>
          </Link>

          <Link href="/settings" className="block">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-semibold mb-2">⚙️ Settings</h2>
              <p className="text-gray-600">System configuration</p>
            </div>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Properties</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Active Leases</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Pending Tasks</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Monthly Revenue</p>
            <p className="text-3xl font-bold text-gray-900">$0</p>
          </div>
        </div>
      </main>
    </div>
  );
}