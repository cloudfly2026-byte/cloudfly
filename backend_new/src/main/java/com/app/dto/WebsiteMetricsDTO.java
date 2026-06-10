package com.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteMetricsDTO {

    private List<VisitData> yearlyVisits;
    private List<OriginData> origins;
    private List<PageData> topPages;
    private Double bounceRate;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisitData {
        private String month;
        private Integer visits;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OriginData {
        private String source;
        private Double percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageData {
        private String path;
        private Integer views;
    }
}