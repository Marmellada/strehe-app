export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      banks: {
        Row: {
          country: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          swift_code: string | null
        }
        Insert: {
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          swift_code?: string | null
        }
        Update: {
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          swift_code?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          business_number: string | null
          city: string | null
          client_type: string
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          location_id: string | null
          municipality_id: string | null
          notes: string | null
          phone: string | null
          status: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_number?: string | null
          city?: string | null
          client_type: string
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          location_id?: string | null
          municipality_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_number?: string | null
          city?: string | null
          client_type?: string
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          location_id?: string | null
          municipality_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bank_accounts: {
        Row: {
          account_type: string
          account_name: string
          bank_id: string | null
          bank_name_snapshot: string | null
          created_at: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          show_on_invoice: boolean | null
          swift: string | null
        }
        Insert: {
          account_type?: string
          account_name: string
          bank_id?: string | null
          bank_name_snapshot?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          show_on_invoice?: boolean | null
          swift?: string | null
        }
        Update: {
          account_type?: string
          account_name?: string
          bank_id?: string | null
          bank_name_snapshot?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          show_on_invoice?: boolean | null
          swift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_bank_accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          appearance_theme: Json | null
          city: string | null
          company_name: string
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string | null
          vat_enabled: boolean | null
          vat_number: string | null
          vat_rate: number | null
        }
        Insert: {
          address?: string | null
          appearance_theme?: Json | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string | null
          vat_enabled?: boolean | null
          vat_number?: string | null
          vat_rate?: number | null
        }
        Update: {
          address?: string | null
          appearance_theme?: Json | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string | null
          vat_enabled?: boolean | null
          vat_number?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      inspection_lab_cases: {
        Row: {
          baseline_storage_path: string | null
          baseline_uploaded_at: string | null
          capture_type: string
          case_key: string
          comparison_summary: Json | null
          created_at: string | null
          created_by_user_id: string | null
          current_storage_path: string | null
          current_uploaded_at: string | null
          id: string
          last_uploaded_by_user_id: string | null
          report_generated_at: string | null
          report_markdown: string | null
          report_status: string
          room_type: string
          updated_at: string | null
        }
        Insert: {
          baseline_storage_path?: string | null
          baseline_uploaded_at?: string | null
          capture_type?: string
          case_key: string
          comparison_summary?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          current_storage_path?: string | null
          current_uploaded_at?: string | null
          id?: string
          last_uploaded_by_user_id?: string | null
          report_generated_at?: string | null
          report_markdown?: string | null
          report_status?: string
          room_type?: string
          updated_at?: string | null
        }
        Update: {
          baseline_storage_path?: string | null
          baseline_uploaded_at?: string | null
          capture_type?: string
          case_key?: string
          comparison_summary?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          current_storage_path?: string | null
          current_uploaded_at?: string | null
          id?: string
          last_uploaded_by_user_id?: string | null
          report_generated_at?: string | null
          report_markdown?: string | null
          report_status?: string
          room_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_lab_cases_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_lab_cases_last_uploaded_by_user_id_fkey"
            columns: ["last_uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          issue_date: string
          notes: string | null
          property_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
          user_id: string
          vat_amount_cents: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          issue_date?: string
          notes?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          user_id: string
          vat_amount_cents: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          issue_date?: string
          notes?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
          vat_amount_cents?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      key_logs: {
        Row: {
          action: string
          created_at: string | null
          from_status: string | null
          id: string
          key_id: string | null
          notes: string | null
          performed_by_user_id: string | null
          to_status: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          from_status?: string | null
          id?: string
          key_id?: string | null
          notes?: string | null
          performed_by_user_id?: string | null
          to_status?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          from_status?: string | null
          id?: string
          key_id?: string | null
          notes?: string | null
          performed_by_user_id?: string | null
          to_status?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_logs_performed_by_user_fk"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      keys: {
        Row: {
          created_at: string | null
          description: string | null
          holder_name: string | null
          holder_user_id: string | null
          id: string
          key_code: string
          key_type: string | null
          last_checked_out_at: string | null
          name: string
          property_id: string | null
          status: string | null
          storage_location: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          holder_name?: string | null
          holder_user_id?: string | null
          id?: string
          key_code?: string
          key_type?: string | null
          last_checked_out_at?: string | null
          name: string
          property_id?: string | null
          status?: string | null
          storage_location?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          holder_name?: string | null
          holder_user_id?: string | null
          id?: string
          key_code?: string
          key_type?: string | null
          last_checked_out_at?: string | null
          name?: string
          property_id?: string | null
          status?: string | null
          storage_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keys_holder_user_fk"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keys_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          municipality_id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipality_id: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          municipality_id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      package_services: {
        Row: {
          created_at: string | null
          id: string
          included_quantity: number
          package_id: string
          service_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          included_quantity?: number
          package_id: string
          service_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          included_quantity?: number
          package_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_services_package_fk"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_services_service_fk"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          monthly_price: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          bank_id: string | null
          company_account_id: string | null
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number: string | null
        }
        Insert: {
          amount_cents: number
          bank_id?: string | null
          company_account_id?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
        }
        Update: {
          amount_cents?: number
          bank_id?: string | null
          company_account_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_account_id_fkey"
            columns: ["company_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          resource: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          resource: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          resource?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          access_note: string | null
          address_line_1: string
          address_line_2: string | null
          city: string
          contract_end_date: string | null
          contract_start_date: string | null
          country: string | null
          created_at: string
          has_keys_in_office: boolean
          id: string
          key_access_note: string | null
          location_id: string | null
          location_text: string | null
          monthly_fee: number | null
          monthly_package_name: string | null
          municipality_id: string | null
          notes: string | null
          owner_client_id: string
          property_code: string
          property_contact_email: string | null
          property_contact_name: string | null
          property_contact_phone: string | null
          property_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          access_note?: string | null
          address_line_1: string
          address_line_2?: string | null
          city: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          created_at?: string
          has_keys_in_office?: boolean
          id?: string
          key_access_note?: string | null
          location_id?: string | null
          location_text?: string | null
          monthly_fee?: number | null
          monthly_package_name?: string | null
          municipality_id?: string | null
          notes?: string | null
          owner_client_id: string
          property_code?: string
          property_contact_email?: string | null
          property_contact_name?: string | null
          property_contact_phone?: string | null
          property_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          access_note?: string | null
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          country?: string | null
          created_at?: string
          has_keys_in_office?: boolean
          id?: string
          key_access_note?: string | null
          location_id?: string | null
          location_text?: string | null
          monthly_fee?: number | null
          monthly_package_name?: string | null
          municipality_id?: string | null
          notes?: string | null
          owner_client_id?: string
          property_code?: string
          property_contact_email?: string | null
          property_contact_name?: string | null
          property_contact_phone?: string | null
          property_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_fk"
            columns: ["owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number | null
          category: string
          created_at: string | null
          default_description: string | null
          default_priority: string
          default_title: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          category: string
          created_at?: string | null
          default_description?: string | null
          default_priority?: string
          default_title?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string
          created_at?: string | null
          default_description?: string | null
          default_priority?: string
          default_title?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          client_id: string
          created_at: string | null
          end_date: string | null
          id: string
          monthly_price: number | null
          notes: string | null
          package_id: string
          property_id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_price?: number | null
          notes?: string | null
          package_id: string
          property_id: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_price?: number | null
          notes?: string | null
          package_id?: string
          property_id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_package_fk"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_property_fk"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_client_id: string | null
          assigned_to_user_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          property_id: string
          reported_by_client_id: string | null
          reported_by_user_id: string | null
          service_id: string | null
          status: string
          subscription_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_client_id?: string | null
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          property_id: string
          reported_by_client_id?: string | null
          reported_by_user_id?: string | null
          service_id?: string | null
          status?: string
          subscription_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_client_id?: string | null
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          property_id?: string
          reported_by_client_id?: string | null
          reported_by_user_id?: string | null
          service_id?: string | null
          status?: string
          subscription_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fk"
            columns: ["assigned_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_fk"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reported_by_fk"
            columns: ["reported_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reported_by_user_id_fkey"
            columns: ["reported_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_service_fk"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subscription_fk"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          password_changed_at: string | null
          phone: string | null
          role: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          password_changed_at?: string | null
          phone?: string | null
          role: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          password_changed_at?: string | null
          phone?: string | null
          role?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      invoice_type: "standard" | "recurring"
      payment_method: "bank_transfer" | "cash"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      invoice_type: ["standard", "recurring"],
      payment_method: ["bank_transfer", "cash"],
    },
  },
} as const
