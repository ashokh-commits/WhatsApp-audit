export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          instance_name: string;
          instance_key_encrypted: string;
          avg_ticket_value: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          instance_name: string;
          instance_key_encrypted: string;
          avg_ticket_value?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          instance_name?: string;
          instance_key_encrypted?: string;
          avg_ticket_value?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          id: string;
          client_id: string;
          authorized_by: string;
          authorized_at: string;
          document_url: string | null;
          notes: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          authorized_by: string;
          authorized_at?: string;
          document_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          authorized_by?: string;
          authorized_at?: string;
          document_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      audits: {
        Row: {
          id: string;
          client_id: string;
          window_days: number;
          overall_score: number | null;
          dimension_scores: Record<string, unknown> | null;
          metrics: Record<string, unknown> | null;
          status: "pending" | "running" | "complete" | "failed";
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          window_days?: number;
          overall_score?: number | null;
          dimension_scores?: Record<string, unknown> | null;
          metrics?: Record<string, unknown> | null;
          status?: "pending" | "running" | "complete" | "failed";
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          window_days?: number;
          overall_score?: number | null;
          dimension_scores?: Record<string, unknown> | null;
          metrics?: Record<string, unknown> | null;
          status?: "pending" | "running" | "complete" | "failed";
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      meta_ad_rows: {
        Row: {
          id: string;
          audit_id: string;
          campaign_name: string | null;
          adset_name: string | null;
          ad_name: string | null;
          spend: number | null;
          impressions: number | null;
          clicks: number | null;
          results: number | null;
          source: "csv" | "api";
          raw_row: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          audit_id: string;
          campaign_name?: string | null;
          adset_name?: string | null;
          ad_name?: string | null;
          spend?: number | null;
          impressions?: number | null;
          clicks?: number | null;
          results?: number | null;
          source: "csv" | "api";
          raw_row?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          audit_id?: string;
          campaign_name?: string | null;
          adset_name?: string | null;
          ad_name?: string | null;
          spend?: number | null;
          impressions?: number | null;
          clicks?: number | null;
          results?: number | null;
          source?: "csv" | "api";
          raw_row?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      ctwa_conversations: {
        Row: {
          id: string;
          audit_id: string;
          chat_ref: string;
          referral: Record<string, unknown>;
          ad_headline: string | null;
          source_url: string | null;
          answered: boolean;
          first_response_seconds: number | null;
          matched_meta_row_id: string | null;
          match_confidence: "exact" | "fuzzy" | "campaign" | "unmatched" | null;
        };
        Insert: {
          id?: string;
          audit_id: string;
          chat_ref: string;
          referral: Record<string, unknown>;
          ad_headline?: string | null;
          source_url?: string | null;
          answered?: boolean;
          first_response_seconds?: number | null;
          matched_meta_row_id?: string | null;
          match_confidence?: "exact" | "fuzzy" | "campaign" | "unmatched" | null;
        };
        Update: {
          id?: string;
          audit_id?: string;
          chat_ref?: string;
          referral?: Record<string, unknown>;
          ad_headline?: string | null;
          source_url?: string | null;
          answered?: boolean;
          first_response_seconds?: number | null;
          matched_meta_row_id?: string | null;
          match_confidence?: "exact" | "fuzzy" | "campaign" | "unmatched" | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
