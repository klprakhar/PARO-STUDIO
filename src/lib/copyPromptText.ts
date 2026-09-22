import { getPromptText } from "@/services/supabase/prompts";

/**
 * Copies a prompt's text to the clipboard. Returns false if it could not.
 *
 * Signed in lists already carry the text, so the normal case writes straight
 * away inside the tap. The fetch is a fallback for the moment a page is still
 * showing card data from a signed out cache. Safari may refuse that write,
 * because the tap no longer counts after a network wait, so callers must
 * handle false rather than assume the copy worked.
 */
export async function copyPromptText(promptId: string, knownText?: string): Promise<boolean> {
  try {
    let text = knownText;

    if (!text) {
      const { text: fetched } = await getPromptText(promptId);
      text = fetched ?? undefined;
    }

    if (!text) return false;

    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Copy prompt failed:", error);
    return false;
  }
}
