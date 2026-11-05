-- Drop event reminder email outbox table.
-- All migration and application sessions must use UTC.
-- Preserve remaining 13 business tables and integrity.

SET SESSION time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_ci;

DROP TABLE IF EXISTS `event_reminder_emails`;

