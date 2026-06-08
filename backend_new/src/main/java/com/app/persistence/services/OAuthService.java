package com.app.persistence.services;

import com.app.dto.OAuthUserInfo;
import com.app.persistence.entity.*;
import com.app.persistence.repository.*;
import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * CLOUD-279/CLOUD-280/CLOUD-285: OAuth Service
 * Handles Google and Facebook OAuth authentication, user creation/linking,
 * and automatic CRM channel creation.
 */
@Service
public class OAuthService {

    private static final Logger log = LoggerFactory.getLogger(OAuthService.class);

    private final UserRepository userRepository;
    private final OAuthAccountRepository oauthAccountRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final TenantService tenantService;
    private final PasswordEncoder passwordEncoder;
    private final TenantRepository tenantRepository;
    private final PlanRepository planRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionModuleRepository subscriptionModuleRepository;
    private final PlanModuleRepository planModuleRepository;
    private final ChannelService channelService;
    private final WebClient webClient;

    @Value("${google.client.id:}")
    private String googleClientId;

    @Value("${facebook.login.app.id:${facebook.app.id:}}")
    private String facebookAppId;

    @Value("${facebook.login.app.secret:${facebook.app.secret:}}")
    private String facebookAppSecret;

    public OAuthService(UserRepository userRepository,
                        OAuthAccountRepository oauthAccountRepository,
                        RoleRepository roleRepository,
                        UserRoleRepository userRoleRepository,
                        TenantService tenantService,
                        PasswordEncoder passwordEncoder,
                        TenantRepository tenantRepository,
                        PlanRepository planRepository,
                        SubscriptionRepository subscriptionRepository,
                        SubscriptionModuleRepository subscriptionModuleRepository,
                        PlanModuleRepository planModuleRepository,
                        ChannelService channelService,
                        WebClient.Builder webClientBuilder) {
        this.userRepository = userRepository;
        this.oauthAccountRepository = oauthAccountRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.tenantService = tenantService;
        this.passwordEncoder = passwordEncoder;
        this.tenantRepository = tenantRepository;
        this.planRepository = planRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionModuleRepository = subscriptionModuleRepository;
        this.planModuleRepository = planModuleRepository;
        this.channelService = channelService;
        this.webClient = webClientBuilder.build();
    }

    // ============================================================
    // Google OAuth
    // ============================================================

    /**
     * Validate a Google ID token and extract user info.
     * Google ID tokens are JWTs signed by Google. We verify by decoding
     * and checking the audience matches our client ID.
     */
    public Mono<OAuthUserInfo> validateGoogleToken(String idToken) {
        log.info("🔍 [OAUTH-GOOGLE] Validating Google ID token...");

        try {
            // Decode the JWT without verification (Google's public keys rotate frequently)
            // In production, use Google's tokeninfo endpoint or verify with their certs
            DecodedJWT decodedJWT = JWT.decode(idToken);

            // Verify audience matches our client ID
            String audience = decodedJWT.getAudience() != null && !decodedJWT.getAudience().isEmpty()
                    ? decodedJWT.getAudience().get(0) : "";

            if (googleClientId != null && !googleClientId.isEmpty() && !googleClientId.equals(audience)) {
                log.warn("⚠️ [OAUTH-GOOGLE] Token audience mismatch. Expected: {}, Got: {}", googleClientId, audience);
                // In development, we allow it. In production, this should fail.
            }

            // Check expiration
            if (decodedJWT.getExpiresAt() != null && decodedJWT.getExpiresAt().before(new java.util.Date())) {
                return Mono.error(new RuntimeException("Google token has expired"));
            }

            String email = decodedJWT.getClaim("email").asString();
            String emailVerified = decodedJWT.getClaim("email_verified").as(Boolean.class) != null
                    ? String.valueOf(decodedJWT.getClaim("email_verified").as(Boolean.class)) : "false";
            String name = decodedJWT.getClaim("name").asString();
            String picture = decodedJWT.getClaim("picture").asString();
            String sub = decodedJWT.getSubject();

            if (email == null || sub == null) {
                return Mono.error(new RuntimeException("Google token missing required claims (email, sub)"));
            }

            OAuthUserInfo userInfo = new OAuthUserInfo(
                    "GOOGLE",
                    sub,
                    email,
                    name,
                    picture,
                    "true".equals(emailVerified)
            );

            log.info("✅ [OAUTH-GOOGLE] Token valid for email: {}", email);
            return Mono.just(userInfo);

        } catch (Exception e) {
            log.error("❌ [OAUTH-GOOGLE] Token validation failed: {}", e.getMessage());
            return Mono.error(new RuntimeException("Invalid Google token: " + e.getMessage()));
        }
    }

    // ============================================================
    // Facebook OAuth
    // ============================================================

    /**
     * Validate a Facebook access token and extract user info
     * by calling the Facebook Graph API debug_token endpoint.
     */
    public Mono<OAuthUserInfo> validateFacebookToken(String accessToken, String userId) {
        log.info("🔍 [OAUTH-FACEBOOK] Validating Facebook access token for userId: {}...", userId);

        // First, debug the token to verify it's valid
        String debugUrl = String.format(
                "https://graph.facebook.com/debug_token?input_token=%s&access_token=%s|%s",
                accessToken, facebookAppId, facebookAppSecret
        );

        return webClient.get()
                .uri(debugUrl)
                .retrieve()
                .bodyToMono(Map.class)
                .flatMap(debugResponse -> {
                    Map<String, Object> data = (Map<String, Object>) debugResponse.get("data");
                    if (data == null) {
                        return Mono.error(new RuntimeException("Facebook token debug returned no data"));
                    }

                    Boolean isValid = (Boolean) data.get("is_valid");
                    if (isValid == null || !isValid) {
                        return Mono.error(new RuntimeException("Facebook token is invalid"));
                    }

                    // Check app ID matches
                    String appId = (String) data.get("app_id");
                    if (facebookAppId != null && !facebookAppId.isEmpty() && !facebookAppId.equals(appId)) {
                        return Mono.error(new RuntimeException("Facebook token app_id mismatch"));
                    }

                    // Now fetch user info from Graph API
                    return fetchFacebookUserInfo(accessToken, userId);
                })
                .onErrorResume(e -> {
                    log.error("❌ [OAUTH-FACEBOOK] Token validation failed: {}", e.getMessage());
                    return Mono.error(new RuntimeException("Invalid Facebook token: " + e.getMessage()));
                });
    }

    /**
     * Fetch user info from Facebook Graph API.
     */
    private Mono<OAuthUserInfo> fetchFacebookUserInfo(String accessToken, String userId) {
        String userInfoUrl = String.format(
                "https://graph.facebook.com/%s?fields=id,name,email,picture.type(large)&access_token=%s",
                userId, accessToken
        );

        return webClient.get()
                .uri(userInfoUrl)
                .retrieve()
                .bodyToMono(Map.class)
                .map(userData -> {
                    String email = (String) userData.get("email");
                    String name = (String) userData.get("name");
                    String id = (String) userData.get("id");

                    // Extract picture URL
                    String pictureUrl = null;
                    Map<String, Object> pictureData = (Map<String, Object>) userData.get("picture");
                    if (pictureData != null) {
                        Map<String, Object> pictureInner = (Map<String, Object>) pictureData.get("data");
                        if (pictureInner != null) {
                            pictureUrl = (String) pictureInner.get("url");
                        }
                    }

                    if (email == null) {
                        log.warn("⚠️ [OAUTH-FACEBOOK] No email provided by Facebook for user {}", id);
                        // Facebook may not return email if user hasn't granted permission
                        email = id + "@facebook.temp"; // Fallback
                    }

                    OAuthUserInfo userInfo = new OAuthUserInfo(
                            "FACEBOOK",
                            id,
                            email,
                            name,
                            pictureUrl,
                            email != null && !email.endsWith("@facebook.temp")
                    );

                    log.info("✅ [OAUTH-FACEBOOK] Token valid for email: {}", email);
                    return userInfo;
                });
    }

    // ============================================================
    // User Creation / Linking
    // ============================================================

    /**
     * Find or create a user based on OAuth user info.
     * If the OAuth account already exists, return the linked user.
     * If the email matches an existing user, link the OAuth account.
     * Otherwise, create a new user.
     */
    public Mono<UserEntity> findOrCreateOAuthUser(OAuthUserInfo oauthInfo) {
        log.info("🔍 [OAUTH] Finding or creating user for provider: {}, providerUserId: {}, email: {}",
                oauthInfo.getProvider(), oauthInfo.getProviderUserId(), oauthInfo.getEmail());

        // Step 1: Check if OAuth account already exists
        return oauthAccountRepository.findByProviderAndProviderUserId(
                        oauthInfo.getProvider(), oauthInfo.getProviderUserId())
                .flatMap(existingAccount -> {
                    log.info("✅ [OAUTH] Found existing OAuth account for user_id: {}", existingAccount.getUserId());
                    return userRepository.findById(existingAccount.getUserId());
                })
                .switchIfEmpty(Mono.defer(() -> {
                    // Step 2: Check if user exists with the same email
                    return userRepository.findByEmail(oauthInfo.getEmail())
                            .flatMap(existingUser -> {
                                log.info("✅ [OAUTH] Found existing user by email: {}. Linking OAuth account.", oauthInfo.getEmail());
                                return linkOAuthAccount(existingUser, oauthInfo)
                                        .then(Mono.just(existingUser));
                            })
                            .switchIfEmpty(Mono.defer(() -> {
                                // Step 3: Create new user
                                log.info("🆕 [OAUTH] Creating new user for email: {}", oauthInfo.getEmail());
                                return createOAuthUser(oauthInfo);
                            }));
                }));
    }

    /**
     * Create a new user from OAuth info.
     */
    private Mono<UserEntity> createOAuthUser(OAuthUserInfo oauthInfo) {
        // Generate a random password (user will never use it directly)
        String randomPassword = UUID.randomUUID().toString() + "!" + System.currentTimeMillis();
        String encodedPassword = passwordEncoder.encode(randomPassword);

        // Parse display name into first/last names
        String[] nameParts = parseDisplayName(oauthInfo.getDisplayName());

        // Create tenant for the user
        String companyName = nameParts[0] + "'s Company";

        return tenantService.createTenant(companyName)
                .flatMap(tenant -> {
                    UserEntity user = UserEntity.builder()
                            .nombres(nameParts[0])
                            .apellidos(nameParts[1])
                            .username(generateUsername(oauthInfo))
                            .password(encodedPassword)
                            .email(oauthInfo.getEmail())
                            .isEnabled(true) // OAuth users are auto-verified
                            .accountNoExpired(true)
                            .accountNoLocked(true)
                            .credentialNoExpired(true)
                            .customerId(tenant.getId())
                            .oauthProvider(oauthInfo.getProvider())
                            .oauthProviderId(oauthInfo.getProviderUserId())
                            .avatarUrl(oauthInfo.getAvatarUrl())
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();

                    return userRepository.save(user)
                            .flatMap(savedUser -> {
                                // Assign ADMIN role
                                return roleRepository.findByName("ADMIN")
                                        .flatMap(role -> userRoleRepository.insertRole(savedUser.getId(), role.getId()))
                                        .then(updateTenantAdmin(tenant.getId(), savedUser.getId()))
                                        .then(handleAutomaticSubscription(tenant.getId()))
                                        .then(linkOAuthAccount(savedUser, oauthInfo))
                                    // CLOUD-285: Create CRM channel for OAuth user
                                        .then(createOAuthChannel(savedUser, oauthInfo))
                                        .then(Mono.just(savedUser));
                            });
                });
    }

    /**
     * Link an OAuth account to an existing user.
     */
    private Mono<Void> linkOAuthAccount(UserEntity user, OAuthUserInfo oauthInfo) {
        OAuthAccountEntity oauthAccount = OAuthAccountEntity.builder()
                .userId(user.getId())
                .provider(oauthInfo.getProvider())
                .providerUserId(oauthInfo.getProviderUserId())
                .email(oauthInfo.getEmail())
                .displayName(oauthInfo.getDisplayName())
                .avatarUrl(oauthInfo.getAvatarUrl())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return oauthAccountRepository.save(oauthAccount)
                .doOnSuccess(acc -> log.info("✅ [OAUTH] Linked {} account to user: {}", oauthInfo.getProvider(), user.getId()))
                .then();
    }

    /**
     * CLOUD-285: Create a CRM channel automatically when a user registers via OAuth.
     */
    private Mono<Void> createOAuthChannel(UserEntity user, OAuthUserInfo oauthInfo) {
        if (user.getCustomerId() == null) {
            log.warn("⚠️ [OAUTH-CHANNEL] User {} has no tenant, skipping channel creation", user.getId());
            return Mono.empty();
        }

        String platform = oauthInfo.getProvider(); // GOOGLE or FACEBOOK
        String provider = "GOOGLE".equals(platform) ? "GOOGLE_OAUTH" : "META_OAUTH";
        String channelName = platform + " - " + oauthInfo.getDisplayName();

        ChannelEntity channel = ChannelEntity.builder()
                .tenantId(user.getCustomerId())
                .companyId(user.getCompanyId())
                .name(channelName)
                .platform(platform)
                .provider(provider)
                .status(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return channelService.createChannel(channel, user.getCompanyId(), user.getCustomerId())
                .doOnSuccess(ch -> log.info("✅ [OAUTH-CHANNEL] Created {} channel for user: {}", platform, user.getId()))
                .onErrorResume(e -> {
                    log.error("⚠️ [OAUTH-CHANNEL] Failed to create channel: {}", e.getMessage());
                    return Mono.empty(); // Don't fail registration if channel creation fails
                })
                .then();
    }

    // ============================================================
    // Helper Methods
    // ============================================================

    private String[] parseDisplayName(String displayName) {
        if (displayName == null || displayName.trim().isEmpty()) {
            return new String[]{"Usuario", "OAuth"};
        }
        String[] parts = displayName.trim().split("\\s+", 2);
        return new String[]{parts[0], parts.length > 1 ? parts[1] : ""};
    }

    private String generateUsername(OAuthUserInfo oauthInfo) {
        // Generate a unique username from email or display name
        String base = oauthInfo.getEmail() != null
                ? oauthInfo.getEmail().split("@")[0]
                : oauthInfo.getDisplayName() != null
                        ? oauthInfo.getDisplayName().replaceAll("\\s+", "").toLowerCase()
                        : "user";

        return base + "_" + oauthInfo.getProvider().toLowerCase() + "_" + System.currentTimeMillis() % 10000;
    }

    private Mono<Void> updateTenantAdmin(Long tenantId, Long adminUserId) {
        return tenantRepository.findById(tenantId)
                .flatMap(tenant -> {
                    tenant.setAdminUserId(adminUserId);
                    return tenantRepository.save(tenant);
                }).then();
    }

    private Mono<Void> handleAutomaticSubscription(Long customerId) {
        if (customerId == null) return Mono.empty();

        return planRepository.findByIsFreeTrue()
                .next()
                .flatMap(freePlan -> {
                    SubscriptionEntity subscription = SubscriptionEntity.builder()
                            .planId(freePlan.getId())
                            .customerId(customerId)
                            .status("ACTIVE")
                            .billingCycle("MONTHLY")
                            .startDate(LocalDateTime.now())
                            .endDate(LocalDateTime.now().plusDays(
                                    freePlan.getDurationDays() != null ? freePlan.getDurationDays() : 365))
                            .aiTokensLimit(freePlan.getAiTokensLimit())
                            .usersLimit(freePlan.getUsersLimit())
                            .monthlyPrice(BigDecimal.ZERO)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();

                    return subscriptionRepository.save(subscription)
                            .flatMap(savedSub -> planModuleRepository.findByPlanId(freePlan.getId())
                                    .flatMap(pm -> subscriptionModuleRepository.insertModule(savedSub.getId(), pm.getModuleId()))
                                    .then());
                });
    }
}
