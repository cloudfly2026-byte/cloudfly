package com.app.persistence.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/**
 * CLOUD-278: OAuth Account Entity
 * Stores linked OAuth accounts (Google, Facebook, Microsoft) for users.
 * A single user can have multiple OAuth accounts linked.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table("user_oauth_accounts")
public class OAuthAccountEntity {

    @Id
    private Long id;

    @Column("user_id")
    private Long userId;

    /**
     * OAuth provider name: GOOGLE, FACEBOOK, MICROSOFT
     */
    private String provider;

    /**
     * Unique user ID from the OAuth provider
     */
    @Column("provider_user_id")
    private String providerUserId;

    /**
     * Email from OAuth provider (may differ from account email)
     */
    private String email;

    /**
     * Display name from OAuth provider
     */
    @Column("display_name")
    private String displayName;

    /**
     * Profile picture URL from OAuth provider
     */
    @Column("avatar_url")
    private String avatarUrl;

    /**
     * Encrypted access token for API calls on behalf of user
     */
    @Column("access_token")
    private String accessToken;

    /**
     * Encrypted refresh token
     */
    @Column("refresh_token")
    private String refreshToken;

    /**
     * When the access token expires
     */
    @Column("token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;

    // Explicit getters/setters to bypass Lombok issues on VPS
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getProviderUserId() { return providerUserId; }
    public void setProviderUserId(String providerUserId) { this.providerUserId = providerUserId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public LocalDateTime getTokenExpiresAt() { return tokenExpiresAt; }
    public void setTokenExpiresAt(LocalDateTime tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
