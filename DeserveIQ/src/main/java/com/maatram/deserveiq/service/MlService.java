package com.maatram.deserveiq.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import com.maatram.deserveiq.dto.PredictionResponse;

import java.util.Map;

@Service
public class MlService {

    private final RestTemplate rest;
    private final String mlPredictUrl;

    public MlService(RestTemplate rest,
                     @Value("${ml.api.url}") String baseUrl,
                     @Value("${ml.api.predict-endpoint}") String endpoint) {
        this.rest = rest;
        if (baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length()-1);
        if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
        this.mlPredictUrl = baseUrl + endpoint;
    }

    @SuppressWarnings("unchecked")
    public PredictionResponse predictSingle(Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String,Object>> req = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> resp = rest.postForEntity(mlPredictUrl, req, Map.class);

            if (resp.getStatusCode() != HttpStatus.OK || resp.getBody() == null) {
                throw new RuntimeException("ML API returned non-OK: " + resp.getStatusCode());
            }

            Map<String, Object> body = resp.getBody();
            Number pN = (Number) body.getOrDefault("dropout_probability", 0.0);
            Number sN = (Number) body.getOrDefault("deservingness_score", 0.0);
            String tier = (String) body.getOrDefault("risk_tier", "UNKNOWN");

            return PredictionResponse.builder()
                    .dropout_probability(pN.doubleValue())
                    .deservingness_score(sN.doubleValue())
                    .risk_tier(tier)
                    .build();

        } catch (RestClientException ex) {
            throw new RuntimeException("Failed to call ML service: " + ex.getMessage(), ex);
        } catch (ClassCastException ex) {
            throw new RuntimeException("Invalid response from ML service", ex);
        }
    }
}
