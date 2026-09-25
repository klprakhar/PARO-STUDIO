import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PromptCarousel } from "./PromptCarousel";

describe("PromptCarousel", () => {
  const sampleImages = [
    "https://example.test/img1.png",
    "https://example.test/img2.png",
    "https://example.test/img3.png",
    "https://example.test/img4.png",
  ];

  it("renders 4 images and 4 pagination indicator dots", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    expect(dots).toHaveLength(4);

    // Initial state: first dot is active
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).toHaveClass("w-5", "bg-gold");
    expect(dots[1]).toHaveAttribute("aria-current", "false");
    expect(dots[1]).toHaveClass("w-1.5");
  });

  it("hides previous arrow on first image and shows next arrow", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText("Previous image")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Next image")).toBeInTheDocument();
  });

  it("advances to next image on next arrow click", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const nextBtn = screen.getByLabelText("Next image");
    fireEvent.click(nextBtn);

    // Now at index 1: previous arrow should be visible
    expect(screen.getByLabelText("Previous image")).toBeInTheDocument();

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    expect(dots[0]).toHaveAttribute("aria-current", "false");
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).toHaveClass("w-5", "bg-gold");
  });

  it("navigates to specific image when clicking pagination dots", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    // Click 3rd dot (index 2)
    fireEvent.click(dots[2]);

    expect(dots[2]).toHaveAttribute("aria-current", "true");
    expect(dots[2]).toHaveClass("w-5", "bg-gold");
    expect(dots[0]).toHaveAttribute("aria-current", "false");

    // Click 4th dot (index 3) - last image
    fireEvent.click(dots[3]);
    expect(dots[3]).toHaveAttribute("aria-current", "true");
    expect(screen.queryByLabelText("Next image")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Previous image")).toBeInTheDocument();
  });

  it("navigates on touch swipe left and swipe right", () => {
    const { container } = render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const touchArea = container.querySelector(".select-none")!;
    expect(touchArea).toBeInTheDocument();

    // Swipe left (startX = 100, move to 30 => delta = -70 < -40)
    fireEvent.touchStart(touchArea, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(touchArea, { touches: [{ clientX: 30 }] });
    fireEvent.touchEnd(touchArea);

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    expect(dots[1]).toHaveAttribute("aria-current", "true");

    // Swipe right (startX = 30, move to 100 => delta = 70 > 40)
    fireEvent.touchStart(touchArea, { touches: [{ clientX: 30 }] });
    fireEvent.touchMove(touchArea, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(touchArea);

    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("navigates on keyboard ArrowLeft and ArrowRight", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          images={sampleImages}
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const carouselRegion = screen.getByRole("region", { name: "Test prompt gallery" });

    fireEvent.keyDown(carouselRegion, { key: "ArrowRight" });
    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    expect(dots[1]).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(carouselRegion, { key: "ArrowLeft" });
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("prevents propagation when clicking arrows or dots so parent links are not triggered", () => {
    const onParentClick = vi.fn();

    render(
      <MemoryRouter>
        <div onClick={onParentClick}>
          <PromptCarousel
            images={sampleImages}
            alt="Test prompt"
          />
        </div>
      </MemoryRouter>
    );

    const nextBtn = screen.getByLabelText("Next image");
    fireEvent.click(nextBtn);
    expect(onParentClick).not.toHaveBeenCalled();

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    fireEvent.click(dots[2]);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("supports fallback to 4 images when only a single imageUrl is provided", () => {
    render(
      <MemoryRouter>
        <PromptCarousel
          imageUrl="https://example.test/single.png"
          alt="Test prompt"
        />
      </MemoryRouter>
    );

    const dots = screen.getAllByLabelText(/Go to image \d of 4/);
    expect(dots).toHaveLength(4);
  });
});
