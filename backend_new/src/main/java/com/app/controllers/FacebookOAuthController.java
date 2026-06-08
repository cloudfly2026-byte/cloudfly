package com.app.controllers;

import com.app.dto.AuthResponse;
import com.app.dto.OAuthLoginRequest;
import com.app.dto.OAuthUserInfo;
import com.app.persistence.entity.UserEntity;
import com.app.persistence.repository.RoleRepository;
import com.app.persistence.services.OAuthService;
import com.app.persistence.services.UserService;
import com.app.util.JwtProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * CLOUD-280: Facebook OAuth Controller
 * Handles POST /api/v2/auth/oauth/facebook
 * Validates Facebook access token and returns JWT.
 */
@RestController
@RequestMapping("/api/v2/auth/oauth")
@CrossOrigin(origins = "*")
public class FacebookOAuthController {

    private static final Logger log = LoggerFactory.getLogger(FacebookOAuthController.class);

    private final OAuthService oauthService;
    private final UserService userService;
    private final JwtProvider jwtProvider;
    private final RoleRepository roleRepository;

    @org.springframework.beans.factory.annotation.Value("${facebook.login.app.id:${facebook.app.id:}}")
    private String facebookLoginAppId;

    public FacebookOAuthController(OAuthService oauthService,
                                    UserService userService,
                                    JwtProvider jwtProvider,
                                    RoleRepository roleRepository) {
        this.oauthService = oauthService;
        this.userService = userService;
        this.jwtProvider = jwtProvider;
        this.roleRepository = roleRepository;
    }

    /**
     * POST /api/v2/auth/oauth/facebook
     * Validates a Facebook access token and returns a JWT.
     *
     * Request body: { credential: "<Facebook access token>", userId: "<Facebook user ID>" }
     * Response: AuthResponse with JWT and user data
     */
    @PostMapping("/facebook")
    public Mono<ResponseEntity<AuthResponse>> facebookLogin(@RequestBody OAuthLoginRequest request) {
        log.info("🔐 [FACEBOOK-OAUTH] Received Facebook OAuth login request");

        if (request.getCredential() == null || request.getCredential().isEmpty()) {
            log.warn("⚠️ [FACEBOOK-OAUTH] Missing credential (access token) in request");
            return Mono.just(ResponseEntity.badRequest().body(
                    AuthResponse.builder()
                            .status(false)
                            .message("Facebook access token is required")
                            .build()
            ));
        }

        if (request.getUserId() == null || request.getUserId().isEmpty()) {
            log.warn("⚠️ [FACEBOOK-OAUTH] Missing userId in request");
            return Mono.just(ResponseEntity.badRequest().body(
                    AuthResponse.builder()
                            .status(false)
                            .message("Facebook userId is required")
                            .build()
            ));
        }

        return oauthService.validateFacebookToken(request.getCredential(), request.getUserId())
                .flatMap(oauthInfo -> {
                    log.info("✅ [FACEBOOK-OAUTH] Token valid for email: {}", oauthInfo.getEmail());
                    return oauthService.findOrCreateOAuthUser(oauthInfo);
                })
                .flatMap(user -> {
                    log.info("✅ [FACEBOOK-OAUTH] User found/created: {}", user.getUsername());
                    return roleRepository.findRolesByUserId(user.getId())
                            .map(role -> "ROLE_" + role.getName())
                            .collectList()
                            .flatMap(roles -> userService.convertToDto(user)
                                    .map(userDto -> {
                                        String authorities = String.join(",", roles);
                                        String token = jwtProvider.createToken(
                                                user.getUsername(),
                                                authorities,
                                                userDto.getCustomerId(),
                                                userDto.getActiveCompanyId()
                                        );

                                        return ResponseEntity.ok(AuthResponse.builder()
                                                .username(user.getUsername())
                                                .message("Facebook login exitoso")
                                                .jwt(token)
                                                .status(true)
                                                .user(userDto)
                                                .build());
                                    }));
                })
                .onErrorResume(e -> {
                    log.error("❌ [FACEBOOK-OAUTH] Login failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                            AuthResponse.builder()
                                    .status(false)
                                    .message("Facebook authentication failed: " + e.getMessage())
                                    .build()
                    ));
                });
    }

    /**
     * GET /api/v2/auth/oauth/facebook/config
     * Returns the Facebook App ID for frontend initialization.
     */
    @GetMapping("/facebook/config")
    public Mono<ResponseEntity<Map<String, String>>> getFacebookConfig() {
        return Mono.just(ResponseEntity.ok(Map.of(
                "appId", facebookLoginAppId != null ? facebookLoginAppId : ""
        )));
    }
}
