import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useQueryInput } from "../src/useQueryInput.ts";
import type { SuggestData } from "@queryfield/core";

const DATA: SuggestData = { tags: { tech: 10, testing: 4 }, folderTree: [] };

/**
 * Minimal host that mirrors what `QueryInput` does with the hook: own the query
 * string, feed the caret to the hook, and apply the outcomes it returns.
 */
function Harness() {
  const [query, setQuery] = useState("");
  const { suggestions, handleKeyDown, setCaret, setFocused, setDismissed } =
    useQueryInput({ query, data: DATA });

  return (
    <div>
      <input
        aria-label="query"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCaret(e.target.value.length);
          setDismissed(false);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          const outcome = handleKeyDown(e.nativeEvent);

          if (!outcome) return;

          if (outcome.type === "handled") {
            e.preventDefault();
            return;
          }

          if (outcome.type === "apply") {
            e.preventDefault();
            setQuery(outcome.query);
            setCaret(outcome.caret);
            return;
          }

          if (outcome.type === "blur") e.currentTarget.blur();
        }}
      />
      <ul data-testid="suggestions">
        {suggestions.map((s) => (
          <li key={`${s.type}-${s.label}`}>{s.label}</li>
        ))}
      </ul>
    </div>
  );
}

const listText = () => screen.getByTestId("suggestions").textContent ?? "";

/** Render the harness and return its input. */
const setup = () => {
  render(<Harness />);

  return screen.getByLabelText("query") as HTMLInputElement;
};

// `act` is explicit here: RTL's automatic wrapping does not take effect under
// bun + happy-dom, so unwrapped fires log React act() warnings.
const inp = (input: HTMLInputElement, value: string) =>
  act(() => {
    fireEvent.change(input, { target: { value } });
  });

const focus = (input: HTMLInputElement) =>
  act(() => {
    fireEvent.focus(input);
    input.focus();
  });

const key = (input: HTMLInputElement, k: string) =>
  act(() => {
    fireEvent.keyDown(input, { key: k });
  });

describe("useQueryInput", () => {
  test("typing a bare fragment suggests matching tags", () => {
    const input = setup();

    focus(input);
    inp(input, "te");

    expect(listText()).toContain('tag:"tech"');
  });

  test("ArrowDown then Enter applies the highlighted suggestion", () => {
    const input = setup();

    focus(input);
    inp(input, "te");
    key(input, "ArrowDown");
    key(input, "Enter");

    expect(input.value).toBe('tag:"tech"');
  });

  test("no suggestions are offered before focus", () => {
    const input = setup();

    inp(input, "te");

    expect(listText()).toBe("");
  });

  test("Escape blurs the input", () => {
    const input = setup();

    focus(input);
    inp(input, "te");
    key(input, "Escape");

    expect(document.activeElement).not.toBe(input);
  });
});
