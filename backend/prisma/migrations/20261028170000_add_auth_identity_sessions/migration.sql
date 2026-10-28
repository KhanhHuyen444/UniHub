-- Add only the auth identity/session structures approved in docs/auth-api-contract.md.
-- Existing users keep google_sub = NULL; no email-based backfill or account linking occurs here.
-- Migration and application sessions use UTC for DATETIME(0) values.
SET SESSION time_zone = '+00:00';

ALTER TABLE `users`
    ADD COLUMN `google_sub` VARCHAR(255)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL DEFAULT NULL AFTER `user_id`,
    ADD UNIQUE INDEX `users_google_sub_key` (`google_sub`);

CREATE TABLE `auth_sessions` (
    `session_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `user_id` INTEGER NOT NULL,
    `refresh_token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `revoked_at` DATETIME(0) NULL DEFAULT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `auth_sessions_refresh_token_hash_key` (`refresh_token_hash`),
    INDEX `auth_sessions_user_id_idx` (`user_id`),
    PRIMARY KEY (`session_id`),
    CONSTRAINT `auth_sessions_user_id_fkey`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;
