package com.app.controllers;

import com.app.persistence.entity.Media;
import com.app.services.MediaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @GetMapping
    public Flux<Media> getAll(@RequestParam Long tenantId) {
        return mediaService.getAllMedia(tenantId);
    }

    @GetMapping("/search")
    public Flux<Media> search(@RequestParam Long tenantId, @RequestParam String query) {
        return mediaService.searchMedia(tenantId, query);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Media> upload(
            @RequestPart("file") Mono<FilePart> filePartMono,
            @RequestParam("tenantId") Long tenantId,
            @RequestParam(value = "companyId", required = false) Long companyId) {
        log.info("📤 [MEDIA-UPLOAD] tenantId={}, companyId={}", tenantId, companyId);
        return filePartMono.flatMap(filePart -> mediaService.uploadMedia(filePart, tenantId, companyId));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id, @RequestParam Long tenantId) {
        return mediaService.deleteMedia(id, tenantId);
    }
}
