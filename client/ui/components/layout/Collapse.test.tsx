import "@/testing/setup.ts";
import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { render, screen, waitFor } from "npm:@testing-library/react";
import { userEvent } from "npm:@testing-library/user-event";
import { useState } from "react";
import Collapse from "./Collapse.tsx";

// Test wrapper component that provides interactive functionality
const CollapseTestWrapper = (
  { initialOpen = false }: { initialOpen?: boolean },
) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "Collapse" : "Expand"}
      </button>
      <Collapse isOpen={isOpen}>
        <div>Test content that can be collapsed</div>
      </Collapse>
    </>
  );
};

describe("Collapse component", () => {
  it("should render children when isOpen is true", () => {
    render(
      <Collapse isOpen>
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    expect(content).toBeTruthy();
    // Check that content is visible (parent has height)
    const parent = content.parentElement as HTMLDivElement;
    expect(parent.style.height).toBe("auto");
  });

  it("should render children when isOpen is false", () => {
    render(
      <Collapse isOpen={false}>
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    expect(content).toBeTruthy();
    // Check that content is hidden (parent has 0 height)
    const parent = content.parentElement as HTMLDivElement;
    expect(parent.style.height).toBe("0px");
  });

  it("should toggle visibility when button is clicked", async () => {
    const user = userEvent.setup();
    render(<CollapseTestWrapper initialOpen={false} />);

    const button = screen.getByRole("button", { name: "Expand" });
    const content = screen.getByText("Test content that can be collapsed");
    const container = content.parentElement as HTMLDivElement;

    // Initially closed (height 0)
    expect(container.style.height).toBe("0px");
    expect(button.textContent).toBe("Expand");

    // Click to expand
    await user.click(button);

    // After animation, should be open (height auto)
    await waitFor(() => {
      expect(container.style.height).toBe("auto");
    });
    expect(screen.getByRole("button", { name: "Collapse" })).toBeTruthy();

    // Click to collapse
    await user.click(screen.getByRole("button", { name: "Collapse" }));

    // After animation, should be closed (height 0)
    await waitFor(() => {
      expect(container.style.height).toBe("0px");
    });
    expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy();
  });

  it("should apply correct initial styles when open", () => {
    render(
      <Collapse isOpen>
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    const collapseDiv = content.parentElement as HTMLDivElement;
    expect(collapseDiv.style.height).toBe("auto");
    expect(collapseDiv.style.overflow).toBe("hidden");
  });

  it("should apply correct initial styles when closed", () => {
    render(
      <Collapse isOpen={false}>
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    const collapseDiv = content.parentElement as HTMLDivElement;
    expect(collapseDiv.style.height).toBe("0px");
    expect(collapseDiv.style.overflow).toBe("hidden");
  });

  it("should merge custom styles with initial styles", () => {
    render(
      <Collapse
        isOpen
        style={{ backgroundColor: "red", color: "white" }}
      >
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    const collapseDiv = content.parentElement as HTMLDivElement;
    expect(collapseDiv.style.backgroundColor).toBe("red");
    expect(collapseDiv.style.color).toBe("white");
    expect(collapseDiv.style.height).toBe("auto");
    expect(collapseDiv.style.overflow).toBe("hidden");
  });

  it("should forward HTML div attributes", () => {
    render(
      <Collapse
        isOpen
        className="custom-class"
      >
        <div>Test content</div>
      </Collapse>,
    );

    const content = screen.getByText("Test content");
    const collapseDiv = content.parentElement as HTMLDivElement;
    expect(collapseDiv.className).toBe("custom-class");
  });
});
