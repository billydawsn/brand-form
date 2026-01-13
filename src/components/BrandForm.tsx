import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import JSZip from "jszip";
import { brandDataSchema, type BrandData } from "@/schemas/brand-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Download, Plus, Trash2, Upload } from "lucide-react";

// Color conversion utilities
function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return '';
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function hexToCmyk(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  const [r, g, b] = rgb.split(',').map(v => parseInt(v.trim()));
  return rgbToCmyk(`${r}, ${g}, ${b}`);
}

function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map(v => parseInt(v.trim()));
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [r, g, b] = parts;
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function rgbToCmyk(rgb: string): string {
  const parts = rgb.split(',').map(v => parseInt(v.trim()));
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [r, g, b] = parts.map(v => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return '0, 0, 0, 100';
  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);
  return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
}

function cmykToRgb(cmyk: string): string {
  const parts = cmyk.split(',').map(v => parseInt(v.trim()));
  if (parts.length !== 4 || parts.some(isNaN)) return '';
  const [c, m, y, k] = parts.map(v => v / 100);
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  return `${r}, ${g}, ${b}`;
}

function cmykToHex(cmyk: string): string {
  const rgb = cmykToRgb(cmyk);
  if (!rgb) return '';
  return rgbToHex(rgb);
}

// Load example data as default values
const defaultValues: BrandData = {
  brand: {
    name: "",
    description: "",
    website: "",
    updatedAt: new Date().toISOString().split("T")[0],
  },
  logos: [
    {
      name: "",
      description: "",
      variants: [{ label: "", src: "" }],
    },
  ],
  colors: [
    {
      name: "",
      role: ["Primary"],
      values: {
        hex: "",
        rgb: "",
        cmyk: "",
      },
    },
  ],
  typography: {
    fonts: [
      {
        name: "",
        source: {
          type: "google",
          family: "",
          weights: [400],
        },
      },
    ],
    examples: [
      {
        label: "",
        font: "",
        sizePx: 16,
        weight: 400,
        text: "",
      },
    ],
  },
  gallery: [],
};

// Track uploaded files
type UploadedFiles = {
  logos: { [key: string]: File[] }; // logoIndex -> variant files
  gallery: { [key: string]: File }; // galleryIndex -> file
  fonts: { [key: string]: File[] }; // fontIndex -> font files
};

export function BrandForm() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({
    logos: {},
    gallery: {},
    fonts: {},
  });
  
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
  const [expandedColorIndex, setExpandedColorIndex] = useState<number | null>(0);

  // TypeScript workaround: react-hook-form has module resolution issues where it sees
  // duplicate type definitions. Using type assertions to bypass this known limitation.
  // See: https://github.com/react-hook-form/react-hook-form/issues/9469
  const form = useForm<BrandData>({
    resolver: zodResolver(brandDataSchema) as any,
    defaultValues,
    mode: "onBlur",
  });

  const onSubmit = async (data: BrandData) => {
    const zip = new JSZip();

    // Add assets to ZIP
    const assetsFolder = zip.folder("assets");
    const logosFolder = assetsFolder!.folder("logos");
    const galleryFolder = assetsFolder!.folder("gallery");
    const fontsFolder = assetsFolder!.folder("fonts");

    // Process logos
    for (const [logoIndex, files] of Object.entries(uploadedFiles.logos)) {
      files.forEach((file, variantIndex) => {
        const ext = file.name.split(".").pop();
        const logoName = data.logos[parseInt(logoIndex)].name
          .toLowerCase()
          .replace(/\s+/g, "-");
        const filename = `${logoName}-${variantIndex + 1}.${ext}`;
        logosFolder!.file(filename, file);
        // Update path in data
        data.logos[parseInt(logoIndex)].variants[variantIndex].src = `/assets/logos/${filename}`;
      });
    }

    // Process gallery
    for (const [galleryIndex, file] of Object.entries(uploadedFiles.gallery)) {
      const ext = file.name.split(".").pop();
      const filename = `photo-${parseInt(galleryIndex) + 1}.${ext}`;
      galleryFolder!.file(filename, file);
      // Update path in data
      data.gallery[parseInt(galleryIndex)].src = `/assets/gallery/${filename}`;
    }

    // Process fonts
    for (const [fontIndex, files] of Object.entries(uploadedFiles.fonts)) {
      files.forEach((file) => {
        const fontName = data.typography.fonts[parseInt(fontIndex)].name
          .toLowerCase()
          .replace(/\s+/g, "-");
        const filename = `${fontName}-${file.name}`;
        fontsFolder!.file(filename, file);
      });
    }

    // Add data.json to ZIP
    zip.file("data.json", JSON.stringify(data, null, 2));

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.brand.name.toLowerCase().replace(/\s+/g, "-")}-brand-kit.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { fields: logoFields, append: appendLogo, remove: removeLogo } = useFieldArray({
    control: form.control,
    name: "logos",
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control: form.control,
    name: "colors",
  });

  const { fields: fontFields, append: appendFont, remove: removeFont } = useFieldArray({
    control: form.control,
    name: "typography.fonts",
  });

  const { fields: exampleFields, append: appendExample, remove: removeExample } = useFieldArray({
    control: form.control,
    name: "typography.examples",
  });

  const { fields: galleryFields, append: appendGallery, remove: removeGallery } = useFieldArray({
    control: form.control,
    name: "gallery",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8 max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Brand Data Form</h1>
          <Button type="submit" className="gap-2">
            <Download className="size-4" />
            Download ZIP
          </Button>
        </div>

        {/* Brand Information */}
        <section className="space-y-4 border rounded-lg p-6">
          <h2 className="text-2xl font-semibold">Brand Information</h2>
          
          <FormField
            control={form.control as any}
            name="brand.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Co" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="brand.description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Modern design system..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="brand.website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="brand.updatedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Updated</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* Logos */}
        <section className="space-y-4 border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Logos</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendLogo({
                  name: "",
                  description: "",
                  variants: [{ label: "", src: "" }],
                })
              }
            >
              <Plus className="size-4" />
              Add Logo
            </Button>
          </div>

          {logoFields.map((logo, logoIndex) => (
            <div key={logo.id} className="space-y-4 border-l-4 border-primary pl-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control as any}
                  name={`logos.${logoIndex}.name`}
                  render={({ field }) => (
                    <FormItem className="mb-0">
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Logo Name"
                          className="text-lg font-medium border-none outline-none focus:border-b-2 focus:border-gray-300 bg-transparent px-1 py-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {logoFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLogo(logoIndex)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control as any}
                name={`logos.${logoIndex}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Use on light backgrounds..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Logo Variants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variants</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const variants = form.getValues(`logos.${logoIndex}.variants`);
                      form.setValue(`logos.${logoIndex}.variants`, [
                        ...variants,
                        { label: "", src: "" },
                      ]);
                    }}
                  >
                    <Plus className="size-4" />
                    Add Variant
                  </Button>
                </div>

                {form.watch(`logos.${logoIndex}.variants`)?.map((_, variantIndex) => (
                  <div key={variantIndex} className="space-y-2 p-3 border rounded-md bg-muted/30">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Label>Upload Logo File</Label>
                        <input
                          type="file"
                          accept="image/*,.svg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Auto-detect file format
                              const ext = file.name.split('.').pop()?.toUpperCase() || '';
                              const label = ext === 'SVG' ? 'SVG' : ext || 'PNG';
                              
                              setUploadedFiles((prev) => {
                                const newLogos = { ...prev.logos };
                                if (!newLogos[logoIndex]) {
                                  newLogos[logoIndex] = [];
                                }
                                newLogos[logoIndex][variantIndex] = file;
                                return { ...prev, logos: newLogos };
                              });
                              // Auto-set format label and path
                              form.setValue(
                                `logos.${logoIndex}.variants.${variantIndex}.label`,
                                label
                              );
                              form.setValue(
                                `logos.${logoIndex}.variants.${variantIndex}.src`,
                                `assets/logos/${file.name}`
                              );
                            }
                          }}
                          id={`logo-upload-${logoIndex}-${variantIndex}`}
                          className="hidden"
                        />
                        <div 
                          onClick={() => document.getElementById(`logo-upload-${logoIndex}-${variantIndex}`)?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.add('border-gray-500', 'bg-gray-100');
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
                            
                            const file = e.dataTransfer.files[0];
                            const errorKey = `logo-${logoIndex}-${variantIndex}`;
                            
                            if (!file) return;
                            
                            if (!file.type.startsWith('image/')) {
                              setUploadErrors(prev => ({ ...prev, [errorKey]: 'Please upload an image file (SVG, PNG, JPG, or GIF)' }));
                              setTimeout(() => setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; }), 3000);
                              return;
                            }
                            
                            const ext = file.name.split('.').pop()?.toUpperCase() || '';
                            const label = ext === 'SVG' ? 'SVG' : ext || 'PNG';
                            
                            setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; });
                            setUploadedFiles((prev) => {
                              const newLogos = { ...prev.logos };
                              if (!newLogos[logoIndex]) {
                                newLogos[logoIndex] = [];
                              }
                              newLogos[logoIndex][variantIndex] = file;
                              return { ...prev, logos: newLogos };
                            });
                            form.setValue(
                              `logos.${logoIndex}.variants.${variantIndex}.label`,
                              label
                            );
                            form.setValue(
                              `logos.${logoIndex}.variants.${variantIndex}.src`,
                              `assets/logos/${file.name}`
                            );
                          }}
                          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="size-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF</p>
                        </div>
                        {uploadErrors[`logo-${logoIndex}-${variantIndex}`] && (
                          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                            {uploadErrors[`logo-${logoIndex}-${variantIndex}`]}
                          </div>
                        )}
                        {uploadedFiles.logos[logoIndex]?.[variantIndex] && (
                          <div className="space-y-2">
                            <div className="text-sm text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                              <Upload className="size-3" />
                              {uploadedFiles.logos[logoIndex][variantIndex].name}
                              <span className="text-muted-foreground ml-1">({form.watch(`logos.${logoIndex}.variants.${variantIndex}.label`)})</span>
                            </div>
                            <div className="border rounded-md p-2 bg-white">
                              <img 
                                src={URL.createObjectURL(uploadedFiles.logos[logoIndex][variantIndex])} 
                                alt="Logo preview" 
                                className="max-h-32 max-w-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {form.watch(`logos.${logoIndex}.variants`).length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const variants = form.getValues(`logos.${logoIndex}.variants`);
                            form.setValue(
                              `logos.${logoIndex}.variants`,
                              variants.filter((_, i) => i !== variantIndex)
                            );
                            // Remove uploaded file
                            setUploadedFiles((prev) => {
                              const newLogos = { ...prev.logos };
                              if (newLogos[logoIndex]) {
                                newLogos[logoIndex] = newLogos[logoIndex].filter(
                                  (_, i) => i !== variantIndex
                                );
                              }
                              return { ...prev, logos: newLogos };
                            });
                          }}
                        >
                          <Trash2 className="size-4" />
                          Remove Variant
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Colors */}
        <section className="space-y-4 border rounded-lg p-6">
          <h2 className="text-2xl font-semibold">Colors</h2>

          {colorFields.map((color, colorIndex) => {
            const isExpanded = expandedColorIndex === colorIndex;
            return (
            <div key={color.id} className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedColorIndex(isExpanded ? null : colorIndex)}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="size-6 rounded border border-gray-300 shrink-0"
                    style={{ 
                      backgroundColor: form.watch(`colors.${colorIndex}.values.hex`) || '#e5e7eb' 
                    }}
                  />
                  <FormField
                    control={form.control as any}
                    name={`colors.${colorIndex}.name`}
                    render={({ field }) => (
                      <FormItem className="mb-0">
                        <FormControl>
                          <input
                            {...field}
                            placeholder="Color Name"
                            onClick={(e) => e.stopPropagation()}
                            className="text-lg font-medium border-none outline-none focus:border-b-2 focus:border-gray-300 bg-transparent px-1 py-0"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {colorFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeColor(colorIndex);
                        if (expandedColorIndex === colorIndex) {
                          setExpandedColorIndex(colorIndex > 0 ? colorIndex - 1 : null);
                        } else if (expandedColorIndex !== null && expandedColorIndex > colorIndex) {
                          setExpandedColorIndex(expandedColorIndex - 1);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                  <svg
                    className={`size-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Roles</Label>
                    <div className="flex gap-2">
                  {(["Primary", "Secondary", "Data"] as const).map((role) => (
                    <label key={role} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.watch(`colors.${colorIndex}.role`)?.includes(role)}
                        onChange={(e) => {
                          const currentRoles = form.getValues(`colors.${colorIndex}.role`) || [];
                          if (e.target.checked) {
                            form.setValue(`colors.${colorIndex}.role`, [...currentRoles, role]);
                          } else {
                            form.setValue(
                              `colors.${colorIndex}.role`,
                              currentRoles.filter((r) => r !== role)
                            );
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                    </div>
                  </div>

                  <FormField
                control={form.control as any}
                name={`colors.${colorIndex}.values.hex`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hex Value</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="#035259" {...field} className="flex-1" />
                      </FormControl>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const hex = field.value;
                          if (hex) {
                            const rgb = hexToRgb(hex);
                            const cmyk = hexToCmyk(hex);
                            if (rgb) form.setValue(`colors.${colorIndex}.values.rgb`, rgb);
                            if (cmyk) form.setValue(`colors.${colorIndex}.values.cmyk`, cmyk);
                          }
                        }}
                        className="shrink-0"
                      >
                        Convert
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name={`colors.${colorIndex}.values.rgb`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RGB Value</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="3, 82, 89" {...field} className="flex-1" />
                      </FormControl>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const rgb = field.value;
                          if (rgb) {
                            const hex = rgbToHex(rgb);
                            const cmyk = rgbToCmyk(rgb);
                            if (hex) form.setValue(`colors.${colorIndex}.values.hex`, hex);
                            if (cmyk) form.setValue(`colors.${colorIndex}.values.cmyk`, cmyk);
                          }
                        }}
                        className="shrink-0"
                      >
                        Convert
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name={`colors.${colorIndex}.values.cmyk`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CMYK Value</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="34, 3, 0, 65" {...field} className="flex-1" />
                      </FormControl>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const cmyk = field.value;
                          if (cmyk) {
                            const rgb = cmykToRgb(cmyk);
                            const hex = cmykToHex(cmyk);
                            if (rgb) form.setValue(`colors.${colorIndex}.values.rgb`, rgb);
                            if (hex) form.setValue(`colors.${colorIndex}.values.hex`, hex);
                          }
                        }}
                        className="shrink-0"
                      >
                        Convert
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </div>
              )}
            </div>
          );
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const newIndex = colorFields.length;
              appendColor({
                name: "",
                role: ["Primary"],
                values: { hex: "", rgb: "", cmyk: "" },
              });
              setExpandedColorIndex(newIndex);
            }} 
          >
            <Plus className="size-4 mr-2" />
            Add Color
          </Button>
        </section>

        {/* Typography - Fonts */}
        <section className="space-y-4 border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Typography - Fonts</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendFont({
                  name: "",
                  source: { type: "google", family: "", weights: [400] },
                })
              }
            >
              <Plus className="size-4" />
              Add Font
            </Button>
          </div>

          {fontFields.map((font, fontIndex) => (
            <div key={font.id} className="space-y-4 border-l-4 border-primary pl-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control as any}
                  name={`typography.fonts.${fontIndex}.name`}
                  render={({ field }) => (
                    <FormItem className="mb-0">
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Font Name"
                          className="text-lg font-medium border-none outline-none focus:border-b-2 focus:border-gray-300 bg-transparent px-1 py-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {fontFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeFont(fontIndex)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control as any}
                name={`typography.fonts.${fontIndex}.source.type`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Type</FormLabel>
                    <FormControl>
                      <select {...field} className="w-full h-9 rounded-md border border-input px-3 bg-transparent">
                        <option value="google">Google Fonts</option>
                        <option value="local">Local</option>
                        <option value="url">URL</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name={`typography.fonts.${fontIndex}.source.family`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Font Family</FormLabel>
                    <FormControl>
                      <Input placeholder="Inter" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Font Weights (comma-separated)</Label>
                <Input
                  placeholder="400, 500, 600, 700"
                  value={form.watch(`typography.fonts.${fontIndex}.source.weights`)?.join(", ")}
                  onChange={(e) => {
                    const weights = e.target.value
                      .split(",")
                      .map((w) => parseInt(w.trim()))
                      .filter((w) => !isNaN(w));
                    form.setValue(`typography.fonts.${fontIndex}.source.weights`, weights);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Upload Font Files (optional)</Label>
                <input
                  type="file"
                  accept=".woff,.woff2,.ttf,.otf"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setUploadedFiles((prev) => ({
                        ...prev,
                        fonts: { ...prev.fonts, [fontIndex]: files },
                      }));
                    }
                  }}
                  id={`font-upload-${fontIndex}`}
                  className="hidden"
                />
                <div 
                  onClick={() => document.getElementById(`font-upload-${fontIndex}`)?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-gray-500', 'bg-gray-100');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
                    
                    const errorKey = `font-${fontIndex}`;
                    const allFiles = Array.from(e.dataTransfer.files);
                    const validFiles = allFiles.filter(file => 
                      file.name.match(/\.(woff|woff2|ttf|otf)$/i)
                    );
                    
                    if (allFiles.length > 0 && validFiles.length === 0) {
                      setUploadErrors(prev => ({ ...prev, [errorKey]: 'Please upload font files (WOFF, WOFF2, TTF, or OTF)' }));
                      setTimeout(() => setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; }), 3000);
                      return;
                    }
                    
                    if (validFiles.length > 0) {
                      setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; });
                      setUploadedFiles((prev) => ({
                        ...prev,
                        fonts: { ...prev.fonts, [fontIndex]: validFiles },
                      }));
                    }
                  }}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="size-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">WOFF, WOFF2, TTF or OTF (multiple files allowed)</p>
                </div>
                {uploadErrors[`font-${fontIndex}`] && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {uploadErrors[`font-${fontIndex}`]}
                  </div>
                )}
                {uploadedFiles.fonts[fontIndex] && (
                  <div className="text-sm text-green-600 flex flex-wrap gap-2">
                    {uploadedFiles.fonts[fontIndex].map((file, idx) => (
                      <span key={idx} className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                        <Upload className="size-3" />
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Typography - Examples */}
        <section className="space-y-4 border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Typography - Examples</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendExample({
                  label: "",
                  font: "",
                  sizePx: 16,
                  weight: 400,
                  text: "",
                })
              }
            >
              <Plus className="size-4" />
              Add Example
            </Button>
          </div>

          {exampleFields.map((example, exampleIndex) => (
            <div key={example.id} className="space-y-4 border-l-4 border-primary pl-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control as any}
                  name={`typography.examples.${exampleIndex}.label`}
                  render={({ field }) => (
                    <FormItem className="mb-0">
                      <FormControl>
                        <input
                          {...field}
                          placeholder="Example Label"
                          className="text-lg font-medium border-none outline-none focus:border-b-2 focus:border-gray-300 bg-transparent px-1 py-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {exampleFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeExample(exampleIndex)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control as any}
                name={`typography.examples.${exampleIndex}.font`}
                render={({ field }) => {
                  const fonts = form.watch('typography.fonts') || [];
                  return (
                    <FormItem>
                      <FormLabel>Font</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full h-9 rounded-md border border-input px-3 bg-transparent"
                        >
                          <option value="">Select a font...</option>
                          {fonts.map((font, idx) => (
                            <option key={idx} value={font.name}>
                              {font.name || `Font ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name={`typography.examples.${exampleIndex}.sizePx`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size (px)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name={`typography.examples.${exampleIndex}.weight`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control as any}
                name={`typography.examples.${exampleIndex}.text`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Example Text</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Designing the Future" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name={`typography.examples.${exampleIndex}.lineHeight`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line Height (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name={`typography.examples.${exampleIndex}.letterSpacing`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Letter Spacing (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.025em" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Gallery */}
        <section className="space-y-4 border rounded-lg p-6">
          <h2 className="text-2xl font-semibold">Gallery (Optional)</h2>


          {/* Grid of uploaded images */}
          {galleryFields.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {galleryFields.map((item, galleryIndex) => (
                <div key={item.id} className="space-y-2">
                  <div className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {uploadedFiles.gallery[galleryIndex] ? (
                      <img
                        src={URL.createObjectURL(uploadedFiles.gallery[galleryIndex])}
                        alt={`Gallery ${galleryIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Upload className="size-8" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        removeGallery(galleryIndex);
                        setUploadedFiles((prev) => {
                          const newGallery = { ...prev.gallery };
                          delete newGallery[galleryIndex];
                          return { ...prev, gallery: newGallery };
                        });
                      }}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <FormField
                    control={form.control as any}
                    name={`gallery.${galleryIndex}.caption`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder="Add caption (optional)..." 
                            {...field} 
                            value={field.value ?? ""}
                            className="text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Multi-upload drop zone */}
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => {
                  const currentLength = form.getValues('gallery')?.length || 0;
                  appendGallery({ caption: "", src: `/assets/gallery/${file.name}` });
                  setUploadedFiles((prev) => ({
                    ...prev,
                    gallery: { ...prev.gallery, [currentLength]: file },
                  }));
                });
              }}
              id="gallery-multi-upload"
              className="hidden"
            />
            <div 
              onClick={() => document.getElementById('gallery-multi-upload')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add('border-gray-500', 'bg-gray-100');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('border-gray-500', 'bg-gray-100');
                
                const errorKey = 'gallery-upload';
                const allFiles = Array.from(e.dataTransfer.files);
                const validFiles = allFiles.filter(file => 
                  file.type.startsWith('image/')
                );
                
                if (allFiles.length > 0 && validFiles.length === 0) {
                  setUploadErrors(prev => ({ ...prev, [errorKey]: 'Please upload image files (PNG, JPG, GIF, or WebP)' }));
                  setTimeout(() => setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; }), 3000);
                  return;
                }
                
                if (validFiles.length > 0) {
                  setUploadErrors(prev => { const { [errorKey]: _, ...rest } = prev; return rest; });
                  validFiles.forEach((file) => {
                    const currentLength = form.getValues('gallery')?.length || 0;
                    appendGallery({ caption: "", src: `/assets/gallery/${file.name}` });
                    setUploadedFiles((prev) => ({
                      ...prev,
                      gallery: { ...prev.gallery, [currentLength]: file },
                    }));
                  });
                }
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Upload className="size-10 mx-auto mb-3 text-gray-400" />
              <p className="text-base text-gray-600 mb-1 font-medium">Drop images here or click to upload</p>
              <p className="text-sm text-gray-500">PNG, JPG, GIF or WebP (multiple files allowed)</p>
            </div>
            {uploadErrors['gallery-upload'] && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {uploadErrors['gallery-upload']}
              </div>
            )}
          </div>

        </section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="gap-2">
            <Download className="size-5" />
            Download Brand Data JSON
          </Button>
        </div>
      </form>
    </Form>
  );
}
