-- Add nullable source metadata only; keep every existing deadline unchanged.
-- Legacy deadlines intentionally retain both metadata columns as NULL.
SET SESSION time_zone = '+00:00';

ALTER TABLE `opportunities`
    ADD COLUMN `deadline_source_date` DATE NULL,
    ADD COLUMN `deadline_source_timezone` VARCHAR(64) NULL,
    ADD CONSTRAINT `chk_opportunities_deadline_metadata` CHECK (
        (`deadline` IS NOT NULL OR (`deadline_source_date` IS NULL AND `deadline_source_timezone` IS NULL))
        AND (`deadline_source_date` IS NULL OR `deadline_source_timezone` IS NULL)
    );
