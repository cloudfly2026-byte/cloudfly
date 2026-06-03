package com.app.dto;

/**
 * CLOUD-279/CLOUD-280: DTO representing user information extracted from an OAuth provider.
 */
public class OAuthUserInfo {

    private String provider;       // GOOGLE, FACEBOOK
    private String providerUserId; // Unique ID from the provider
    private String email;
    private String displayName;
    private String avatarUrl;
    private boolean emailVerified;

    public OAuthUserInfo() {}

    public OAuthUserInfo(String provider, String providerUserId, String email, String displayName, String avatarUrl, boolean emailVerified) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.emailVerified = emailVerified;
    }

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
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
}
