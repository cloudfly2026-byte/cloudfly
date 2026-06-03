package com.app.dto;

/**
 * CLOUD-279/CLOUD-280: DTO for OAuth login requests.
 * Contains the credential/token received from the OAuth provider (Google/Facebook).
 */
public class OAuthLoginRequest {

    /**
     * For Google: the ID token credential (JWT from Google Identity Services)
     * For Facebook: the access token from FB.login()
     */
    private String credential;

    /**
     * For Facebook: the user ID from FB.login() response
     * For Google: not used (extracted from ID token)
     */
    private String userId;

    /**
     * Provider identifier: "GOOGLE" or "FACEBOOK"
     */
    private String provider;

    public OAuthLoginRequest() {}

    public String getCredential() { return credential; }
    public void setCredential(String credential) { this.credential = credential; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
