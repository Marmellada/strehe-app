import { createClient } from '@/lib/supabase/server'

export default async function TestDBPage() {
  const supabase = await createClient()
  
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .limit(5)

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">❌ Database Error</h1>
        <pre className="mt-4 p-4 bg-red-50 rounded">{error.message}</pre>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-green-600">✅ Database Connected!</h1>
      <p className="mt-2">Found {properties?.length || 0} properties</p>
    </div>
  )
}
