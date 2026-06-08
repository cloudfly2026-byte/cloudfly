package com.app.services;

import com.app.persistence.entity.Media;
import com.app.persistence.repository.MediaRepository;
import com.app.services.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class MediaService {

    private final MediaRepository mediaRepository;
    private final StorageService storageService;

    public Flux<Media> getAllMedia(Long tenantId) {
        return mediaRepository.findAllByTenantId(tenantId);
    }

    public Flux<Media> searchMedia(Long tenantId, String query) {
        return mediaRepository.findAllByTenantIdAndFilenameContainingIgnoreCase(tenantId, query);
    }

    public Mono<Media> uploadMedia(FilePart file, Long tenantId, Long companyId) {
        String originalFilename = file.filename();
        String contentType = file.headers().getContentType() != null ? 
                file.headers().getContentType().toString() : "application/octet-stream";
        long size = file.headers().getContentLength() > 0 ? file.headers().getContentLength() : 0;

        // Default companyId to 1 if not provided (backward compatibility)
        Long effectiveCompanyId = (companyId != null && companyId > 0) ? companyId : 1L;

        return storageService.store(file, tenantId, effectiveCompanyId)
                .flatMap(filename -> {
                    // URL structure: /media/{tenantId}/{companyId}/{filename}
                    String url = "/media/" + tenantId + "/" + effectiveCompanyId + "/" + filename;
                    
                    Media media = Media.builder()
                            .tenantId(tenantId)
                            .companyId(effectiveCompanyId)
                            .filename(filename)
                            .originalName(originalFilename)
                            .contentType(contentType)
                            .size(size)
                            .url(url)
                            .createdAt(LocalDateTime.now())
                            .build();
                    
                    return mediaRepository.save(media);
                });
    }

    public Mono<Void> deleteMedia(Long id, Long tenantId) {
        return mediaRepository.findById(id)
                .filter(media -> media.getTenantId().equals(tenantId))
                .flatMap(media -> storageService.delete(media.getFilename(), tenantId, media.getCompanyId())
                        .then(mediaRepository.delete(media)));
    }
}
