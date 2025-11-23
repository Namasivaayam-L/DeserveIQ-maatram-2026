package com.maatram.deserveiq.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StudentDto {

    // Basic Info
    public String name;
    public String district;

    // Academic info
    public Integer passed_out_10;
    public Integer passed_out_11;
    public Integer passed_out_12;

    public Integer marks_10;
    public Integer marks_11;
    public Integer marks_12;

    // NEW PRIORITY COLUMNS
    public Integer cutoff;
    public String preferred_location;
    public String preferred_course;
    public String family_income_tier;

    // Family
    public Integer family_income;
    public Integer family_members;

    // Behavioral (NEW — numeric)
    public Double motivational_score;
    public Double attendance_rate;
    public Double communication_freq;
    public Double interest_lvl;
    public Double family_support;

    // Old academic score (still exists)
    public Integer academic_score;

    // Protective Flags
    public String orphan;
    public String single_parent;
    public String first_graduate;
    public String girlchild;        // unified name for ML + DB
    public String attitude;

    // Optional / Legacy fields
    public String communication_frequency;
    public String school_type_10;
    public String school_type_11;
    public String school_type_12;
    public String willing_hostel;
    public String any_scholarship;
    public String parents_occupation;
    public String private_or_govt_school;
    public String scholarship_eligibility;
    public String extra_curricular;
    public String school_fee_6_to_12;

    // Additional optional fields
    public String siblings;
    public String siblings_details;
    public String siblings_work_or_college;
    public String rent_or_own;
    public String property_owned;
}
