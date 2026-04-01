export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          name: string
          address: string
          type: string
          units_count: number
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          type: string
          units_count: number
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          type?: string
          units_count?: number
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      units: {
        Row: {
          id: string
          property_id: string
          unit_number: string
          tenant_id: string | null
          monthly_rent: number
          status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          unit_number: string
          tenant_id?: string | null
          monthly_rent: number
          status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          unit_number?: string
          tenant_id?: string | null
          monthly_rent?: number
          status?: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
          created_at?: string
          updated_at?: string
        }
      }
      tenants: {
        Row: {
          id: string
          property_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      banks: {
        Row: {
          id: string
          bank_name: string
          account_number: string
          iban: string | null
          swift: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bank_name: string
          account_number: string
          iban?: string | null
          swift?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bank_name?: string
          account_number?: string
          iban?: string | null
          swift?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          invoice_type: 'property_tenant' | 'client'
          property_id: string | null
          tenant_id: string | null
          client_id: string | null
          issue_date: string
          due_date: string
          payment_terms: string | null
          subtotal: number
          vat_amount: number
          total: number
          status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          notes: string | null
          bank_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          invoice_type: 'property_tenant' | 'client'
          property_id?: string | null
          tenant_id?: string | null
          client_id?: string | null
          issue_date: string
          due_date: string
          payment_terms?: string | null
          subtotal: number
          vat_amount: number
          total: number
          status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          notes?: string | null
          bank_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          invoice_type?: 'property_tenant' | 'client'
          property_id?: string | null
          tenant_id?: string | null
          client_id?: string | null
          issue_date?: string
          due_date?: string
          payment_terms?: string | null
          subtotal?: number
          vat_amount?: number
          total?: number
          status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          notes?: string | null
          bank_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          vat_rate: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          vat_rate: number
          line_total: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          vat_rate?: number
          line_total?: number
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: string
          reference_number: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: string
          reference_number?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          amount?: number
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'ADMIN' | 'PROPERTY_MANAGER' | 'TENANT'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          role: 'ADMIN' | 'PROPERTY_MANAGER' | 'TENANT'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'ADMIN' | 'PROPERTY_MANAGER' | 'TENANT'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
