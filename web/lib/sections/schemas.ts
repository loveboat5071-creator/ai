import { z } from 'zod';

// Shared Helpers
const urlSchema = z.string().url().optional().or(z.literal(''));

// Common Style Fields - can be added to any section
const sizeEnum = z.enum(['sm', 'md', 'lg', 'xl']).optional();
const colorEnum = z.enum(['white', 'slate', 'blue', 'green', 'purple', 'orange', 'red']).optional();

const ctaSchema = z.object({
    label: z.string().min(1),
    actionType: z.enum(['link', 'scroll', 'openEstimator']).default('link'),
    target: z.string().optional(),
    payload: z.any().optional(),
    variant: z.enum(['primary', 'secondary', 'outline']).default('primary').optional()
}).passthrough();

// 1. Hero Template
export const heroSchema = z.object({
    eyebrow: z.string().optional(),
    eyebrowBg: z.enum(['blue', 'green', 'purple', 'orange', 'red', 'slate', 'none']).optional(),
    eyebrowSize: sizeEnum, // Added size option
    title: z.string().min(1, "Title is required"),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    subtitleSize: sizeEnum,
    subtitleColor: colorEnum,
    ctas: z.array(ctaSchema).optional(),
    stats: z.any().optional(),
    kpis: z.any().optional(),
    backgroundImage: urlSchema
}).passthrough();

// 2. Value Props
export const valuePropsSchema = z.object({
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    description: z.string().optional(),
    cards: z.array(z.object({
        icon: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional()
    }).passthrough()).optional()
}).passthrough();

// 3. Concept
export const conceptSchema = z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    description: z.string().optional(),
    image: urlSchema, // Main section image (left or bg)
    features: z.array(z.string()).optional(),
    bullets: z.array(z.string()).optional(),
    card: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        image: urlSchema,
        stats: z.array(z.object({ label: z.string(), value: z.string() }).passthrough()).optional(),
        cta: ctaSchema.optional()
    }).passthrough().optional()
}).passthrough();

// 4. Comparison
export const comparisonSchema = z.object({
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    left: z.object({
        title: z.string().optional(),
        label: z.string().optional(),
        headline: z.string().optional(),
        description: z.string().optional(),
        image: urlSchema,
        items: z.array(z.string()).optional(),
        points: z.array(z.string()).optional()
    }).passthrough(),
    right: z.object({
        title: z.string().optional(),
        label: z.string().optional(),
        headline: z.string().optional(),
        description: z.string().optional(),
        image: urlSchema,
        items: z.array(z.string()).optional(),
        points: z.array(z.string()).optional(),
        highlight: z.boolean().optional()
    }).passthrough()
}).passthrough();

// 5. How It Works
export const howItWorksSchema = z.object({
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    steps: z.array(z.object({
        step: z.number().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        image: urlSchema
    }).passthrough()).optional()
}).passthrough();

// 6. Use Cases
export const useCasesSchema = z.object({
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    description: z.string().optional(),
    layout: z.enum(['grid', 'split']).default('grid').optional(),
    imagePosition: z.enum(['left', 'right']).default('right').optional(),
    image: urlSchema, // Main image for split layout
    cases: z.array(z.object({
        tag: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        metrics: z.array(z.string()).optional(),
        image: urlSchema
    }).passthrough()).optional()
}).passthrough();

// 7. Why
export const whySchema = z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    description: z.string().optional(),
    cards: z.array(z.object({
        title: z.string().optional(),
        value: z.string().optional(),
        description: z.string().optional()
    }).passthrough()).optional()
}).passthrough();

// 8. Estimate Guide
export const estimateGuideSchema = z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(), // Keeping for backward compatibility
    description: z.string().optional(),
    subtitleSize: sizeEnum,
    subtitleColor: colorEnum,
    steps: z.array(
        z.union([
            z.string(),
            z.object({
                title: z.string(),
                description: z.string().optional()
            }).passthrough()
        ])
    ).optional()
}).passthrough();

// 9. CTA (Global Bottom CTA)
export const globalCtaSchema = z.object({
    title: z.string().optional(),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    description: z.string().optional(),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional()
}).passthrough();

// 10. FAQ
const faqItemSchema = z.object({
    question: z.string().optional(),
    answer: z.string().optional()
}).passthrough();

export const faqSchema = z.object({
    title: z.string().optional(),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    questions: z.array(faqItemSchema).optional()
}).passthrough();

// 11. Reporting
export const reportingSchema = z.object({
    title: z.string().optional(),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    description: z.string().optional(),
    image: urlSchema,
    features: z.array(z.string()).optional()
}).passthrough();

// 13. Consultation Request
export const consultationSchema = z.object({
    title: z.string().min(1),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    description: z.string().optional(),
    webhookUrl: z.string().url().optional().or(z.literal('')), // Optional override, usually env
    successMessage: z.string().default("상담 요청이 접수되었습니다. 담당자가 곧 연락드리겠습니다.").optional(),
    contactPhone: z.string().default("02-731-XXXX").optional(),
    contactEmail: z.string().default("help@kobaco.co.kr").optional(),
    contactLabel: z.string().default("연락처").optional(),
    showContactPhone: z.boolean().default(true).optional(),
    showContactEmail: z.boolean().default(true).optional(),
    fields: z.object({
        name: z.boolean().default(true).optional(),
        email: z.boolean().default(true).optional(),
        company: z.boolean().default(true).optional(),
        position: z.boolean().default(true).optional(),
        message: z.boolean().default(true).optional(),
    }).optional()
}).passthrough();

// 12. Image Cards (New)
export const imageCardsSchema = z.object({
    title: z.string().optional(),
    titleSize: sizeEnum,
    titleColor: colorEnum,
    subtitle: z.string().optional(),
    cards: z.array(z.object({
        image: urlSchema,
        title: z.string().optional(),
        description: z.string().optional()
    }).passthrough()).optional()
}).passthrough();


// Type Registry for Validation
export const SECTION_SCHEMAS: Record<string, z.ZodObject<any>> = {
    hero: heroSchema,
    valueProps: valuePropsSchema,
    concept: conceptSchema,
    comparison: comparisonSchema,
    howItWorks: howItWorksSchema,
    useCases: useCasesSchema,
    why: whySchema,
    estimateGuide: estimateGuideSchema,
    cta: globalCtaSchema,
    faq: faqSchema,
    reporting: reportingSchema,
    imageCards: imageCardsSchema,
    consultation: consultationSchema
};

export type SectionType = keyof typeof SECTION_SCHEMAS;
