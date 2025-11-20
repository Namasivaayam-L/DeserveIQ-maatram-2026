package com.maatram.deserveiq.dto;


import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StudentDto {
    public String name;
    public String district;
    public Integer passed_out_10;
    public Integer passed_out_11;
    public Integer passed_out_12;
    public Integer marks_10;
    public Integer marks_11;
    public Integer marks_12;
    public Integer family_income;
    public Integer family_members;
    public Integer academic_score;
    public Integer motivation_level;
    public Integer attendance_rate;
    public String communication_frequency;
    public String family_support;
    public String school_type_10;
    public String school_type_11;
    public String school_type_12;
    public String orphan;
    public String single_parent;
    public String girl_child;
    public String siblings;
    public String siblings_details;
    public String siblings_work_or_college;
    public String rent_or_own;
    public String property_owned;
    public String willing_hostel;
    public String any_scholarship;
    public String parents_occupation;
    public String private_or_govt_school;
    public String first_graduate;
    public String scholarship_eligibility;
    public String extra_curricular;
    public String interest_level;
    public String attitude;
    public String school_fee_6_to_12;
}
