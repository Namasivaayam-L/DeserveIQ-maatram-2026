package com.maatram.deserveiq.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PredictionResponse {
    private double dropout_probability;
    private double deservingness_score;
    private String risk_tier;

    // Explanation JSON/string returned from ML API (rule-based reasons + meta)
    private String explanation;
}
