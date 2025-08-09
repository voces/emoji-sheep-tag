//@deno-types="npm:@types/react"
import React from "react";
import { ThemeProvider } from "npm:styled-components";
import { theme } from "../theme.ts";

/**
 * Test wrapper that provides theme context
 */
export const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

/**
 * Gets all text nodes and aria-labels from the DOM and returns their content.
 *
 * @param element - The HTML element to search within (defaults to document.body)
 * @returns An array of strings containing the textContent of all text nodes and aria-label values
 */
export const getAllTexts = (element?: HTMLElement): string[] => {
  const root = element ?? document.body;
  const textContent: string[] = [];

  // Create a TreeWalker to traverse all elements and text nodes
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          // Accept text nodes that have non-whitespace content
          const text = node.textContent?.trim();
          return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Accept elements that have aria-label
          const element = node as Element;
          return element.hasAttribute("aria-label")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        textContent.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) {
        textContent.push(ariaLabel);
      }
    }
  }

  return textContent;
};
