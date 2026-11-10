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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      analysis_credits: {
        Row: {
          credits_remaining: number
          credits_total: number
          id: string
          reset_at: string | null
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          credits_remaining?: number
          credits_total?: number
          id?: string
          reset_at?: string | null
          tier?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          credits_remaining?: number
          credits_total?: number
          id?: string
          reset_at?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analysis_feedback: {
        Row: {
          analysis_id: string
          comment: string | null
          corrected_gait_type: string | null
          created_at: string
          evidence: Json | null
          feedback_type: string
          id: string
          is_expert: boolean | null
          keypoint_corrections: Json | null
          label_source: string | null
          rating: number | null
          tags: Json | null
          user_id: string
        }
        Insert: {
          analysis_id: string
          comment?: string | null
          corrected_gait_type?: string | null
          created_at?: string
          evidence?: Json | null
          feedback_type: string
          id?: string
          is_expert?: boolean | null
          keypoint_corrections?: Json | null
          label_source?: string | null
          rating?: number | null
          tags?: Json | null
          user_id: string
        }
        Update: {
          analysis_id?: string
          comment?: string | null
          corrected_gait_type?: string | null
          created_at?: string
          evidence?: Json | null
          feedback_type?: string
          id?: string
          is_expert?: boolean | null
          keypoint_corrections?: Json | null
          label_source?: string | null
          rating?: number | null
          tags?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_feedback_analysis"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "gait_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      conformation_records: {
        Row: {
          back_ratio: string | null
          breed_id: string | null
          created_at: string
          croup_slope: number | null
          dmrt3_genotype: string | null
          gait_suitability: Json | null
          hind_leg_angles: string | null
          horse_id: string | null
          horse_name: string | null
          id: string
          image_url: string | null
          injury_risk_areas: string[] | null
          neck_set: string | null
          overall_balance: number | null
          recommendation: string | null
          result_json: Json | null
          shoulder_angle: number | null
          strengths: string[] | null
          suitability_score: number | null
          user_id: string | null
          weaknesses: string[] | null
        }
        Insert: {
          back_ratio?: string | null
          breed_id?: string | null
          created_at?: string
          croup_slope?: number | null
          dmrt3_genotype?: string | null
          gait_suitability?: Json | null
          hind_leg_angles?: string | null
          horse_id?: string | null
          horse_name?: string | null
          id?: string
          image_url?: string | null
          injury_risk_areas?: string[] | null
          neck_set?: string | null
          overall_balance?: number | null
          recommendation?: string | null
          result_json?: Json | null
          shoulder_angle?: number | null
          strengths?: string[] | null
          suitability_score?: number | null
          user_id?: string | null
          weaknesses?: string[] | null
        }
        Update: {
          back_ratio?: string | null
          breed_id?: string | null
          created_at?: string
          croup_slope?: number | null
          dmrt3_genotype?: string | null
          gait_suitability?: Json | null
          hind_leg_angles?: string | null
          horse_id?: string | null
          horse_name?: string | null
          id?: string
          image_url?: string | null
          injury_risk_areas?: string[] | null
          neck_set?: string | null
          overall_balance?: number | null
          recommendation?: string | null
          result_json?: Json | null
          shoulder_angle?: number | null
          strengths?: string[] | null
          suitability_score?: number | null
          user_id?: string | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_conformation_horse"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      gait_analyses: {
        Row: {
          analysis_mode: string | null
          audio_bpm: number | null
          audio_gait_classification: string | null
          audio_regularity: number | null
          beat_pattern: string | null
          breed_id: string | null
          confidence: number | null
          conflict_description: string | null
          created_at: string
          dmrt3_genotype: string | null
          enriched_data: Json | null
          gait_type: string | null
          gait_type_hebrew: string | null
          horse_id: string | null
          horse_name: string | null
          human_validated: boolean | null
          id: string
          is_dirty: boolean | null
          lameness_risk: string | null
          lateral_sync_pct: number | null
          model_version: string | null
          notes: string | null
          overall_score: number | null
          result_json: Json
          share_token: string | null
          snapshot_urls: string[] | null
          symmetry_score: number | null
          tags: string[] | null
          user_id: string | null
          video_hash: string | null
          vision_audio_conflict: boolean | null
        }
        Insert: {
          analysis_mode?: string | null
          audio_bpm?: number | null
          audio_gait_classification?: string | null
          audio_regularity?: number | null
          beat_pattern?: string | null
          breed_id?: string | null
          confidence?: number | null
          conflict_description?: string | null
          created_at?: string
          dmrt3_genotype?: string | null
          enriched_data?: Json | null
          gait_type?: string | null
          gait_type_hebrew?: string | null
          horse_id?: string | null
          horse_name?: string | null
          human_validated?: boolean | null
          id?: string
          is_dirty?: boolean | null
          lameness_risk?: string | null
          lateral_sync_pct?: number | null
          model_version?: string | null
          notes?: string | null
          overall_score?: number | null
          result_json: Json
          share_token?: string | null
          snapshot_urls?: string[] | null
          symmetry_score?: number | null
          tags?: string[] | null
          user_id?: string | null
          video_hash?: string | null
          vision_audio_conflict?: boolean | null
        }
        Update: {
          analysis_mode?: string | null
          audio_bpm?: number | null
          audio_gait_classification?: string | null
          audio_regularity?: number | null
          beat_pattern?: string | null
          breed_id?: string | null
          confidence?: number | null
          conflict_description?: string | null
          created_at?: string
          dmrt3_genotype?: string | null
          enriched_data?: Json | null
          gait_type?: string | null
          gait_type_hebrew?: string | null
          horse_id?: string | null
          horse_name?: string | null
          human_validated?: boolean | null
          id?: string
          is_dirty?: boolean | null
          lameness_risk?: string | null
          lateral_sync_pct?: number | null
          model_version?: string | null
          notes?: string | null
          overall_score?: number | null
          result_json?: Json
          share_token?: string | null
          snapshot_urls?: string[] | null
          symmetry_score?: number | null
          tags?: string[] | null
          user_id?: string | null
          video_hash?: string | null
          vision_audio_conflict?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_gait_horse"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gait_analyses_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      gait_label_consensus: {
        Row: {
          agreement: number | null
          analysis_id: string
          clip_id: string | null
          created_at: string | null
          final_label: string
          id: string
          label_stats: Json | null
          method: string
        }
        Insert: {
          agreement?: number | null
          analysis_id: string
          clip_id?: string | null
          created_at?: string | null
          final_label: string
          id?: string
          label_stats?: Json | null
          method?: string
        }
        Update: {
          agreement?: number | null
          analysis_id?: string
          clip_id?: string | null
          created_at?: string | null
          final_label?: string
          id?: string
          label_stats?: Json | null
          method?: string
        }
        Relationships: []
      }
      gait_label_votes: {
        Row: {
          alternatives: Json | null
          analysis_id: string
          annotator_id: string
          annotator_role: string
          capture_meta: Json | null
          clip_id: string | null
          confidence: number | null
          created_at: string | null
          id: string
          label: string
          notes: string | null
          tags: Json | null
        }
        Insert: {
          alternatives?: Json | null
          analysis_id: string
          annotator_id: string
          annotator_role?: string
          capture_meta?: Json | null
          clip_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          label: string
          notes?: string | null
          tags?: Json | null
        }
        Update: {
          alternatives?: Json | null
          analysis_id?: string
          annotator_id?: string
          annotator_role?: string
          capture_meta?: Json | null
          clip_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          label?: string
          notes?: string | null
          tags?: Json | null
        }
        Relationships: []
      }
      gait_validations: {
        Row: {
          analysis_id: string
          comment: string | null
          confidence: number | null
          created_at: string | null
          id: string
          label_source: string | null
          labeled_gait_type: string
          validator_id: string
        }
        Insert: {
          analysis_id: string
          comment?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          label_source?: string | null
          labeled_gait_type: string
          validator_id: string
        }
        Update: {
          analysis_id?: string
          comment?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          label_source?: string | null
          labeled_gait_type?: string
          validator_id?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          created_at: string
          date: string
          description: string
          horse_id: string | null
          id: string
          notes: string | null
          provider: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          description: string
          horse_id?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          horse_id?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_health_horse"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_videos: {
        Row: {
          analysis_id: string | null
          created_at: string
          duration_seconds: number | null
          file_path: string
          file_size_bytes: number | null
          file_url: string
          horse_id: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_path: string
          file_size_bytes?: number | null
          file_url: string
          horse_id: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_path?: string
          file_size_bytes?: number | null
          file_url?: string
          horse_id?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_videos_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "gait_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_videos_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      horses: {
        Row: {
          birth_year: number | null
          breed_id: string | null
          breeding_date: string | null
          cover_photo_url: string | null
          created_at: string
          dam_dmrt3: string | null
          dam_name: string | null
          dmrt3_genotype: string | null
          height_cm: number | null
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          sex: string | null
          sire_dmrt3: string | null
          sire_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_year?: number | null
          breed_id?: string | null
          breeding_date?: string | null
          cover_photo_url?: string | null
          created_at?: string
          dam_dmrt3?: string | null
          dam_name?: string | null
          dmrt3_genotype?: string | null
          height_cm?: number | null
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          sex?: string | null
          sire_dmrt3?: string | null
          sire_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_year?: number | null
          breed_id?: string | null
          breeding_date?: string | null
          cover_photo_url?: string | null
          created_at?: string
          dam_dmrt3?: string | null
          dam_name?: string | null
          dmrt3_genotype?: string | null
          height_cm?: number | null
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          sex?: string | null
          sire_dmrt3?: string | null
          sire_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      load_test_results: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          credit_charged: boolean | null
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          run_id: string | null
          scenario: string
          status_code: number | null
          success: boolean | null
          truncated: boolean | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          credit_charged?: boolean | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          run_id?: string | null
          scenario: string
          status_code?: number | null
          success?: boolean | null
          truncated?: boolean | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          credit_charged?: boolean | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          run_id?: string | null
          scenario?: string
          status_code?: number | null
          success?: boolean | null
          truncated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "load_test_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "load_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      load_test_runs: {
        Row: {
          config: Json
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
          summary: Json | null
          user_id: string
        }
        Insert: {
          config?: Json
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          user_id: string
        }
        Update: {
          config?: Json
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      mare_pregnancies: {
        Row: {
          breeding_date: string
          created_at: string
          date_basis: string
          expected_foaling_date: string | null
          horse_id: string
          id: string
          notes: string
          status: string
          user_id: string
          veterinarian: string
        }
        Insert: {
          breeding_date: string
          created_at?: string
          date_basis?: string
          expected_foaling_date?: string | null
          horse_id: string
          id?: string
          notes?: string
          status?: string
          user_id?: string
          veterinarian?: string
        }
        Update: {
          breeding_date?: string
          created_at?: string
          date_basis?: string
          expected_foaling_date?: string | null
          horse_id?: string
          id?: string
          notes?: string
          status?: string
          user_id?: string
          veterinarian?: string
        }
        Relationships: [
          {
            foreignKeyName: "mare_pregnancies_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          model_name: string
          task: string
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          model_name: string
          task: string
          version: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          model_name?: string
          task?: string
          version?: string
        }
        Relationships: []
      }
      pipeline_events: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          stage: string
          status: string
          user_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          stage: string
          status: string
          user_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          stage?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pregnancy_examinations: {
        Row: {
          created_at: string
          examination_date: string
          examination_type: string
          findings: string
          id: string
          next_check_date: string | null
          pregnancy_id: string
          user_id: string
          veterinarian: string
        }
        Insert: {
          created_at?: string
          examination_date: string
          examination_type: string
          findings?: string
          id?: string
          next_check_date?: string | null
          pregnancy_id: string
          user_id?: string
          veterinarian?: string
        }
        Update: {
          created_at?: string
          examination_date?: string
          examination_type?: string
          findings?: string
          id?: string
          next_check_date?: string | null
          pregnancy_id?: string
          user_id?: string
          veterinarian?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_examinations_pregnancy_id_fkey"
            columns: ["pregnancy_id"]
            isOneToOne: false
            referencedRelation: "mare_pregnancies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      training_logs: {
        Row: {
          ai_recommendations: string | null
          analysis_id: string | null
          created_at: string
          date: string
          description: string | null
          duration_minutes: number | null
          horse_id: string | null
          id: string
          notes: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          ai_recommendations?: string | null
          analysis_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number | null
          horse_id?: string | null
          id?: string
          notes?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          ai_recommendations?: string | null
          analysis_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number | null
          horse_id?: string | null
          id?: string
          notes?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_training_horse"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_logs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "gait_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_logs_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      validation_consensus: {
        Row: {
          analysis_id: string | null
          avg_confidence: number | null
          labeled_gait_type: string | null
          validator_count: number | null
          vote_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_log_media: {
        Args: { _action: string; _bucket: string; _name: string }
        Returns: undefined
      }
      admin_manage_invite: {
        Args: { _allow: boolean; _email: string }
        Returns: undefined
      }
      admin_save_setting: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      admin_set_credits: {
        Args: { _remaining: number; _target: string; _tier: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: { _admin: boolean; _target: string }
        Returns: undefined
      }
      deduct_credit: {
        Args: { _amount?: number; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      init_user_credits: { Args: { _user_id: string }; Returns: undefined }
      is_email_allowed: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
