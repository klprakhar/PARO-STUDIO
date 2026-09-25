import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPromptImages } from "@/services/supabase/prompts";

export interface PromptCarouselProps {
  /** Single primary image URL */
  imageUrl?: string | null;
  /** Array of multiple image URLs (if available) */
  imageUrls?: string[] | null;
  /** Direct images array */
  images?: string[];
  /** Title/description for image accessibility */
  alt: string;
  /** Link destination when clicking on the image surface */
  linkTo?: string;
  /** Whether this carousel is in the viewport above the fold (eager load first image) */
  priority?: boolean;
  /** Optional container CSS classes */
  className?: string;
  /** Optional individual image CSS classes */
  imageClassName?: string;
  /** Display variant: "card" for feed cards, "detail" for prompt detail page */
  variant?: "card" | "detail";
  /** Click handler for when an image itself is clicked (separate from carousel controls) */
  onImageClick?: (index: number, event: React.MouseEvent) => void;
  /** Optional custom slot to render over the image (e.g. mobile options menu) */
  children?: React.ReactNode;
}

export function PromptCarousel({
  imageUrl,
  imageUrls,
  images: directImages,
  alt,
  linkTo,
  priority = false,
  className,
  imageClassName,
  variant = "card",
  onImageClick,
  children,
}: PromptCarouselProps) {
  const images = directImages && directImages.length > 0
    ? directImages
    : getPromptImages(imageUrl, imageUrls);

  const totalImages = images.length;

  // displayIndex: with clones, 0 is clone of last, 1..totalImages are real, totalImages + 1 is clone of first
  const [displayIndex, setDisplayIndex] = useState(totalImages > 1 ? 1 : 0);
  const [enableTransition, setEnableTransition] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Active logical image index (0 to totalImages - 1)
  const activeIndex = totalImages > 1
    ? (displayIndex - 1 + totalImages) % totalImages
    : 0;

  const startAutoAdvance = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setEnableTransition(true);
      setDisplayIndex((prev) => prev + 1);
    }, 2000);
  }, []);

  const stopAutoAdvance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pauseAndResume = useCallback(() => {
    stopAutoAdvance();
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    if (variant === "card" && isHovered) {
      pauseTimeoutRef.current = setTimeout(() => {
        startAutoAdvance();
      }, 3000);
    }
  }, [isHovered, startAutoAdvance, stopAutoAdvance, variant]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (totalImages <= 1) return;

    // Reached clone of first image at the end -> seamlessly snap back to real first image (index 1)
    if (displayIndex >= totalImages + 1) {
      setEnableTransition(false);
      setDisplayIndex(1);
    }
    // Reached clone of last image at the beginning -> seamlessly snap to real last image
    else if (displayIndex <= 0) {
      setEnableTransition(false);
      setDisplayIndex(totalImages);
    }
  }, [displayIndex, totalImages]);

  const goToNext = useCallback(
    (e?: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      pauseAndResume();

      if (displayIndex >= totalImages + 1) {
        setEnableTransition(false);
        setDisplayIndex(1);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setEnableTransition(true);
            setDisplayIndex(2);
          });
        });
        return;
      }

      setEnableTransition(true);
      setDisplayIndex((prev) => prev + 1);
    },
    [displayIndex, totalImages, pauseAndResume]
  );

  const goToPrev = useCallback(
    (e?: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      pauseAndResume();

      if (displayIndex <= 0) {
        setEnableTransition(false);
        setDisplayIndex(totalImages);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setEnableTransition(true);
            setDisplayIndex(totalImages - 1);
          });
        });
        return;
      }

      setEnableTransition(true);
      setDisplayIndex((prev) => prev - 1);
    },
    [displayIndex, totalImages, pauseAndResume]
  );

  const goToIndex = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pauseAndResume();
      setEnableTransition(true);
      setDisplayIndex(index + 1);
    },
    [pauseAndResume]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null) {
      const swipeThreshold = 40;
      if (touchDeltaX.current < -swipeThreshold) {
        goToNext();
      } else if (touchDeltaX.current > swipeThreshold) {
        goToPrev();
      }
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrev(e);
    else if (e.key === "ArrowRight") goToNext(e);
  };

  // ── Hover auto-advance on feed cards ────────────────────────────────────────
  useEffect(() => {
    if (variant !== "card" || totalImages <= 1) return;
    if (isHovered) {
      startAutoAdvance();
    } else {
      stopAutoAdvance();
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      // Reset smoothly to the first image when mouse leaves
      setEnableTransition(false);
      setDisplayIndex(1);
    }
    return () => {
      stopAutoAdvance();
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [isHovered, totalImages, variant, startAutoAdvance, stopAutoAdvance]);

  // ── Hover tracking: only trigger leave if cursor leaves the carousel entirely ──
  const handleMouseEnter = useCallback(() => {
    if (variant === "card" && totalImages > 1) {
      setIsHovered(true);
    }
  }, [variant, totalImages]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (variant !== "card") return;
    const root = rootRef.current;
    if (root && e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) {
      return;
    }
    setIsHovered(false);
  }, [variant]);

  // Build slides with clones for seamless infinite looping in one continuous direction
  // [clone of last, real 0, real 1, ..., real N-1, clone of 0]
  const slides = totalImages > 1
    ? [
        { src: images[totalImages - 1], realIndex: totalImages - 1, key: "clone-last" },
        ...images.map((src, idx) => ({ src, realIndex: idx, key: `real-${idx}` })),
        { src: images[0], realIndex: 0, key: "clone-first" },
      ]
    : [{ src: images[0], realIndex: 0, key: "single-0" }];

  return (
    <div
      ref={rootRef}
      className={cn("flex flex-col w-full group/carousel relative", className)}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} gallery`}
    >
      {/* ── Image viewport ── */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl bg-secondary/20 select-none",
          variant === "card" ? "" : "flex items-center justify-center min-h-[260px] sm:min-h-[340px]"
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Infinite Horizontal Sliding Track ── */}
        <div
          className="flex w-full"
          style={{
            transform: `translateX(-${displayIndex * 100}%)`,
            transition: enableTransition ? "transform 500ms ease-out" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((slide, slideIdx) => {
            const isSlideActive = slide.realIndex === activeIndex;
            const imageEl = (
              <img
                src={slide.src}
                alt={isSlideActive ? alt : `${alt} - ${slide.realIndex + 1}`}
                className={cn(
                  "w-full transition-transform duration-500",
                  variant === "card"
                    ? "h-auto object-cover group-hover/carousel:scale-[1.03]"
                    : "max-h-[42vh] sm:max-h-[48vh] lg:max-h-[55vh] w-auto max-w-full object-contain rounded-xl shadow-card select-none",
                  imageClassName
                )}
                loading={priority && slideIdx === 1 ? "eager" : "lazy"}
                aria-hidden={!isSlideActive}
              />
            );

            return (
              <div
                key={slide.key}
                className={cn(
                  "w-full flex-shrink-0 relative overflow-hidden flex items-center justify-center",
                  variant === "card"
                    ? "aspect-auto cursor-pointer"
                    : "max-h-[42vh] sm:max-h-[48vh] lg:max-h-[55vh]"
                )}
                role="group"
                aria-roledescription="slide"
                aria-label={`Image ${slide.realIndex + 1} of ${totalImages}`}
              >
                {linkTo ? (
                  <Link
                    to={linkTo}
                    className="block w-full flex items-center justify-center"
                    onClick={(e) => onImageClick?.(slide.realIndex, e)}
                  >
                    {imageEl}
                  </Link>
                ) : (
                  <div
                    className="w-full flex items-center justify-center"
                    onClick={(e) => onImageClick?.(slide.realIndex, e)}
                  >
                    {imageEl}
                  </div>
                )}

                {/* Subtle dark gradient overlay on hover for cards */}
                {variant === "card" && (
                  <div className="absolute inset-0 bg-foreground/0 group-hover/carousel:bg-foreground/5 transition-colors duration-300 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Left Navigation Arrow ── */}
        {totalImages > 1 && (
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Previous image"
            title="Previous image"
            className={cn(
              "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 cursor-pointer",
              "flex items-center justify-center rounded-full shadow-lg backdrop-blur-md",
              "transition-all duration-200 active:scale-90 hover:scale-110",
              variant === "card"
                ? cn(
                    "w-7 h-7 sm:w-8 sm:h-8",
                    "bg-black/65 hover:bg-black/85 text-white border border-white/25",
                    "opacity-75 sm:opacity-0 sm:group-hover/carousel:opacity-100 sm:scale-95 sm:group-hover/carousel:scale-100"
                  )
                : cn(
                    "w-9 h-9 sm:w-10 sm:h-10",
                    "bg-background/85 hover:bg-background text-foreground border border-border/60",
                    "opacity-90 hover:opacity-100 shadow-md"
                  )
            )}
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        {/* ── Right Navigation Arrow ── */}
        {totalImages > 1 && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next image"
            title="Next image"
            className={cn(
              "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 cursor-pointer",
              "flex items-center justify-center rounded-full shadow-lg backdrop-blur-md",
              "transition-all duration-200 active:scale-90 hover:scale-110",
              variant === "card"
                ? cn(
                    "w-7 h-7 sm:w-8 sm:h-8",
                    "bg-black/65 hover:bg-black/85 text-white border border-white/25",
                    "opacity-75 sm:opacity-0 sm:group-hover/carousel:opacity-100 sm:scale-95 sm:group-hover/carousel:scale-100"
                  )
                : cn(
                    "w-9 h-9 sm:w-10 sm:h-10",
                    "bg-background/85 hover:bg-background text-foreground border border-border/60",
                    "opacity-90 hover:opacity-100 shadow-md"
                  )
            )}
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        {/* Image counter badge (e.g. "1 / 4") — detail variant */}
        {variant === "detail" && totalImages > 1 && (
          <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-full bg-background/85 backdrop-blur-sm border border-border/40 text-xs font-medium text-foreground tabular-nums shadow-sm select-none">
            {activeIndex + 1} / {totalImages}
          </div>
        )}

        {/* Custom overlays (e.g. mobile drawer trigger) */}
        {children}
      </div>

      {/* ── Carousel Pagination Dots ── */}
      {totalImages > 1 && (
        <div
          className={cn(
            "flex items-center justify-center gap-1.5 py-2",
            variant === "card" ? "pt-1.5 pb-0.5" : "pt-2.5 pb-1"
          )}
          aria-label="Carousel pagination"
        >
          {images.map((_, index) => {
            const isDotActive = index === activeIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={(e) => goToIndex(index, e)}
                aria-label={`Go to image ${index + 1} of ${totalImages}`}
                aria-current={isDotActive ? "true" : "false"}
                className={cn(
                  "rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                  isDotActive
                    ? variant === "card"
                      ? "w-5 h-1.5 bg-gold shadow-sm"
                      : "w-6 h-2 bg-gold shadow-sm"
                    : variant === "card"
                      ? "w-1.5 h-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/65"
                      : "w-2 h-2 bg-muted-foreground/35 hover:bg-muted-foreground/65"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
