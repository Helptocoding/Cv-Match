import { z } from "zod";

export const ProcessingMetadataSchema = z.object({
  strategy: z.string(),
  provider: z.string(),
  model: z.string(),
  warnings: z.array(z.string()),
});

export const StructuredCVSchema = z.object({
  basics: z.object({
    full_name: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string(),
    website: z.string(),
  }),
  summary: z.string(),
  skills: z.array(
    z.object({ name: z.string(), category: z.string(), proficiency: z.string() }),
  ),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      duration_months: z.number(),
      bullets: z.array(z.string()),
      achievements: z.array(z.string()),
      technologies: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field_of_study: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      details: z.array(z.string()),
    }),
  ),
  certifications: z.array(
    z.object({ name: z.string(), issuer: z.string(), date: z.string() }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
      url: z.string(),
    }),
  ),
  keywords: z.array(z.string()),
  raw_text: z.string(),
  meta: ProcessingMetadataSchema,
});
