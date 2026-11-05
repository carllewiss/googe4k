#!/usr/bin/env bash
# ==============================================================================
# 4K Smart Solutions ERP - Supabase Edge Functions Deployment Script
# Target Project: https://jeujndewidagwrmmanxr.supabase.co (jeujndewidagwrmmanxr)
# ==============================================================================

set -euo pipefail

PROJECT_REF="jeujndewidagwrmmanxr"

echo "Deploying all 10 Edge Functions to Supabase project: $PROJECT_REF"

FUNCTIONS_NO_JWT=(
  "shop-checkout-stk"
  "shop-mpesa-callback"
  "invoice-stk-push"
  "invoice-mpesa-callback"
  "sync-wifi-payments"
  "wifi-vouchers"
)

FUNCTIONS_WITH_JWT=(
  "admin-create-user"
  "admin-reset-password"
  "db-backup"
  "db-restore"
)

for fn in "${FUNCTIONS_NO_JWT[@]}"; do
  echo ">>> Deploying function: $fn (verify_jwt=false) <<<"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
done

for fn in "${FUNCTIONS_WITH_JWT[@]}"; do
  echo ">>> Deploying function: $fn (verify_jwt=true) <<<"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "All 10 Edge Functions deployed successfully to $PROJECT_REF!"
