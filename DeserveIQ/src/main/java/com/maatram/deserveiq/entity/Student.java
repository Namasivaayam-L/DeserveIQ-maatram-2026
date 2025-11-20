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

    @JsonProperty("family_income")
    private Integer familyIncome;

    @JsonProperty("family_members")
    private Integer familyMembers;

    @JsonProperty("academic_score")
    private Integer academicScore;

    @JsonProperty("motivation_level")
    private Integer motivationLevel;

    @JsonProperty("attendance_rate")
    private Integer attendanceRate;

    @JsonProperty("communication_frequency")
    private String communicationFrequency;

    @JsonProperty("family_support")
    private String familySupport;

    @JsonProperty("school_type_10")
    private String schoolType10;

    @JsonProperty("school_type_11")
    private String schoolType11;

    @JsonProperty("school_type_12")
    private String schoolType12;

    @JsonProperty("orphan")
    private String orphan;

    @JsonProperty("single_parent")
    private String singleParent;

    @JsonProperty("girl_child")
    private String girlChild;

    @JsonProperty("siblings")
    private String siblings;

    @JsonProperty("siblings_details")
    private String siblingsDetails;

    @JsonProperty("siblings_work_or_college")
    private String siblingsWorkOrCollege;

    @JsonProperty("rent_or_own")
    private String rentOrOwn;

    @JsonProperty("property_owned")
    private String propertyOwned;

    @JsonProperty("willing_hostel")
    private String willingHostel;

    @JsonProperty("any_scholarship")
    private String anyScholarship;

    @JsonProperty("parents_occupation")
    private String parentsOccupation;

    @JsonProperty("private_or_govt_school")
    private String privateOrGovtSchool;

    @JsonProperty("first_graduate")
    private String firstGraduate;

    @JsonProperty("scholarship_eligibility")
    private String scholarshipEligibility;

    @JsonProperty("extra_curricular")
    private String extraCurricular;

    @JsonProperty("interest_level")
    private String interestLevel;

    @JsonProperty("attitude")
    private String attitude;

    @JsonProperty("school_fee_6_to_12")
    private String schoolFee6to12;
}
