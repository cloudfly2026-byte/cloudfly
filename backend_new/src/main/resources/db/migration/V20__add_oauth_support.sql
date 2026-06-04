-- CLOUD-278: OAuth Support Migration
-- Adds OAuth columns to users table and creates user_oauth_accounts table

-- ============================================================
-- 1. Add OAuth columns to users table
-- ============================================================
ALTER TABLE users
    ADD COLUMN oauth_provider VARCHAR(50) NULL COMMENT 'OAuth provider: GOOGLE, FACEBOOK, MICROSOFT' AFTER avatar_id,
    ADD COLUMN oauth_provider_id VARCHAR(255) NULL COMMENT 'Unique ID from the OAuth provider' AFTER oauth_provider,
    ADD COLUMN avatar_url VARCHAR(500) NULL COMMENT 'Profile picture URL from OAuth provider' AFTER oauth_provider_id;

-- Add index for faster lookups by OAuth provider + provider_id
CREATE INDEX idx_users_oauth ON users (oauth_provider, oauth_provider_id);

-- Add index for avatar_url lookups
CREATE INDEX idx_users_avatar_url ON users (avatar_url);

-- ============================================================
-- 2. Create user_oauth_accounts table
-- ============================================================
CREATE TABLE user_oauth_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT 'FK to users.id',
    provider VARCHAR(50) NOT NULL COMMENT 'OAuth provider: GOOGLE, FACEBOOK, MICROSOFT',
    provider_user_id VARCHAR(255) NOT NULL COMMENT 'Unique user ID from the OAuth provider',
    email VARCHAR(255) NULL COMMENT 'Email from OAuth provider',
    display_name VARCHAR(255) NULL COMMENT 'Display name from OAuth provider',
    avatar_url VARCHAR(500) NULL COMMENT 'Profile picture URL from OAuth provider',
    access_token TEXT NULL COMMENT 'Encrypted access token (for API calls on behalf of user)',
    refresh_token TEXT NULL COMMENT 'Encrypted refresh token',
    token_expires_at TIMESTAMP NULL COMMENT 'When the access token expires',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_provider_user (provider, provider_user_id),
    INDEX idx_oauth_user_id (user_id),
    INDEX idx_oauth_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Linked OAuth accounts for users';

-- ============================================================
-- 3. Add OAuth-related channel types support
-- Note: ChannelEntity uses String for platform/provider fields,
-- so GOOGLE and FACEBOOK can be stored without schema changes.
-- This migration just ensures the channels table can store
-- OAuth-created channels properly.
-- ============================================================
-- No changes needed to channels table - platform and provider are VARCHAR fields
