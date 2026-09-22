import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyPromptText } from "./copyPromptText";
import { getPromptText } from "@/services/supabase/prompts";

vi.mock("@/services/supabase/prompts", () => ({
  getPromptText: vi.fn(),
}));

describe("copyPromptText", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("copies text it already has without fetching", async () => {
    expect(await copyPromptText("p1", "a prompt")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("a prompt");
    expect(getPromptText).not.toHaveBeenCalled();
  });

  it("fetches the text when it was not loaded", async () => {
    vi.mocked(getPromptText).mockResolvedValue({ text: "fetched prompt", error: null });

    expect(await copyPromptText("p1")).toBe(true);
    expect(getPromptText).toHaveBeenCalledWith("p1");
    expect(writeText).toHaveBeenCalledWith("fetched prompt");
  });

  it("never copies the word undefined when the text is unavailable", async () => {
    vi.mocked(getPromptText).mockResolvedValue({ text: null, error: null });

    expect(await copyPromptText("p1")).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("reports failure when the browser refuses the clipboard write", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));

    expect(await copyPromptText("p1", "a prompt")).toBe(false);
  });
});
