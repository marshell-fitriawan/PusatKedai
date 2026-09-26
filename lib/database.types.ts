// DIGENERATE OTOMATIS -- JANGAN DIEDIT MANUAL.
// Sumber: skema database Supabase. Regenerate dengan `npm run gen:types`
// setiap kali ada migration baru.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          name: string
          email: string
          role: "owner" | "admin_pusat"
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role: "owner" | "admin_pusat"
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: "owner" | "admin_pusat"
          is_active?: boolean
          created_at?: string
        }
        Relationships: [

        ]
      }
      bahan_mentah: {
        Row: {
          id: string
          name: string
          satuan: string
          harga_beli: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          satuan: string
          harga_beli?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          satuan?: string
          harga_beli?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [

        ]
      }
      bahan_movement: {
        Row: {
          id: string
          bahan_id: string
          delta: number
          balance_after: number
          reason: "masuk" | "produksi" | "koreksi"
          ref_produksi_id: string | null
          created_by_admin_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bahan_id: string
          delta: number
          balance_after: number
          reason: "masuk" | "produksi" | "koreksi"
          ref_produksi_id?: string | null
          created_by_admin_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bahan_id?: string
          delta?: number
          balance_after?: number
          reason?: "masuk" | "produksi" | "koreksi"
          ref_produksi_id?: string | null
          created_by_admin_id?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bahan_movement_bahan_id_fkey"
            columns: ["bahan_id"]
            isOneToOne: false
            referencedRelation: "bahan_mentah"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bahan_movement_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bahan_movement_ref_produksi_id_fkey"
            columns: ["ref_produksi_id"]
            isOneToOne: false
            referencedRelation: "produksi"
            referencedColumns: ["id"]
          }
        ]
      }
      bahan_stock: {
        Row: {
          bahan_id: string
          quantity: number
          updated_at: string
          created_at: string
        }
        Insert: {
          bahan_id: string
          quantity?: number
          updated_at?: string
          created_at?: string
        }
        Update: {
          bahan_id?: string
          quantity?: number
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bahan_stock_bahan_id_fkey"
            columns: ["bahan_id"]
            isOneToOne: false
            referencedRelation: "bahan_mentah"
            referencedColumns: ["id"]
          }
        ]
      }
      employees: {
        Row: {
          id: string
          kedai_id: string
          name: string
          role: "kasir" | "admin_kedai"
          qr_token: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          kedai_id: string
          name: string
          role: "kasir" | "admin_kedai"
          qr_token: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          kedai_id?: string
          name?: string
          role?: "kasir" | "admin_kedai"
          qr_token?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          kedai_id: string
          category: "bahan_baku" | "listrik" | "sewa" | "gaji" | "lainnya"
          description: string
          amount: number
          expense_date: string
          recorded_by_employee_id: string | null
          recorded_by_admin_id: string | null
          created_at: string
          shift_id: string | null
          from_cash: boolean
        }
        Insert: {
          id?: string
          kedai_id: string
          category: "bahan_baku" | "listrik" | "sewa" | "gaji" | "lainnya"
          description: string
          amount: number
          expense_date: string
          recorded_by_employee_id?: string | null
          recorded_by_admin_id?: string | null
          created_at?: string
          shift_id?: string | null
          from_cash?: boolean
        }
        Update: {
          id?: string
          kedai_id?: string
          category?: "bahan_baku" | "listrik" | "sewa" | "gaji" | "lainnya"
          description?: string
          amount?: number
          expense_date?: string
          recorded_by_employee_id?: string | null
          recorded_by_admin_id?: string | null
          created_at?: string
          shift_id?: string | null
          from_cash?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "expenses_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_admin_id_fkey"
            columns: ["recorded_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          }
        ]
      }
      kedai: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          timezone: string
          low_stock_threshold: number
          is_active: boolean
          created_at: string
          is_warehouse: boolean
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          timezone?: string
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          is_warehouse?: boolean
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          timezone?: string
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          is_warehouse?: boolean
        }
        Relationships: [

        ]
      }
      kedai_stock: {
        Row: {
          id: string
          kedai_id: string
          product_id: string
          quantity: number
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          kedai_id: string
          product_id: string
          quantity?: number
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          kedai_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kedai_stock_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kedai_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      notifikasi: {
        Row: {
          id: string
          kedai_id: string | null
          shift_id: string | null
          type: "shift_selesai" | "selisih" | "stock_low" | "void_review" | "device_stale" | "assign" | "produksi"
          title: string
          message: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          kedai_id?: string | null
          shift_id?: string | null
          type: "shift_selesai" | "selisih" | "stock_low" | "void_review" | "device_stale" | "assign" | "produksi"
          title: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          kedai_id?: string | null
          shift_id?: string | null
          type?: "shift_selesai" | "selisih" | "stock_low" | "void_review" | "device_stale" | "assign" | "produksi"
          title?: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifikasi_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifikasi_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          price: number
          category: string | null
          image_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          category?: string | null
          image_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          category?: string | null
          image_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [

        ]
      }
      produksi: {
        Row: {
          id: string
          product_id: string
          qty_hasil: number
          produced_by_admin_id: string
          note: string | null
          produced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          qty_hasil: number
          produced_by_admin_id: string
          note?: string | null
          produced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          qty_hasil?: number
          produced_by_admin_id?: string
          note?: string | null
          produced_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produksi_produced_by_admin_id_fkey"
            columns: ["produced_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produksi_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      produksi_bahan: {
        Row: {
          id: string
          produksi_id: string
          bahan_id: string
          qty: number
        }
        Insert: {
          id?: string
          produksi_id: string
          bahan_id: string
          qty: number
        }
        Update: {
          id?: string
          produksi_id?: string
          bahan_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "produksi_bahan_bahan_id_fkey"
            columns: ["bahan_id"]
            isOneToOne: false
            referencedRelation: "bahan_mentah"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produksi_bahan_produksi_id_fkey"
            columns: ["produksi_id"]
            isOneToOne: false
            referencedRelation: "produksi"
            referencedColumns: ["id"]
          }
        ]
      }
      qris_payments: {
        Row: {
          id: string
          kedai_id: string
          shift_id: string
          employee_id: string
          local_number: string
          device_id: string
          items: Json
          total: number
          midtrans_order_id: string
          status: "created" | "paid" | "expired" | "failed"
          qr_content: string | null
          qr_image_url: string | null
          expires_at: string
          created_at: string
          paid_at: string | null
          transaction_id: string | null
        }
        Insert: {
          id: string
          kedai_id: string
          shift_id: string
          employee_id: string
          local_number: string
          device_id: string
          items: Json
          total: number
          midtrans_order_id: string
          status?: "created" | "paid" | "expired" | "failed"
          qr_content?: string | null
          qr_image_url?: string | null
          expires_at: string
          created_at?: string
          paid_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          id?: string
          kedai_id?: string
          shift_id?: string
          employee_id?: string
          local_number?: string
          device_id?: string
          items?: Json
          total?: number
          midtrans_order_id?: string
          status?: "created" | "paid" | "expired" | "failed"
          qr_content?: string | null
          qr_image_url?: string | null
          expires_at?: string
          created_at?: string
          paid_at?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qris_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qris_payments_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qris_payments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qris_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      shifts: {
        Row: {
          id: string
          kedai_id: string
          business_date: string
          opened_by: string
          closed_by: string | null
          opening_cash: number
          closing_cash: number | null
          expected_cash: number | null
          cash_difference: number | null
          reconciliation_status: "pending_sync" | "final"
          reconciled_at: string | null
          opened_at: string
          closed_at: string | null
          status: "open" | "closed"
          pending_sync_count: number
          difference_status: "terbuka" | "dijelaskan" | "rugi"
          difference_note: string | null
        }
        Insert: {
          id?: string
          kedai_id: string
          business_date: string
          opened_by: string
          closed_by?: string | null
          opening_cash: number
          closing_cash?: number | null
          expected_cash?: number | null
          cash_difference?: number | null
          reconciliation_status?: "pending_sync" | "final"
          reconciled_at?: string | null
          opened_at?: string
          closed_at?: string | null
          status?: "open" | "closed"
          pending_sync_count?: number
          difference_status?: "terbuka" | "dijelaskan" | "rugi"
          difference_note?: string | null
        }
        Update: {
          id?: string
          kedai_id?: string
          business_date?: string
          opened_by?: string
          closed_by?: string | null
          opening_cash?: number
          closing_cash?: number | null
          expected_cash?: number | null
          cash_difference?: number | null
          reconciliation_status?: "pending_sync" | "final"
          reconciled_at?: string | null
          opened_at?: string
          closed_at?: string | null
          status?: "open" | "closed"
          pending_sync_count?: number
          difference_status?: "terbuka" | "dijelaskan" | "rugi"
          difference_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      sisa_fisik: {
        Row: {
          id: string
          shift_id: string
          product_id: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          product_id: string
          quantity: number
          created_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          product_id?: string
          quantity?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sisa_fisik_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sisa_fisik_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          kedai_id: string
          product_id: string
          delta: number
          balance_after: number
          reason: "initial" | "sale" | "void" | "mutation_out" | "mutation_in" | "adjustment" | "produksi" | "waste"
          ref_transaction_id: string | null
          ref_mutation_id: string | null
          created_by_employee_id: string | null
          created_by_admin_id: string | null
          note: string | null
          created_at: string
          ref_produksi_id: string | null
          ref_waste_id: string | null
        }
        Insert: {
          id?: string
          kedai_id: string
          product_id: string
          delta: number
          balance_after: number
          reason: "initial" | "sale" | "void" | "mutation_out" | "mutation_in" | "adjustment" | "produksi" | "waste"
          ref_transaction_id?: string | null
          ref_mutation_id?: string | null
          created_by_employee_id?: string | null
          created_by_admin_id?: string | null
          note?: string | null
          created_at?: string
          ref_produksi_id?: string | null
          ref_waste_id?: string | null
        }
        Update: {
          id?: string
          kedai_id?: string
          product_id?: string
          delta?: number
          balance_after?: number
          reason?: "initial" | "sale" | "void" | "mutation_out" | "mutation_in" | "adjustment" | "produksi" | "waste"
          ref_transaction_id?: string | null
          ref_mutation_id?: string | null
          created_by_employee_id?: string | null
          created_by_admin_id?: string | null
          note?: string | null
          created_at?: string
          ref_produksi_id?: string | null
          ref_waste_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_mutation_id_fkey"
            columns: ["ref_mutation_id"]
            isOneToOne: false
            referencedRelation: "stock_mutations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_produksi_id_fkey"
            columns: ["ref_produksi_id"]
            isOneToOne: false
            referencedRelation: "produksi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_transaction_id_fkey"
            columns: ["ref_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_waste_id_fkey"
            columns: ["ref_waste_id"]
            isOneToOne: false
            referencedRelation: "waste"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_mutations: {
        Row: {
          id: string
          from_kedai_id: string
          to_kedai_id: string
          product_id: string
          quantity: number
          status: "pending" | "approved" | "rejected"
          requested_by_employee_id: string | null
          requested_by_admin_id: string | null
          approved_by: string | null
          requested_at: string
          approved_at: string | null
          executed_at: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_kedai_id: string
          to_kedai_id: string
          product_id: string
          quantity: number
          status?: "pending" | "approved" | "rejected"
          requested_by_employee_id?: string | null
          requested_by_admin_id?: string | null
          approved_by?: string | null
          requested_at?: string
          approved_at?: string | null
          executed_at?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_kedai_id?: string
          to_kedai_id?: string
          product_id?: string
          quantity?: number
          status?: "pending" | "approved" | "rejected"
          requested_by_employee_id?: string | null
          requested_by_admin_id?: string | null
          approved_by?: string | null
          requested_at?: string
          approved_at?: string | null
          executed_at?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_mutations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mutations_from_kedai_id_fkey"
            columns: ["from_kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mutations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mutations_requested_by_admin_id_fkey"
            columns: ["requested_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mutations_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mutations_to_kedai_id_fkey"
            columns: ["to_kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          }
        ]
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_id: string
          product_name_snapshot: string
          price_snapshot: number
          qty: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id: string
          transaction_id: string
          product_id: string
          product_name_snapshot: string
          price_snapshot: number
          qty: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          product_id?: string
          product_name_snapshot?: string
          price_snapshot?: number
          qty?: number
          subtotal?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          kedai_id: string
          shift_id: string
          employee_id: string
          business_date: string
          local_number: string
          transaction_number: string | null
          subtotal: number
          total: number
          payment_method: "tunai" | "qris"
          status: "completed" | "void" | "perlu_review"
          voided_at: string | null
          voided_by: string | null
          device_id: string
          synced_at: string
          created_at: string
        }
        Insert: {
          id: string
          kedai_id: string
          shift_id: string
          employee_id: string
          business_date: string
          local_number: string
          transaction_number?: string | null
          subtotal: number
          total: number
          payment_method: "tunai" | "qris"
          status?: "completed" | "void" | "perlu_review"
          voided_at?: string | null
          voided_by?: string | null
          device_id: string
          synced_at?: string
          created_at: string
        }
        Update: {
          id?: string
          kedai_id?: string
          shift_id?: string
          employee_id?: string
          business_date?: string
          local_number?: string
          transaction_number?: string | null
          subtotal?: number
          total?: number
          payment_method?: "tunai" | "qris"
          status?: "completed" | "void" | "perlu_review"
          voided_at?: string | null
          voided_by?: string | null
          device_id?: string
          synced_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      void_request: {
        Row: {
          id: string
          transaction_id: string
          kedai_id: string
          requested_by_employee_id: string
          alasan: string
          status: "pending" | "approved" | "rejected"
          decided_by: string | null
          decided_at: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          kedai_id: string
          requested_by_employee_id: string
          alasan: string
          status?: "pending" | "approved" | "rejected"
          decided_by?: string | null
          decided_at?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          kedai_id?: string
          requested_by_employee_id?: string
          alasan?: string
          status?: "pending" | "approved" | "rejected"
          decided_by?: string | null
          decided_at?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "void_request_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_request_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_request_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "void_request_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      waste: {
        Row: {
          id: string
          kedai_id: string
          shift_id: string | null
          product_id: string
          quantity: number
          alasan: string
          recorded_by_employee_id: string
          recorded_at: string
        }
        Insert: {
          id?: string
          kedai_id: string
          shift_id?: string | null
          product_id: string
          quantity: number
          alasan: string
          recorded_by_employee_id: string
          recorded_at?: string
        }
        Update: {
          id?: string
          kedai_id?: string
          shift_id?: string | null
          product_id?: string
          quantity?: number
          alasan?: string
          recorded_by_employee_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_kedai_id_fkey"
            columns: ["kedai_id"]
            isOneToOne: false
            referencedRelation: "kedai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      adjust_stock: {
        Args: {
          p_kedai_id: string
          p_product_id: string
          p_new_quantity: number
          p_note: string
          p_admin_id: string
        }
        Returns: {
          quantity: number
          delta: number
          reason: string
        }[]
      }
      approve_mutation: {
        Args: {
          p_mutation_id: string
          p_admin_id: string
        }
        Returns: {
          status: string
          from_quantity: number
          to_quantity: number
        }[]
      }
      close_shift: {
        Args: {
          p_shift_id: string
          p_kedai_id: string
          p_employee_id: string
          p_closing_cash: number
          p_pending_count: unknown
        }
        Returns: {
          expected_cash: number
          cash_difference: number
          reconciliation_status: string
          pending_sync_count: number
        }[]
      }
      confirm_qris_payment: {
        Args: {
          p_payment_id: string
          p_paid_at: string
        }
        Returns: {
          transaction_number: string
          total: number
        }[]
      }
      create_transaction: {
        Args: {
          p_id: string
          p_kedai_id: string
          p_shift_id: string
          p_employee_id: string
          p_local_number: string
          p_device_id: string
          p_payment_method: string
          p_created_at: string
          p_items: Json
        }
        Returns: {
          transaction_number: string
          business_date: string
          total: number
        }[]
      }
      decide_void: {
        Args: {
          p_request_id: string
          p_approve: boolean
          p_decided_by: string
          p_note: unknown
        }
        Returns: {
          transaction_number: string
          total: number
          review_status: string
        }[]
      }
      is_active_admin: {
        Args: {
          [key: string]: never
        }
        Returns: boolean
      }
      reconcile_shift: {
        Args: {
          p_shift_id: string
          p_applied: unknown
        }
        Returns: {
          expected_cash: number
          cash_difference: number
          reconciliation_status: string
          pending_sync_count: number
        }[]
      }
      record_bahan_movement: {
        Args: {
          p_id: string
          p_bahan_id: string
          p_delta: number
          p_reason: string
          p_note: string
          p_admin_id: string
        }
        Returns: {
          quantity: number
          reason: string
        }[]
      }
      record_produksi: {
        Args: {
          p_id: string
          p_product_id: string
          p_qty_hasil: number
          p_bahan_ids: unknown
          p_qty_pakai: unknown
          p_admin_id: string
          p_note: string
        }
        Returns: {
          produksi_id: string
          product_id: string
          qty_hasil: number
          produced_at: string
        }[]
      }
      record_waste: {
        Args: {
          p_id: string
          p_kedai_id: string
          p_shift_id: string
          p_product_id: string
          p_quantity: number
          p_alasan: string
          p_employee_id: string
        }
        Returns: {
          quantity: number
        }[]
      }
      report_harian: {
        Args: {
          p_dari: string
          p_sampai: string
        }
        Returns: {
          tanggal: string
          kedai_id: string
          kedai: string
          omzet: number
          jumlah_transaksi: number
          jumlah_void: number
          jumlah_perlu_review: number
          selisih_terbuka: number
        }[]
      }
      report_laba_rugi: {
        Args: {
          p_dari: string
          p_sampai: string
        }
        Returns: {
          kedai_id: string
          omzet: number
          pengeluaran: number
          selisih: number
        }[]
      }
      report_omzet: {
        Args: {
          p_dari: string
          p_sampai: string
          p_granularity: string
        }
        Returns: {
          tanggal: string
          kedai_id: string
          omzet: number
          jumlah_transaksi: number
        }[]
      }
      report_void_karyawan: {
        Args: {
          p_dari: string
          p_sampai: string
        }
        Returns: {
          kedai_id: string
          kedai: string
          employee_id: string
          employee: string
          total_transaksi: number
          jumlah_void: number
          rasio_persen: number
        }[]
      }
      request_void: {
        Args: {
          p_id: string
          p_kedai_id: string
          p_employee_id: string
          p_alasan: string
        }
        Returns: {
          transaction_number: string
          total: number
          review_status: string
        }[]
      }
      void_transaction: {
        Args: {
          p_id: string
          p_kedai_id: string
          p_employee_id: string
        }
        Returns: {
          transaction_number: string
          total: number
        }[]
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
