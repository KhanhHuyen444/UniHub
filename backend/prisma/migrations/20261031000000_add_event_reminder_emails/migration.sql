-- Draft for review; not applied as part of Phase 1.
-- Add only the event reminder email outbox.
-- All migration and application sessions must use UTC.
-- No existing-table changes, backfill, triggers or reconciliation.

SET SESSION time_zone = '+00:00';
SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_ci;

CREATE TABLE `event_reminder_emails` (
    `notification_id` INTEGER NOT NULL,

    `payload_json` LONGTEXT NOT NULL,
    `idempotency_key` VARCHAR(256)
        CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    `state` VARCHAR(10) NOT NULL DEFAULT 'Pending',
    `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    `lease_token` CHAR(36)
        CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
    `lease_expires_at` DATETIME(0) NULL DEFAULT NULL,
    `first_attempt_at` DATETIME(0) NULL DEFAULT NULL,

    `provider_email_id` VARCHAR(255) NULL DEFAULT NULL,
    `accepted_at` DATETIME(0) NULL DEFAULT NULL,
    `last_error_code` VARCHAR(64) NULL DEFAULT NULL,

    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0)
        ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`notification_id`),

    UNIQUE INDEX `ere_idempotency_key_uq` (`idempotency_key`),
    INDEX `ere_ready_idx`
        (`state`, `next_attempt_at`, `notification_id`),
    INDEX `ere_lease_idx`
        (`state`, `lease_expires_at`, `notification_id`),

    CONSTRAINT `ere_notification_id_fkey`
        FOREIGN KEY (`notification_id`)
        REFERENCES `notifications` (`notification_id`)
        ON DELETE CASCADE ON UPDATE RESTRICT,

    CONSTRAINT `chk_ere_state` CHECK (
        `state` COLLATE utf8mb4_0900_as_cs IN (
            'Pending', 'Processing', 'Retry',
            'Accepted', 'Cancelled', 'Dead'
        )
    ),

    CONSTRAINT `chk_ere_attempt_count` CHECK (
        `attempt_count` BETWEEN 0 AND 6
    ),

    CONSTRAINT `chk_ere_payload_json` CHECK (
        JSON_VALID(`payload_json`)
    ),

    CONSTRAINT `chk_ere_idempotency_key` CHECK (
        CHAR_LENGTH(`idempotency_key`) BETWEEN 1 AND 256
    ),

    CONSTRAINT `chk_ere_lease` CHECK (
        (
            `state` COLLATE utf8mb4_0900_as_cs = 'Processing'
            AND `lease_token` IS NOT NULL
            AND `lease_expires_at` IS NOT NULL
        )
        OR
        (
            `state` COLLATE utf8mb4_0900_as_cs <> 'Processing'
            AND `lease_token` IS NULL
            AND `lease_expires_at` IS NULL
        )
    ),

    CONSTRAINT `chk_ere_attempt_clock` CHECK (
        (
            `attempt_count` = 0
            AND `first_attempt_at` IS NULL
        )
        OR
        (
            `attempt_count` > 0
            AND `first_attempt_at` IS NOT NULL
        )
    ),

    CONSTRAINT `chk_ere_state_attempts` CHECK (
        (
            `state` COLLATE utf8mb4_0900_as_cs <> 'Pending'
            OR `attempt_count` = 0
        )
        AND
        (
            `state` COLLATE utf8mb4_0900_as_cs <> 'Processing'
            OR `attempt_count` BETWEEN 1 AND 6
        )
        AND
        (
            `state` COLLATE utf8mb4_0900_as_cs <> 'Retry'
            OR `attempt_count` BETWEEN 1 AND 5
        )
    ),

    CONSTRAINT `chk_ere_acceptance` CHECK (
        (
            `state` COLLATE utf8mb4_0900_as_cs = 'Accepted'
            AND `provider_email_id` IS NOT NULL
            AND `accepted_at` IS NOT NULL
            AND `attempt_count` BETWEEN 1 AND 6
        )
        OR
        (
            `state` COLLATE utf8mb4_0900_as_cs <> 'Accepted'
            AND `provider_email_id` IS NULL
            AND `accepted_at` IS NULL
        )
    )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_as_ci;
