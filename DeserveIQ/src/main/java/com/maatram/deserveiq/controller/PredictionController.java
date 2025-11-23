package com.maatram.deserveiq.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.maatram.deserveiq.dto.PredictionResponse;
import com.maatram.deserveiq.entity.Student;
import com.maatram.deserveiq.repository.StudentRepository;
import com.maatram.deserveiq.service.MlService;
import com.maatram.deserveiq.util.CsvUtil;

import java.io.*;
import java.util.*;

@RestController
@RequestMapping("/api/predict")
public class PredictionController {

    private final MlService ml;
    private final StudentRepository repo;

    public PredictionController(MlService ml, StudentRepository repo) {
        this.ml = ml;
        this.repo = repo;
    }

    /** SINGLE PREDICTION **/
    @PostMapping("/single")
    public ResponseEntity<PredictionResponse> predictSingle(@RequestBody Map<String, Object> payload) {
        try {
            PredictionResponse resp = ml.predictSingle(payload);
            return ResponseEntity.ok(resp);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage(), ex);
        }
    }

    /** BATCH CSV PREDICTION + SAVE TO DB **/
    @PostMapping("/batch")
    public ResponseEntity<byte[]> predictBatch(@RequestParam("file") MultipartFile file) {
        try {

            List<Map<String, String>> rows = CsvUtil.readCsvAsMaps(file.getInputStream());
            List<Map<String, Object>> outputRows = new ArrayList<>();

            for (Map<String, String> r : rows) {

                Map<String, Object> payload = new LinkedHashMap<>();
                r.forEach((k, v) -> payload.put(k, tryParse(v)));

                PredictionResponse pr = ml.predictSingle(payload);

                Student s = Student.builder()
                        .name(getStr(payload, "name"))
                        .district(getStr(payload, "district"))

                        .passedOut10(getInt(payload, "passed_out_10"))
                        .passedOut11(getInt(payload, "passed_out_11"))
                        .passedOut12(getInt(payload, "passed_out_12"))

                        .marks10(getInt(payload, "marks_10"))
                        .marks11(getInt(payload, "marks_11"))
                        .marks12(getInt(payload, "marks_12"))

                        // NEW FIELDS
                        .cutoff(getInt(payload, "cutoff"))
                        .preferredLocation(getStr(payload, "preferred_location"))
                        .preferredCourse(getStr(payload, "preferred_course"))
                        .familyIncomeTier(getStr(payload, "family_income_tier"))

                        .familyIncome(getInt(payload, "family_income"))
                        .familyMembers(getInt(payload, "family_members"))

                        .motivationalScore(getDouble(payload, "motivational_score"))
                        .attendanceRate(getDouble(payload, "attendance_rate"))
                        .communicationFreq(getDouble(payload, "communication_freq"))
                        .interestLvl(getDouble(payload, "interest_lvl"))
                        .familySupport(getDouble(payload, "family_support"))

                        .academicScore(getInt(payload, "academic_score"))

                        .orphan(getStr(payload, "orphan"))
                        .singleParent(getStr(payload, "single_parent"))
                        .firstGraduate(getStr(payload, "first_graduate"))
                        .girlchild(getStr(payload, "girlchild") == null 
                                   ? getStr(payload, "girl_child") 
                                   : getStr(payload, "girlchild"))

                        .attitude(getStr(payload, "attitude"))

                        // Legacy (optional)
                        .communicationFrequency(getStr(payload, "communication_frequency"))
                        .schoolType10(getStr(payload, "school_type_10"))
                        .schoolType11(getStr(payload, "school_type_11"))
                        .schoolType12(getStr(payload, "school_type_12"))
                        .willingHostel(getStr(payload, "willing_hostel"))
                        .anyScholarship(getStr(payload, "any_scholarship"))
                        .parentsOccupation(getStr(payload, "parents_occupation"))
                        .privateOrGovtSchool(getStr(payload, "private_or_govt_school"))
                        .scholarshipEligibility(getStr(payload, "scholarship_eligibility"))
                        .extraCurricular(getStr(payload, "extra_curricular"))
                        .schoolFee6to12(getStr(payload, "school_fee_6_to_12"))

                        .build();

                repo.save(s);

                Map<String, Object> out = new LinkedHashMap<>(payload);
                out.put("dropout_probability", pr.getDropout_probability());
                out.put("deservingness_score", pr.getDeservingness_score());
                out.put("risk_tier", pr.getRisk_tier());
                out.put("explanation", pr.getExplanation() == null ? "" : pr.getExplanation());

                outputRows.add(out);
            }

            ByteArrayOutputStream bout = new ByteArrayOutputStream();
            CsvUtil.writeMapsToCsv(outputRows, bout);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("predictions.csv").build());

            return new ResponseEntity<>(bout.toByteArray(), headers, HttpStatus.OK);

        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV ERROR → " + e.getMessage(), e);
        }
    }

    /** HELPERS **/
    private Object tryParse(String v) {
        if (v == null || v.isBlank()) return "";
        if (v.matches("^-?\\d+$")) return Integer.valueOf(v);
        if (v.matches("^-?\\d+\\.\\d+$")) return Double.valueOf(v);
        return v;
    }

    private String getStr(Map<String, Object> m, String k) {
        return m.getOrDefault(k, "").toString();
    }

    private Integer getInt(Map<String, Object> m, String k) {
        try { return Integer.valueOf(m.getOrDefault(k, "0").toString()); }
        catch (Exception ex) { return 0; }
    }

    private Double getDouble(Map<String, Object> m, String k) {
        try { return Double.valueOf(m.getOrDefault(k, "0").toString()); }
        catch (Exception ex) { return 0.0; }
    }
}
