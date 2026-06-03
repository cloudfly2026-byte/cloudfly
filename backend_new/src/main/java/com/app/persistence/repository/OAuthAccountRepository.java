package com.app.persistence.repository;

import com.app.persistence.entity.OAuthAccountEntity;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * CLOUD-278: Repository for OAuth account operations.
 */
public interface OAuthAccountRepository extends ReactiveCrudRepository<OAuthAccountEntity, Long> {

    /**
     * Find an OAuth account by provider and provider-specific user ID.
     * Used during OAuth login to check if user already exists.
     */
    @Query("SELECT * FROM user_oauth_accounts WHERE provider = :provider AND provider_user_id = :providerUserId")
    Mono<OAuthAccountEntity> findByProviderAndProviderUserId(String provider, String providerUserId);

    /**
     * Find all OAuth accounts linked to a specific user.
     */
    @Query("SELECT * FROM user_oauth_accounts WHERE user_id = :userId")
    Flux<OAuthAccountEntity> findByUserId(Long userId);

    /**
     * Check if an OAuth account already exists for a given provider + providerUserId.
     */
    @Query("SELECT COUNT(*) FROM user_oauth_accounts WHERE provider = :provider AND provider_user_id = :providerUserId")
    Mono<Integer> existsByProviderAndProviderUserId(String provider, String providerUserId);

    /**
     * Delete an OAuth account link.
     */
    @Query("DELETE FROM user_oauth_accounts WHERE user_id = :userId AND provider = :provider")
    Mono<Void> deleteByUserIdAndProvider(Long userId, String provider);
}
