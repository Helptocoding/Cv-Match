import type { ProcessingMetadata } from "@/types/cv";

export type StructuredJob = {
  job_title: string;
  company_name: string;
  location: string;
  employment_type: string;
  seniority: string;
  summary: string;
  required_skills: Array<{ name: string; priority: string; years_required: number }>;
  preferred_skills: Array<{ name: string; priority: string; years_required: number }>;
  required_experience: { min_years: number; domains: string[]; roles: string[] };
  education_requirements: Array<{ degree_level: string; field: string; required: boolean }>;
  responsibilities: string[];
  keywords_ats: string[];
  tools_and_technologies: string[];
  raw_text: string;
  meta: ProcessingMetadata;
};
