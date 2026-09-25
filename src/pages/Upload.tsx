import { PageSkeleton } from "@/components/PageSkeleton";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X, ImageIcon, TrendingUp, AlertCircle, Clock, ShieldCheck, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STANDARD_TAGS } from "@/lib/standardTags";
import { getErrorMessage } from "@/lib/errors";
import { FEATURED_AI_TOOL, OTHER_AI_TOOLS } from "@/lib/aiTools";
import { checkDailyUploadLimit, type DailyUploadLimitStatus } from "@/services/supabase/prompts";
import { ALLOWED_TYPES, MAX_SOURCE_SIZE } from "@/services/supabase/storage";

export default function UploadPrompt() {
  const navigate = useNavigate();
  const { user, session, profile, loading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const isAppendingRef = useRef(false);
  const [toolUsed, setToolUsed] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customTool, setCustomTool] = useState("");
  const [limitStatus, setLimitStatus] = useState<DailyUploadLimitStatus | null>(null);
  const [isCheckingLimit, setIsCheckingLimit] = useState(true);

  useEffect(() => {
    if (user) {
      setIsCheckingLimit(true);
      checkDailyUploadLimit(user.id, profile?.verified)
        .then((status) => {
          setLimitStatus(status);
        })
        .catch((err) => {
          console.error("Failed to check upload limit:", err);
        })
        .finally(() => {
          setIsCheckingLimit(false);
        });
    }
  }, [user, profile?.verified]);

  // Get the actual tool name for submission
  const getActualToolName = () => {
    if (toolUsed === "Other" && customTool.trim()) {
      return customTool.trim();
    }
    return toolUsed;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    // Validate file type and size for all files
    for (const file of rawFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        clearAllImages();
        toast({
          title: "Invalid file type",
          description: "Please select a JPEG, PNG, or WebP image",
          variant: "destructive",
        });
        return;
      }

      if (file.size > MAX_SOURCE_SIZE) {
        toast({
          title: "Image too large",
          description: "That image is too large to process. Please use one under 25MB.",
          variant: "destructive",
        });
        return;
      }
    }

    const isAppending = isAppendingRef.current;
    isAppendingRef.current = false;

    let targetFiles: File[];
    if (isAppending) {
      targetFiles = [...imageFiles, ...rawFiles].slice(0, 4);
    } else {
      targetFiles = rawFiles.slice(0, 4);
    }

    setImageFiles(targetFiles);

    // Create previews
    const previews: string[] = [];
    let loadedCount = 0;
    targetFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews[index] = reader.result as string;
        loadedCount++;
        if (loadedCount === targetFiles.length) {
          setImagePreviews([...previews]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (indexToRemove: number) => {
    const updatedFiles = imageFiles.filter((_, idx) => idx !== indexToRemove);
    const updatedPreviews = imagePreviews.filter((_, idx) => idx !== indexToRemove);
    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearAllImages = () => {
    setImageFiles([]);
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearImage = clearAllImages;

  const handleAddTag = () => {
    const tag = tagInput.toLowerCase().trim();
    if (tag && !tags.includes(tag) && tags.length < 8) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ===== VALIDATION =====

    // 1. Auth check
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload prompts",
        variant: "destructive",
      });
      return;
    }

    // 2. Check daily upload limit for unverified accounts
    const currentLimit = await checkDailyUploadLimit(user.id, profile?.verified);
    setLimitStatus(currentLimit);
    if (!currentLimit.canUpload) {
      toast({
        title: "Daily upload limit reached",
        description: "Unverified accounts can upload a maximum of 3 prompts per day. Limit resets at 12:00 AM UTC.",
        variant: "destructive",
      });
      return;
    }

    // 3. Image required
    if (imageFiles.length === 0) {
      toast({
        title: "Image required",
        description: "Please select an image to upload",
        variant: "destructive",
      });
      return;
    }

    // 4. Title required
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your prompt",
        variant: "destructive",
      });
      return;
    }

    // 5. Prompt text required
    if (!promptText.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter the prompt text",
        variant: "destructive",
      });
      return;
    }

    // 6. AI Tool required
    const actualTool = getActualToolName();
    if (!actualTool) {
      toast({
        title: "AI Tool required",
        description: "Please select the AI tool you used",
        variant: "destructive",
      });
      return;
    }

    // 7. Minimum 3 tags
    if (tags.length < 3) {
      toast({
        title: "More tags needed",
        description: "Please add at least 3 tags to help others discover your prompt",
        variant: "destructive",
      });
      return;
    }

    // ===== UPLOAD FLOW =====

    setIsSubmitting(true);
    const uploadedUrls: string[] = [];

    try {
      // STEP 1: Upload images to Supabase Storage (up to 4 images)
      const { uploadPromptImage, deletePromptImage } = await import('@/services/supabase/storage');

      setIsUploading(true);
      try {
        for (const file of imageFiles) {
          const result = await uploadPromptImage(user.id, file);
          if (result.error || !result.url) {
            throw new Error(result.error || "Could not upload image to storage");
          }
          uploadedUrls.push(result.url);
        }
      } finally {
        setIsUploading(false);
      }

      // STEP 2: Insert into database with explicit user_id
      const { createPrompt } = await import('@/services/supabase/prompts');

      const { prompt, error: dbError } = await createPrompt({
        user_id: user.id, // CRITICAL: explicit user_id for RLS
        title: title.trim(),
        prompt: promptText.trim(),
        image_url: uploadedUrls[0],
        image_urls: uploadedUrls,
        ai_tool: actualTool,
        tags: tags
      });

      if (dbError || !prompt) {
        console.error('❌ Database insert failed:', dbError);

        // CLEANUP: Delete uploaded images since DB insert failed
        for (const url of uploadedUrls) {
          await deletePromptImage(url).catch(() => {});
        }

        const isLimitError = dbError?.code === 'P0001' || dbError?.message?.includes('Daily prompt upload limit');
        toast({
          title: isLimitError ? "Daily upload limit reached" : "Upload failed",
          description: isLimitError
            ? "Unverified accounts can upload a maximum of 3 prompts per day. Limit resets at 12:00 AM UTC."
            : (dbError?.message || "Could not save prompt to database"),
          variant: "destructive",
        });
        return;
      }

      // CRITICAL VERIFICATION: Ensure prompt has id and user_id

      if (!prompt.id) {
        console.error('❌ CRITICAL ERROR: Inserted prompt has no ID!');
        toast({
          title: "Upload failed",
          description: "Prompt was created but has no ID",
          variant: "destructive",
        });
        return;
      }

      if (!prompt.user_id) {
        console.error('❌ WARNING: Inserted prompt has no user_id!');
      }

      if (prompt.user_id !== user.id) {
        console.error('❌ WARNING: user_id mismatch!', {
          expected: user.id,
          actual: prompt.user_id
        });
      }


      // SUCCESS
      toast({
        title: "Success!",
        description: "Your prompt has been uploaded successfully"
      });

      // Redirect to prompt detail page using the returned ID
      navigate(`/prompt/${prompt.id}`, { replace: true });

    } catch (error) {
      console.error('❌ Unexpected upload error:', error);

      // CLEANUP: If we uploaded images to storage but error occurred, clean them up
      if (uploadedUrls.length > 0) {
        try {
          const { deletePromptImage } = await import('@/services/supabase/storage');
          for (const url of uploadedUrls) {
            await deletePromptImage(url).catch(() => {});
          }
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup images:', cleanupError);
        }
      }

      const errorMessage = getErrorMessage(error, "An unexpected error occurred");
      const isLimitError = (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P0001") ||
        errorMessage.includes("Daily prompt upload limit");

      toast({
        title: isLimitError ? "Daily upload limit reached" : "Upload failed",
        description: isLimitError
          ? "Unverified accounts can upload a maximum of 3 prompts per day. Limit resets at 12:00 AM UTC."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  // Auth guard: wait for loading, then check session
  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background">
        <Navbar />
        <main className="pt-14 sm:pt-16 lg:pt-20 px-4 sm:px-6 lg:px-8 text-center py-12 sm:py-16">
          <PageSkeleton />
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background">
        <Navbar />
        <main className="pt-14 sm:pt-16 lg:pt-20 px-4 sm:px-6 lg:px-8 text-center py-12 sm:py-16">
          <h1 className="font-serif text-xl sm:text-2xl mb-3 sm:mb-4">Sign in to upload</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            You need to be signed in to upload prompts
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-14 sm:pt-16 lg:pt-20">
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-xl sm:max-w-2xl mx-auto">
            <h1 className="font-serif text-2xl sm:text-3xl text-center mb-6 sm:mb-8">
              Upload Prompt
            </h1>

            {/* Daily Upload Limit Status Banner */}
            {limitStatus && (
              <div className="mb-6">
                {limitStatus.isVerified ? (
                  <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border/50 rounded-sm text-xs sm:text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-accent flex-shrink-0" />
                    <span>Verified Creator &bull; Unlimited daily uploads</span>
                  </div>
                ) : limitStatus.remaining <= 0 ? (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-sm text-destructive flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base">Daily upload limit reached (3/3)</h4>
                      <p className="text-xs sm:text-sm mt-1 text-destructive/90">
                        Unverified accounts can upload a maximum of 3 prompts per calendar day. Deleting prompts does not restore your daily allowance. Your limit will reset at 12:00 AM UTC.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 p-3 bg-secondary/40 border border-border/50 rounded-sm text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-foreground/70 flex-shrink-0" />
                      <span>
                        <strong className="text-foreground">{limitStatus.remaining} of {limitStatus.limit}</strong> daily uploads remaining today
                      </span>
                    </div>
                    <span className="text-[11px] sm:text-xs text-muted-foreground/80">Resets at 12:00 AM UTC</span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm sm:text-base">
                    Images <span className="text-xs font-normal text-muted-foreground">(up to 4)</span>
                  </Label>
                  {imagePreviews.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {imagePreviews.length} of 4 selected
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {imagePreviews.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      isAppendingRef.current = false;
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-36 sm:h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 sm:gap-3 hover:border-accent transition-colors bg-secondary/30 touch-target"
                  >
                    <ImageIcon className="h-8 sm:h-10 w-8 sm:w-10 text-muted-foreground" />
                    <div className="text-center px-4">
                      <p className="text-xs sm:text-sm font-medium">Click to upload images (up to 4)</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP &bull; Select up to 4 images</p>
                    </div>
                  </button>
                ) : (
                  <UploadCarouselPreview
                    previews={imagePreviews}
                    onRemove={removeImage}
                    onClearAll={clearAllImages}
                    onAddMore={() => {
                      isAppendingRef.current = true;
                      fileInputRef.current?.click();
                    }}
                  />
                )}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm sm:text-base">Title</Label>
                <Input
                  id="title"
                  placeholder="Give your prompt a descriptive title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={100}
                  className="bg-secondary/50 border-0 text-sm sm:text-base"
                />
              </div>

              {/* Prompt Text */}
              <div className="space-y-2">
                <Label htmlFor="promptText" className="text-sm sm:text-base">Prompt</Label>
                <Textarea
                  id="promptText"
                  placeholder="Enter the full prompt text..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  required
                  rows={5}
                  className="bg-secondary/50 border-0 resize-none text-sm sm:text-base min-h-[120px] sm:min-h-[150px]"
                />
              </div>

              {/* Tool Used */}
              <div className="space-y-2">
                <Label htmlFor="toolUsed" className="text-sm sm:text-base">AI Tool</Label>
                <Select value={toolUsed} onValueChange={(value) => {
                  setToolUsed(value);
                  if (value !== "Other") {
                    setCustomTool("");
                  }
                }} required>
                  <SelectTrigger className="bg-secondary/50 border-0 text-sm sm:text-base">
                    <SelectValue placeholder="Select the tool used" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* NANO BANANA - Featured Tool */}
                    <SelectItem value={FEATURED_AI_TOOL} className="relative">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {FEATURED_AI_TOOL}
                        </span>
                        <TrendingUp className="h-3.5 w-3.5 text-gold" />
                      </span>
                    </SelectItem>
                    <div className="h-px bg-border my-1" />
                    {OTHER_AI_TOOLS.map((tool) => (
                      <SelectItem key={tool} value={tool}>
                        {tool}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Custom tool input when "Other" is selected */}
                {toolUsed === "Other" && (
                  <Input
                    placeholder="Enter the name of the tool"
                    value={customTool}
                    onChange={(e) => setCustomTool(e.target.value)}
                    className="bg-secondary/50 border-0 mt-2 text-sm sm:text-base"
                    required
                  />
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-sm sm:text-base">
                  Tags ({tags.length}/8) — minimum 3
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="Add a tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="bg-secondary/50 border-0 text-sm sm:text-base flex-1"
                    disabled={tags.length >= 8}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTag}
                    disabled={tags.length >= 8 || !tagInput.trim()}
                    className="flex-shrink-0"
                  >
                    Add
                  </Button>
                </div>

                {/* Suggested Tags */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Suggested tags:</p>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {STANDARD_TAGS.filter(tag => !tags.includes(tag)).slice(0, 12).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (tags.length < 8 && !tags.includes(tag)) {
                            setTags([...tags, tag]);
                          }
                        }}
                        disabled={tags.length >= 8}
                        className="px-2 py-0.5 text-xs bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-sm transition-colors disabled:opacity-50"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-secondary text-xs sm:text-sm rounded-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          aria-label={`Remove ${tag} tag`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full text-sm sm:text-base py-2.5 sm:py-3"
                disabled={
                  isSubmitting ||
                  isCheckingLimit ||
                  (limitStatus !== null && !limitStatus.isVerified && limitStatus.remaining <= 0) ||
                  !toolUsed ||
                  (toolUsed === "Other" && !customTool.trim()) ||
                  tags.length < 3 ||
                  imageFiles.length === 0
                }
              >
                {isUploading
                  ? `Uploading image${imageFiles.length > 1 ? "s" : ""} (${imageFiles.length})...`
                  : isSubmitting
                    ? "Saving..."
                    : isCheckingLimit
                      ? "Checking upload limit..."
                      : limitStatus && !limitStatus.isVerified && limitStatus.remaining <= 0
                        ? "Daily Limit Reached (3/3)"
                        : "Upload Prompt"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ─── Upload Carousel Preview ────────────────────────────────────────────── */

interface UploadCarouselPreviewProps {
  previews: string[];
  onRemove: (index: number) => void;
  onClearAll: () => void;
  onAddMore: () => void;
}

function UploadCarouselPreview({ previews, onRemove, onClearAll, onAddMore }: UploadCarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Keep activeIndex in bounds when images are removed
  const safeIndex = Math.min(activeIndex, previews.length - 1);

  const goToPrev = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.max(0, i - 1));
    },
    []
  );

  const goToNext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.min(previews.length - 1, i + 1));
    },
    [previews.length]
  );

  const handleRemove = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(idx);
    // Adjust index after removal
    if (idx <= safeIndex && safeIndex > 0) {
      setActiveIndex(safeIndex - 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Carousel Viewport */}
      <div className="relative rounded-xl overflow-hidden bg-secondary border border-border/50 select-none">
        {/* Sliding track */}
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {previews.map((preview, idx) => (
            <div key={idx} className="w-full flex-shrink-0 relative">
              <img
                src={preview}
                alt={idx === 0 ? "Cover image preview" : `Preview image ${idx + 1}`}
                className="w-full max-h-64 sm:max-h-80 object-contain bg-secondary"
              />
              {/* Label badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-background/90 text-foreground text-[11px] font-medium backdrop-blur-sm border border-border/40">
                {idx === 0 ? "Cover Image" : `Image ${idx + 1} of ${previews.length}`}
              </div>
              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => handleRemove(e, idx)}
                className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded-full transition-colors shadow-sm"
                aria-label={`Remove image ${idx + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Left Arrow */}
        {safeIndex > 0 && (
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-background/85 hover:bg-background text-foreground backdrop-blur-md border border-border/50 shadow-md flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Right Arrow */}
        {safeIndex < previews.length - 1 && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-background/85 hover:bg-background text-foreground backdrop-blur-md border border-border/50 shadow-md flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      {previews.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {previews.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveIndex(idx); }}
              aria-label={`Go to image ${idx + 1}`}
              className={cn(
                "rounded-full transition-all duration-300",
                idx === safeIndex
                  ? "w-5 h-1.5 bg-gold"
                  : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              )}
            />
          ))}
        </div>
      )}

      {/* Footer: info + add more + clear all */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {previews.length === 1
            ? "The first image will be used as the prompt cover"
            : "The first image will be used as the prompt cover"}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {previews.length < 4 && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onAddMore(); }}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add ({previews.length}/4)
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClearAll(); }}
            className="hover:text-destructive transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}
