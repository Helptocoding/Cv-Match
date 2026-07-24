export type ProcessingMetadata = {
  strategy: string;
  provider: string;
  model: string;
  warnings: string[];
};

export type StructuredCV = {
  basics: {
    full_name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    website: string;
  };
  summary: string;
  skills: Array<{ name: string; category: string; proficiency: string }>;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    start_date: string;
    end_date: string;
    duration_months: number;
    bullets: string[];
    achievements: string[];
    technologies: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date: string;
    details: string[];
  }>;
  certifications: Array<{ name: string; issuer: string; date: string }>;
  languages: Array<{ name: string; level: string }>;
  projects: Array<{ name: string; description: string; technologies: string[]; url: string }>;
  keywords: string[];
  raw_text: string;
  meta: ProcessingMetadata;
};
