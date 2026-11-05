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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _orphan_wifi_entries: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          created_at: string
          end_date: string
          id: string
          period_name: string
          start_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          end_date: string
          id?: string
          period_name: string
          start_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          end_date?: string
          id?: string
          period_name?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      asset_depreciation: {
        Row: {
          amount: number
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          journal_id: string | null
          period_date: string
        }
        Insert: {
          amount: number
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          period_date: string
        }
        Update: {
          amount?: number
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          period_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciation_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          disposal_date: string
          gain_loss: number
          id: string
          journal_id: string | null
          method: Database["public"]["Enums"]["disposal_method"]
          net_book_value: number
          notes: string | null
          proceeds: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          disposal_date?: string
          gain_loss?: number
          id?: string
          journal_id?: string | null
          method?: Database["public"]["Enums"]["disposal_method"]
          net_book_value?: number
          notes?: string | null
          proceeds?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          disposal_date?: string
          gain_loss?: number
          id?: string
          journal_id?: string | null
          method?: Database["public"]["Enums"]["disposal_method"]
          net_book_value?: number
          notes?: string | null
          proceeds?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          journal_id: string | null
          next_service_date: string | null
          provider: string | null
          service_date: string
        }
        Insert: {
          asset_id: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          journal_id?: string | null
          next_service_date?: string | null
          provider?: string | null
          service_date?: string
        }
        Update: {
          asset_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          journal_id?: string | null
          next_service_date?: string | null
          provider?: string | null
          service_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_history: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          file_name: string
          id: string
          kind: string
          row_count: number | null
          size_bytes: number | null
          status: string
          table_count: number | null
          target: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_name: string
          id?: string
          kind: string
          row_count?: number | null
          size_bytes?: number | null
          status?: string
          table_count?: number | null
          target: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_name?: string
          id?: string
          kind?: string
          row_count?: number | null
          size_bytes?: number | null
          status?: string
          table_count?: number | null
          target?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: Json
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          id: string
          invoice_item_id: string | null
          is_service: boolean
          product_id: string
          product_name: string
          quantity: number
          restore_batch_id: string | null
          restored_to_stock: boolean
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          id?: string
          invoice_item_id?: string | null
          is_service?: boolean
          product_id: string
          product_name: string
          quantity: number
          restore_batch_id?: string | null
          restored_to_stock?: boolean
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          id?: string
          invoice_item_id?: string | null
          is_service?: boolean
          product_id?: string
          product_name?: string
          quantity?: number
          restore_batch_id?: string | null
          restored_to_stock?: boolean
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note_number: string
          customer_id: string
          id: string
          invoice_id: string
          last_reprinted_at: string | null
          reason: string | null
          refund_amount: number
          refund_method: Database["public"]["Enums"]["credit_note_refund_method"]
          reprint_count: number
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          customer_id: string
          id?: string
          invoice_id: string
          last_reprinted_at?: string | null
          reason?: string | null
          refund_amount?: number
          refund_method?: Database["public"]["Enums"]["credit_note_refund_method"]
          reprint_count?: number
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          last_reprinted_at?: string | null
          reason?: string | null
          refund_amount?: number
          refund_method?: Database["public"]["Enums"]["credit_note_refund_method"]
          reprint_count?: number
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          credit_terms: number
          current_balance: number
          customer_code: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          debt_limit: number
          email: string | null
          id: string
          is_suspended: boolean
          kra_pin: string | null
          location: string | null
          name: string
          phone: string | null
          total_spent: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          credit_terms?: number
          current_balance?: number
          customer_code?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          debt_limit?: number
          email?: string | null
          id?: string
          is_suspended?: boolean
          kra_pin?: string | null
          location?: string | null
          name: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          credit_terms?: number
          current_balance?: number
          customer_code?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          debt_limit?: number
          email?: string | null
          id?: string
          is_suspended?: boolean
          kra_pin?: string | null
          location?: string | null
          name?: string
          phone?: string | null
          total_spent?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          expense_no: string | null
          id: string
          journal_id: string | null
          payment_account_id: string | null
          payment_method: string | null
          reference_no: string | null
          status: string
          supplier_id: string | null
          vat_amount: number
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_no?: string | null
          id?: string
          journal_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          reference_no?: string | null
          status?: string
          supplier_id?: string | null
          vat_amount?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_no?: string | null
          id?: string
          journal_id?: string | null
          payment_account_id?: string | null
          payment_method?: string | null
          reference_no?: string | null
          status?: string
          supplier_id?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "expenses_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          asset_no: string
          category: Database["public"]["Enums"]["asset_category"]
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          journal_id: string | null
          location: string | null
          name: string
          notes: string | null
          purchase_cost: number
          purchase_date: string
          salvage_value: number
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: string | null
          updated_at: string
          useful_life_years: number
          warranty_expiry: string | null
        }
        Insert: {
          accumulated_depreciation?: number
          asset_no: string
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          journal_id?: string | null
          location?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string
          salvage_value?: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          useful_life_years?: number
          warranty_expiry?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_no?: string
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          journal_id?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string
          salvage_value?: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          useful_life_years?: number
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_return_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          return_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          return_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          return_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_return_attachments_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "goods_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_return_items: {
        Row: {
          condition_note: string | null
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total: number
          unit_value: number
        }
        Insert: {
          condition_note?: string | null
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total?: number
          unit_value?: number
        }
        Update: {
          condition_note?: string | null
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          return_id?: string
          total?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "goods_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_returns: {
        Row: {
          adjustment_id: string | null
          created_at: string
          created_by: string | null
          credit_note_id: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          journal_id: string | null
          kind: Database["public"]["Enums"]["return_kind"]
          notes: string | null
          purchase_id: string | null
          reason: Database["public"]["Enums"]["return_reason"]
          resolution: Database["public"]["Enums"]["return_resolution"]
          restock: boolean
          return_date: string
          rma_no: string
          status: Database["public"]["Enums"]["return_status"]
          supplier_id: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          adjustment_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_id?: string | null
          kind: Database["public"]["Enums"]["return_kind"]
          notes?: string | null
          purchase_id?: string | null
          reason?: Database["public"]["Enums"]["return_reason"]
          resolution?: Database["public"]["Enums"]["return_resolution"]
          restock?: boolean
          return_date?: string
          rma_no: string
          status?: Database["public"]["Enums"]["return_status"]
          supplier_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Update: {
          adjustment_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_id?: string | null
          kind?: Database["public"]["Enums"]["return_kind"]
          notes?: string | null
          purchase_id?: string | null
          reason?: Database["public"]["Enums"]["return_reason"]
          resolution?: Database["public"]["Enums"]["return_resolution"]
          restock?: boolean
          return_date?: string
          rma_no?: string
          status?: Database["public"]["Enums"]["return_status"]
          supplier_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_returns_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_attachments: {
        Row: {
          adjustment_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          adjustment_id: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          adjustment_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_attachments_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_items: {
        Row: {
          adjustment_id: string
          batch_id: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          unit_cost: number
          value: number
        }
        Insert: {
          adjustment_id: string
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          unit_cost?: number
          value?: number
        }
        Update: {
          adjustment_id?: string
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          unit_cost?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_no: string
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          created_at: string
          created_by: string | null
          id: string
          journal_id: string | null
          notes: string | null
          reason: string | null
          total_value: number
          updated_at: string
          warehouse: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_no: string
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          reason?: string | null
          total_value?: number
          updated_at?: string
          warehouse?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_no?: string
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          reason?: string | null
          total_value?: number
          updated_at?: string
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          batch_id: string | null
          cogs: number
          created_at: string
          discount: number
          id: string
          invoice_id: string
          product_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          cogs?: number
          created_at?: string
          discount?: number
          id?: string
          invoice_id: string
          product_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          batch_id?: string | null
          cogs?: number
          created_at?: string
          discount?: number
          id?: string
          invoice_id?: string
          product_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approval_reason: string | null
          approval_status: string
          balance: number
          cash_amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          etims_error: string | null
          etims_qr_data: string | null
          etims_signature: string | null
          etims_status: Database["public"]["Enums"]["etims_status"]
          etims_synced_at: string | null
          id: string
          invoice_number: string
          last_reprinted_at: string | null
          mpesa_amount: number
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          reprint_count: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          walkin_name: string | null
          walkin_phone: string | null
        }
        Insert: {
          approval_reason?: string | null
          approval_status?: string
          balance?: number
          cash_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          etims_error?: string | null
          etims_qr_data?: string | null
          etims_signature?: string | null
          etims_status?: Database["public"]["Enums"]["etims_status"]
          etims_synced_at?: string | null
          id?: string
          invoice_number?: string
          last_reprinted_at?: string | null
          mpesa_amount?: number
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reprint_count?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          walkin_name?: string | null
          walkin_phone?: string | null
        }
        Update: {
          approval_reason?: string | null
          approval_status?: string
          balance?: number
          cash_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          etims_error?: string | null
          etims_qr_data?: string | null
          etims_signature?: string | null
          etims_status?: Database["public"]["Enums"]["etims_status"]
          etims_synced_at?: string | null
          id?: string
          invoice_number?: string
          last_reprinted_at?: string | null
          mpesa_amount?: number
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reprint_count?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          walkin_name?: string | null
          walkin_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          is_reversal: boolean
          reference_id: string | null
          reference_type: string | null
          reverses_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_reversal?: boolean
          reference_id?: string | null
          reference_type?: string | null
          reverses_id?: string | null
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_reversal?: boolean
          reference_id?: string | null
          reference_type?: string | null
          reverses_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          entry_date: string | null
          id: string
          journal_id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string | null
          id?: string
          journal_id: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string | null
          id?: string
          journal_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          paid_at: string | null
          phone: string
          result_desc: string | null
          status: string
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          paid_at?: string | null
          phone: string
          result_desc?: string | null
          status?: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          paid_at?: string | null
          phone?: string
          result_desc?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_stock_runs: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          item_count: number
          journal_id: string | null
          notes: string | null
          total_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          item_count?: number
          journal_id?: string | null
          notes?: string | null
          total_value?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          item_count?: number
          journal_id?: string | null
          notes?: string | null
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "opening_stock_runs_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_corrections: {
        Row: {
          amount: number
          correction_no: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          from_account: string | null
          id: string
          invoice_id: string | null
          journal_id: string | null
          kind: string
          new_invoice_id: string | null
          original_date: string | null
          original_period_status: string | null
          payment_id: string | null
          posting_date: string
          reason: string | null
          reason_code: string
          to_account: string | null
        }
        Insert: {
          amount?: number
          correction_no: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          from_account?: string | null
          id?: string
          invoice_id?: string | null
          journal_id?: string | null
          kind: string
          new_invoice_id?: string | null
          original_date?: string | null
          original_period_status?: string | null
          payment_id?: string | null
          posting_date?: string
          reason?: string | null
          reason_code: string
          to_account?: string | null
        }
        Update: {
          amount?: number
          correction_no?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          from_account?: string | null
          id?: string
          invoice_id?: string | null
          journal_id?: string | null
          kind?: string
          new_invoice_id?: string | null
          original_date?: string | null
          original_period_status?: string | null
          payment_id?: string | null
          posting_date?: string
          reason?: string | null
          reason_code?: string
          to_account?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_corrections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_corrections_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_corrections_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_corrections_new_invoice_id_fkey"
            columns: ["new_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_corrections_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          invoice_id: string
          mpesa_amount: number
          notes: string | null
          payment_date: string
          reversed_at: string | null
          status: string
        }
        Insert: {
          amount: number
          cash_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_id: string
          mpesa_amount?: number
          notes?: string | null
          payment_date?: string
          reversed_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cash_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string
          mpesa_amount?: number
          notes?: string | null
          payment_date?: string
          reversed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: number
          old_value: number
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value: number
          old_value: number
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: number
          old_value?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_sell_price: number
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          floor_price: number
          id: string
          image_url: string | null
          is_service: boolean
          min_stock: number
          name: string
          shop_featured: boolean
          shop_visible: boolean
          tax_category: Database["public"]["Enums"]["tax_category"]
          unit: string
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          base_sell_price?: number
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          floor_price?: number
          id?: string
          image_url?: string | null
          is_service?: boolean
          min_stock?: number
          name: string
          shop_featured?: boolean
          shop_visible?: boolean
          tax_category?: Database["public"]["Enums"]["tax_category"]
          unit?: string
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          base_sell_price?: number
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          floor_price?: number
          id?: string
          image_url?: string | null
          is_service?: boolean
          min_stock?: number
          name?: string
          shop_featured?: boolean
          shop_visible?: boolean
          tax_category?: Database["public"]["Enums"]["tax_category"]
          unit?: string
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          failed_login_attempts: number
          id: string
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          failed_login_attempts?: number
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          failed_login_attempts?: number
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          asset_category: Database["public"]["Enums"]["asset_category"] | null
          asset_id: string | null
          asset_useful_life: number | null
          batch_id: string | null
          created_at: string
          description: string | null
          expense_account_id: string | null
          id: string
          line_type: Database["public"]["Enums"]["purchase_line_type"]
          product_id: string | null
          purchase_id: string
          quantity: number
          total: number
          unit_cost: number
          vat_amount: number
          vat_rate: number
          vat_treatment: Database["public"]["Enums"]["vat_treatment"]
          warehouse: string | null
        }
        Insert: {
          asset_category?: Database["public"]["Enums"]["asset_category"] | null
          asset_id?: string | null
          asset_useful_life?: number | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          id?: string
          line_type?: Database["public"]["Enums"]["purchase_line_type"]
          product_id?: string | null
          purchase_id: string
          quantity: number
          total: number
          unit_cost: number
          vat_amount?: number
          vat_rate?: number
          vat_treatment?: Database["public"]["Enums"]["vat_treatment"]
          warehouse?: string | null
        }
        Update: {
          asset_category?: Database["public"]["Enums"]["asset_category"] | null
          asset_id?: string | null
          asset_useful_life?: number | null
          batch_id?: string | null
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          id?: string
          line_type?: Database["public"]["Enums"]["purchase_line_type"]
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          total?: number
          unit_cost?: number
          vat_amount?: number
          vat_rate?: number
          vat_treatment?: Database["public"]["Enums"]["vat_treatment"]
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          line_total: number
          po_id: string
          product_id: string | null
          quantity: number
          unit_cost: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          po_id: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          po_id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          reference: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
          vat_total: number
          wht_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
          vat_total?: number
          wht_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
          vat_total?: number
          wht_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          purchase_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type: string
          purchase_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          purchase_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          payment_mode: Database["public"]["Enums"]["purchase_payment_mode"]
          payment_terms_days: number | null
          po_id: string | null
          posted_at: string | null
          purchase_code: string
          purchase_date: string
          reference: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          subtotal: number
          supplier_id: string
          total: number
          vat_total: number
          warehouse: string
          wht_total: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["purchase_payment_mode"]
          payment_terms_days?: number | null
          po_id?: string | null
          posted_at?: string | null
          purchase_code?: string
          purchase_date?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id: string
          total?: number
          vat_total?: number
          warehouse?: string
          wht_total?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["purchase_payment_mode"]
          payment_terms_days?: number | null
          po_id?: string | null
          posted_at?: string | null
          purchase_code?: string
          purchase_date?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id?: string
          total?: number
          vat_total?: number
          warehouse?: string
          wht_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_inquiries: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          service_key: string
          service_name: string
          source: string
          status: string
          updated_at: string
          user_id: string | null
          whatsapp_message: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          service_key: string
          service_name: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_message?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          service_key?: string
          service_name?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shop_customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          erp_customer_id: string | null
          full_name: string
          id: string
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          erp_customer_id?: string | null
          full_name: string
          id?: string
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          erp_customer_id?: string | null
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shop_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          id: string
          invoice_id: string | null
          mpesa_checkout_request_id: string | null
          mpesa_phone: string | null
          mpesa_receipt: string | null
          notes: string | null
          order_number: string
          shop_customer_id: string | null
          status: Database["public"]["Enums"]["shop_order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_checkout_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt?: string | null
          notes?: string | null
          order_number?: string
          shop_customer_id?: string | null
          status?: Database["public"]["Enums"]["shop_order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_checkout_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt?: string | null
          notes?: string | null
          order_number?: string
          shop_customer_id?: string | null
          status?: Database["public"]["Enums"]["shop_order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_shop_customer_id_fkey"
            columns: ["shop_customer_id"]
            isOneToOne: false
            referencedRelation: "shop_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          product_id: string
          purchase_date: string
          quantity_bought: number
          quantity_remaining: number
          supplier_id: string | null
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          product_id: string
          purchase_date?: string
          quantity_bought?: number
          quantity_remaining?: number
          supplier_id?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          product_id?: string
          purchase_date?: string
          quantity_bought?: number
          quantity_remaining?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          purchase_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          payment_id: string
          purchase_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          charge_account_id: string | null
          charge_amount: number
          charge_type: Database["public"]["Enums"]["payment_charge_type"]
          created_at: string
          created_by: string | null
          id: string
          journal_id: string | null
          method: Database["public"]["Enums"]["supplier_payment_method"]
          notes: string | null
          payment_account_id: string | null
          payment_date: string
          payment_no: string
          reference: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          charge_account_id?: string | null
          charge_amount?: number
          charge_type?: Database["public"]["Enums"]["payment_charge_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          method?: Database["public"]["Enums"]["supplier_payment_method"]
          notes?: string | null
          payment_account_id?: string | null
          payment_date?: string
          payment_no: string
          reference?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_account_id?: string | null
          charge_amount?: number
          charge_type?: Database["public"]["Enums"]["payment_charge_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          method?: Database["public"]["Enums"]["supplier_payment_method"]
          notes?: string | null
          payment_account_id?: string | null
          payment_date?: string
          payment_no?: string
          reference?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_charge_account_id_fkey"
            columns: ["charge_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_charge_account_id_fkey"
            columns: ["charge_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supplier_payments_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          kra_pin: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          kra_pin?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          kra_pin?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wifi_transactions: {
        Row: {
          amount: number
          authenticated_at: string | null
          client_mac: string | null
          created_at: string
          id: string
          journal_id: string | null
          mpesa_receipt: string | null
          package_type: string | null
          paid_at: string
          phone_number: string | null
          remote_id: string
          source: string
          ssid: string | null
          status: string
          synced_at: string
          voucher_code: string | null
        }
        Insert: {
          amount?: number
          authenticated_at?: string | null
          client_mac?: string | null
          created_at?: string
          id?: string
          journal_id?: string | null
          mpesa_receipt?: string | null
          package_type?: string | null
          paid_at?: string
          phone_number?: string | null
          remote_id: string
          source?: string
          ssid?: string | null
          status?: string
          synced_at?: string
          voucher_code?: string | null
        }
        Update: {
          amount?: number
          authenticated_at?: string | null
          client_mac?: string | null
          created_at?: string
          id?: string
          journal_id?: string | null
          mpesa_receipt?: string | null
          package_type?: string | null
          paid_at?: string
          phone_number?: string | null
          remote_id?: string
          source?: string
          ssid?: string | null
          status?: string
          synced_at?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      wifi_vouchers: {
        Row: {
          code: string | null
          created_at: string
          duration_hours: number | null
          id: string
          package_type: string | null
          remote_id: string
          source: string
          status: string | null
          synced_at: string
          used_at: string | null
          used_by_mac: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          duration_hours?: number | null
          id?: string
          package_type?: string | null
          remote_id: string
          source?: string
          status?: string | null
          synced_at?: string
          used_at?: string | null
          used_by_mac?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          duration_hours?: number | null
          id?: string
          package_type?: string | null
          remote_id?: string
          source?: string
          status?: string | null
          synced_at?: string
          used_at?: string | null
          used_by_mac?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_trial_balance: {
        Row: {
          account_id: string | null
          balance: number | null
          code: string | null
          name: string | null
          total_credit: number | null
          total_debit: number | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjustment_accounts: {
        Args: { p_type: Database["public"]["Enums"]["adjustment_type"] }
        Returns: string
      }
      asset_account_code: {
        Args: { p_cat: Database["public"]["Enums"]["asset_category"] }
        Returns: string
      }
      backup_manifest: {
        Args: { p_user_id: string }
        Returns: {
          columns: Json
          restore_order: number
          row_estimate: number
          table_name: string
        }[]
      }
      cleanup_wifi_backfill_step: { Args: never; Returns: number }
      convert_po_to_invoice: { Args: { p_po_id: string }; Returns: string }
      convert_walkin_to_customer: {
        Args: { p_customer_id: string; p_phone: string }
        Returns: number
      }
      correct_payment_account: {
        Args: {
          p_amount: number
          p_from: string
          p_payment_id: string
          p_reason: string
          p_reason_code: string
          p_to: string
        }
        Returns: string
      }
      correct_sale_payment: {
        Args: {
          p_cash_amount: number
          p_invoice_id: string
          p_mpesa_amount: number
          p_reason: string
          p_reason_code: string
        }
        Returns: string
      }
      create_credit_note: {
        Args: {
          p_invoice_id: string
          p_items: Json
          p_reason: string
          p_refund_method: Database["public"]["Enums"]["credit_note_refund_method"]
        }
        Returns: string
      }
      deduct_stock_fifo: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: number
      }
      dispose_asset: {
        Args: {
          p_asset_id: string
          p_date?: string
          p_method: Database["public"]["Enums"]["disposal_method"]
          p_notes?: string
          p_proceeds: number
        }
        Returns: string
      }
      get_product_stock: { Args: { p_product_id: string }; Returns: number }
      gl_financials: {
        Args: { p_from: string; p_to: string }
        Returns: {
          asof_credit: number
          asof_debit: number
          code: string
          name: string
          opening_credit: number
          opening_debit: number
          period_credit: number
          period_debit: number
          type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_net: {
        Args: { p_subtotal: number; p_tax: number; p_total: number }
        Returns: number
      }
      map_expense_category_to_account: {
        Args: { p_cat: string }
        Returns: string
      }
      mark_credit_note_reprint: { Args: { p_id: string }; Returns: number }
      next_correction_no: { Args: never; Returns: string }
      pay_supplier: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_charge_amount?: number
          p_charge_type?: Database["public"]["Enums"]["payment_charge_type"]
          p_date?: string
          p_method: Database["public"]["Enums"]["supplier_payment_method"]
          p_notes?: string
          p_payment_account: string
          p_reference?: string
          p_supplier_id: string
        }
        Returns: string
      }
      payment_charge_account: {
        Args: { p_type: Database["public"]["Enums"]["payment_charge_type"] }
        Returns: string
      }
      period_status_for: { Args: { p_date: string }; Returns: string }
      post_credit_note_journal: { Args: { p_cn_id: string }; Returns: string }
      post_inventory_adjustment: {
        Args: {
          p_date?: string
          p_items: Json
          p_notes: string
          p_reason: string
          p_type: Database["public"]["Enums"]["adjustment_type"]
          p_warehouse?: string
        }
        Returns: string
      }
      post_journal: {
        Args: {
          p_description: string
          p_entry_date?: string
          p_lines: Json
          p_reference_id: string
          p_reference_type: string
        }
        Returns: string
      }
      post_opening_stock: {
        Args: { p_entry_date?: string; p_items: Json; p_notes?: string }
        Returns: string
      }
      post_purchase: { Args: { p_id: string }; Returns: string }
      post_supplier_return: { Args: { p_return_id: string }; Returns: string }
      reallocate_payment: {
        Args: {
          p_new_invoice_id: string
          p_payment_id: string
          p_reason: string
          p_reason_code: string
        }
        Returns: string
      }
      restore_triggers: {
        Args: { p_disable: boolean; p_user_id: string }
        Returns: number
      }
      restore_truncate: { Args: { p_tables: string }; Returns: undefined }
      reverse_expense: { Args: { p_expense_id: string }; Returns: undefined }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string; p_reason_code: string }
        Returns: string
      }
      run_asset_depreciation: { Args: { p_period: string }; Returns: number }
      set_accounting_period: {
        Args: {
          p_month: number
          p_reason: string
          p_status: string
          p_year: number
        }
        Returns: string
      }
      write_off_bad_debt: {
        Args: { p_amount: number; p_invoice_id: string; p_reason: string }
        Returns: string
      }
    }
    Enums: {
      adjustment_type:
        | "damaged"
        | "expired"
        | "lost"
        | "theft"
        | "promotional"
        | "internal_use"
        | "supplier_replacement"
        | "found"
        | "opening_correction"
        | "data_correction"
        | "repackaging"
      app_role: "admin" | "sales_agent"
      asset_category:
        | "computer"
        | "printer"
        | "router"
        | "furniture"
        | "vehicle"
        | "ups"
        | "generator"
        | "other"
      asset_status: "active" | "under_maintenance" | "disposed" | "written_off"
      credit_note_refund_method:
        | "none"
        | "credit_balance"
        | "cash_refund"
        | "mpesa_refund"
      credit_note_status: "issued" | "void"
      customer_type: "walk_in" | "regular"
      disposal_method: "sale" | "scrap" | "write_off" | "donation"
      etims_status: "not_required" | "pending_sync" | "signed" | "failed"
      invoice_status: "paid" | "partial" | "unpaid"
      payment_charge_type:
        | "none"
        | "mpesa_fee"
        | "bank_charge"
        | "transfer_fee"
        | "cheque_fee"
        | "other"
      payment_method: "cash" | "mpesa" | "cash_mpesa" | "partial_debt"
      product_category:
        | "Phone Accessories"
        | "Internet Services"
        | "Printing Services"
        | "Other Services"
      purchase_line_type: "stock" | "expense" | "service" | "asset"
      purchase_order_status:
        | "draft"
        | "issued"
        | "received"
        | "cancelled"
        | "invoiced"
      purchase_payment_mode: "credit" | "cash" | "mpesa" | "bank"
      purchase_status: "draft" | "posted" | "cancelled"
      return_kind: "customer" | "supplier"
      return_reason: "damaged" | "expired" | "wrong_item" | "faulty" | "other"
      return_resolution:
        | "pending"
        | "credit_note"
        | "replacement"
        | "refund"
        | "scrap"
        | "supplier_claim"
      return_status: "logged" | "approved" | "resolved" | "cancelled"
      shop_order_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "fulfilled"
      supplier_payment_method: "cash" | "mpesa" | "bank" | "cheque" | "other"
      tax_category: "standard" | "zero_rated" | "exempt"
      vat_treatment: "standard" | "zero_rated" | "exempt" | "custom"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_type: [
        "damaged",
        "expired",
        "lost",
        "theft",
        "promotional",
        "internal_use",
        "supplier_replacement",
        "found",
        "opening_correction",
        "data_correction",
        "repackaging",
      ],
      app_role: ["admin", "sales_agent"],
      asset_category: [
        "computer",
        "printer",
        "router",
        "furniture",
        "vehicle",
        "ups",
        "generator",
        "other",
      ],
      asset_status: ["active", "under_maintenance", "disposed", "written_off"],
      credit_note_refund_method: [
        "none",
        "credit_balance",
        "cash_refund",
        "mpesa_refund",
      ],
      credit_note_status: ["issued", "void"],
      customer_type: ["walk_in", "regular"],
      disposal_method: ["sale", "scrap", "write_off", "donation"],
      etims_status: ["not_required", "pending_sync", "signed", "failed"],
      invoice_status: ["paid", "partial", "unpaid"],
      payment_charge_type: [
        "none",
        "mpesa_fee",
        "bank_charge",
        "transfer_fee",
        "cheque_fee",
        "other",
      ],
      payment_method: ["cash", "mpesa", "cash_mpesa", "partial_debt"],
      product_category: [
        "Phone Accessories",
        "Internet Services",
        "Printing Services",
        "Other Services",
      ],
      purchase_line_type: ["stock", "expense", "service", "asset"],
      purchase_order_status: [
        "draft",
        "issued",
        "received",
        "cancelled",
        "invoiced",
      ],
      purchase_payment_mode: ["credit", "cash", "mpesa", "bank"],
      purchase_status: ["draft", "posted", "cancelled"],
      return_kind: ["customer", "supplier"],
      return_reason: ["damaged", "expired", "wrong_item", "faulty", "other"],
      return_resolution: [
        "pending",
        "credit_note",
        "replacement",
        "refund",
        "scrap",
        "supplier_claim",
      ],
      return_status: ["logged", "approved", "resolved", "cancelled"],
      shop_order_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "fulfilled",
      ],
      supplier_payment_method: ["cash", "mpesa", "bank", "cheque", "other"],
      tax_category: ["standard", "zero_rated", "exempt"],
      vat_treatment: ["standard", "zero_rated", "exempt", "custom"],
    },
  },
} as const
