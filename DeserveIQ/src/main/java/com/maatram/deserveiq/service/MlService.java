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

        if (baseUrl.endsWith("/"))
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);

        if (!endpoint.startsWith("/"))
            endpoint = "/" + endpoint;

        this.mlPredictUrl = baseUrl + endpoint;
    }

    @SuppressWarnings("unchecked")
    public PredictionResponse predictSingle(Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> req =
                    new HttpEntity<>(payload, headers);

            ResponseEntity<Map> resp =
                    rest.postForEntity(mlPredictUrl, req, Map.class);

            if (resp.getStatusCode() != HttpStatus.OK || resp.getBody() == null) {
                throw new RuntimeException("ML API returned non-OK: " + resp.getStatusCode());
            }

            Map<String, Object> body = resp.getBody();

            Number pN = (Number) body.getOrDefault("dropout_probability", 0.0);
            Number sN = (Number) body.getOrDefault("deservingness_score", 0.0);
            String tier = String.valueOf(body.getOrDefault("risk_tier", "UNKNOWN"));

            // -------------------------
            // NORMALISE EXPLANATION
            // -------------------------
            Object expl = body.get("explanation");
            String explanationJson;

            if (expl == null) {
                explanationJson = "{}";
            }
            else if (expl instanceof Map<?, ?> map) {
                explanationJson = mapToJson(map);
            }
            else if (expl instanceof String s) {
                explanationJson = fixStringMapToJson(s);
            }
            else {
                explanationJson = "{}";
            }

            return PredictionResponse.builder()
                    .dropout_probability(pN == null ? 0.0 : pN.doubleValue())
                    .deservingness_score(sN == null ? 0.0 : sN.doubleValue())
                    .risk_tier(tier)
                    .explanation(explanationJson)
                    .build();

        } catch (RestClientException ex) {
            throw new RuntimeException("Failed to call ML service: " + ex.getMessage(), ex);
        }
    }

    // ---------------------------
    // Convert Map → JSON manually
    // ---------------------------
    private String mapToJson(Map<?, ?> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<?, ?> e : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;

            sb.append("\"").append(e.getKey()).append("\":");
            Object val = e.getValue();

            if (val instanceof Number || val instanceof Boolean) {
                sb.append(val.toString());
            } else {
                sb.append("\"").append(val.toString()).append("\"");
            }
        }
        sb.append("}");
        return sb.toString();
    }

    // ----------------------------------
    // Fix "{a=1, b=2}" → {"a":1,"b":2}
    // ----------------------------------
    private String fixStringMapToJson(String s) {
        try {
            s = s.replace("{", "")
                 .replace("}", "");

            String[] parts = s.split(",");
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;

            for (String p : parts) {
                if (!p.contains("=")) continue;

                String[] kv = p.split("=");
                if (kv.length != 2) continue;

                String key = kv[0].trim();
                String value = kv[1].trim();

                if (!first) sb.append(",");
                first = false;

                sb.append("\"").append(key).append("\":");

                if (value.matches("^-?\\d+(\\.\\d+)?$")) {
                    sb.append(value);
                } else {
                    sb.append("\"").append(value).append("\"");
                }
            }

            sb.append("}");
            return sb.toString();

        } catch (Exception ex) {
            return "{}";
        }
    }
}
