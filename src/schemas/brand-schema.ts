import { z } from "zod";

// Logo variant schema
const logoVariantSchema = z.object({
  label: z.string().min(1, "Label is required"),
  src: z.string().min(1, "Source path is required"),
});

// Logo schema
const logoSchema = z.object({
  name: z.string().min(1, "Logo name is required"),
  description: z.string().min(1, "Description is required"),
  variants: z.array(logoVariantSchema).min(1, "At least one variant is required"),
});

// Color values schema
const colorValuesSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g., #035259)"),
  rgb: z.string().regex(/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/, "Must be in format: R, G, B (e.g., 3, 82, 89)"),
  cmyk: z.string().regex(/^\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}$/, "Must be in format: C, M, Y, K (e.g., 34, 3, 0, 65)"),
});

// Color schema
const colorSchema = z.object({
  name: z.string().min(1, "Color name is required"),
  role: z.array(z.enum(["Primary", "Secondary", "Data"])).min(1, "At least one role is required"),
  values: colorValuesSchema,
});

// Font source schema
const fontSourceSchema = z.object({
  type: z.enum(["google", "local", "url"]),
  family: z.string().min(1, "Font family is required"),
  weights: z.array(z.number()).min(1, "At least one font weight is required"),
});

// Font schema
const fontSchema = z.object({
  name: z.string().min(1, "Font name is required"),
  source: fontSourceSchema,
});

// Typography example schema
const typographyExampleSchema = z.object({
  label: z.string().min(1, "Label is required"),
  font: z.string().min(1, "Font is required"),
  sizePx: z.number().min(1, "Size must be at least 1px"),
  weight: z.number().min(100).max(900),
  text: z.string().min(1, "Example text is required"),
  lineHeight: z.number().optional(),
  letterSpacing: z.string().optional(),
});

// Typography schema
const typographySchema = z.object({
  fonts: z.array(fontSchema).min(1, "At least one font is required"),
  examples: z.array(typographyExampleSchema).min(1, "At least one example is required"),
});

// Gallery item schema
const galleryItemSchema = z.object({
  caption: z.string().optional(),
  src: z.string().min(1, "Source path is required"),
});

// Brand info schema
const brandInfoSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  description: z.string().min(1, "Description is required"),
  website: z.string().url("Must be a valid URL"),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in format: YYYY-MM-DD"),
});

// Main brand data schema
export const brandDataSchema = z.object({
  brand: brandInfoSchema,
  logos: z.array(logoSchema).min(1, "At least one logo is required"),
  colors: z.array(colorSchema).min(1, "At least one color is required"),
  typography: typographySchema,
  gallery: z.array(galleryItemSchema).default([]),
});

export type BrandData = z.infer<typeof brandDataSchema>;
export type BrandInfo = z.infer<typeof brandInfoSchema>;
export type Logo = z.infer<typeof logoSchema>;
export type LogoVariant = z.infer<typeof logoVariantSchema>;
export type Color = z.infer<typeof colorSchema>;
export type ColorValues = z.infer<typeof colorValuesSchema>;
export type Font = z.infer<typeof fontSchema>;
export type TypographyExample = z.infer<typeof typographyExampleSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
