-- Add JSON settings bucket for governance/compliance configuration
ALTER TABLE "Trust"
ADD COLUMN "settings_json" JSONB;
