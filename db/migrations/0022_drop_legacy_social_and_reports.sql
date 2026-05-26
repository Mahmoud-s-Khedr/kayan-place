-- Remove deprecated PM V1 features: categories, favorites, blocks, user reports.

DROP TABLE IF EXISTS user_reports;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_blocks;
DROP TABLE IF EXISTS categories;

DROP TYPE IF EXISTS report_status;
