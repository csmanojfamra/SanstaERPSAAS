-- Sanwaliya Seth Mandir Deoli — client admin domain (manage.sanwaliyasethdeoli.in)
UPDATE "Trust"
SET "custom_domain" = 'manage.sanwaliyasethdeoli.in'
WHERE "slug" = 'sanwaliya-seth-deoli'
  AND ("custom_domain" IS NULL OR "custom_domain" = '');
