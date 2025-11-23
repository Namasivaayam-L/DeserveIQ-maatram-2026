package com.maatram.deserveiq.entity;

import jakarta.persistence.*;
import lombok.*;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Entity
@Table(name = "students")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Student {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String district;

    // Old academic columns (keep as before)
    @JsonProperty("passed_out_10")
    private Integer passedOut10;

    @JsonProperty("passed_out_11")
    private Integer passedOut11;

    @JsonProperty("passed_out_12")
    private Integer passedOut12;

    @JsonProperty("marks_10")
    private Integer marks10;

    @JsonProperty("marks_11")
    private Integer marks11;

    @JsonProperty("marks_12")
    private Integer marks12;

    // New priority columns
    @JsonProperty("cutoff")
    private Integer cutoff;

    @JsonProperty("preferred_location")
    private String preferredLocation;

    @JsonProperty("preferred_course")
    private String preferredCourse;

    @JsonProperty("family_income_tier")
    private String familyIncomeTier;

    // Family fields (keep numeric family_income if you used earlier)
    @JsonProperty("family_income")
    private Integer familyIncome;

    @JsonProperty("family_members")
    private Integer familyMembers;

    // Behavioral columns (use numeric where appropriate)
    @JsonProperty("motivational_score")
    private Double motivationalScore;     // new numeric

    @JsonProperty("attendance_rate")
    private Double attendanceRate;

    @JsonProperty("communication_freq")
    private Double communicationFreq;

    @JsonProperty("interest_lvl")
    private Double interestLvl;

    @JsonProperty("family_support")
    private Double familySupport;         // keep numeric for analytics

    @JsonProperty("academic_score")
    private Integer academicScore;

    // Flags (protective)
    @JsonProperty("orphan")
    private String orphan;

    @JsonProperty("single_parent")
    private String singleParent;

    @JsonProperty("first_graduate")
    private String firstGraduate;

    @JsonProperty("girlchild")
    private String girlchild;

    @JsonProperty("attitude")
    private String attitude;

    // Misc (legacy)
    @JsonProperty("communication_frequency")
    private String communicationFrequency;

    @JsonProperty("school_type_10")
    private String schoolType10;

    @JsonProperty("school_type_11")
    private String schoolType11;

    @JsonProperty("school_type_12")
    private String schoolType12;

    @JsonProperty("willing_hostel")
    private String willingHostel;

    @JsonProperty("any_scholarship")
    private String anyScholarship;

    @JsonProperty("parents_occupation")
    private String parentsOccupation;

    @JsonProperty("private_or_govt_school")
    private String privateOrGovtSchool;

    @JsonProperty("scholarship_eligibility")
    private String scholarshipEligibility;

    @JsonProperty("extra_curricular")
    private String extraCurricular;

    @JsonProperty("school_fee_6_to_12")
    private String schoolFee6to12;

    // add other fields here if required
}
