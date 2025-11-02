import "global-jsdom/register";
import { afterEach, beforeEach } from "@std/testing/bdd";
import { cleanup, configure } from "@testing-library/react";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";
import { data } from "../data.ts";
import { app, map, unloadEcs } from "../ecs.ts";

localStorage.clear();

// Configure Testing Library to use compact output
configure({
  getElementError: function (message: string | null, container) {
    const compactHtml = prettifyDOM(container, {
      maxDepth: 3,
      highlight: true,
    });
    const error = new Error(
      [message, compactHtml].filter(Boolean).join("\n\n"),
    );
    error.name = "TestingLibraryElementError";
    return error;
  },
});

const colors = {
  tag: "\x1b[36m",
  attr: "\x1b[33m",
  value: "\x1b[32m",
  text: "\x1b[0m",
  comment: "\x1b[90m",
  reset: "\x1b[0m",
};

const formatAttributes = (
  attributes: NamedNodeMap,
  highlight: boolean,
): string =>
  Array.from(attributes)
    .map((attr) => {
      const value = attr.value.length > 60
        ? attr.value.slice(0, 60) + "..."
        : attr.value;
      return highlight
        ? `${colors.attr}${attr.name}${colors.reset}=${colors.value}"${value}"${colors.reset}`
        : `${attr.name}="${value}"`;
    })
    .join(" ");

const formatTag = (
  tagName: string,
  attrs: string,
  content: string,
  highlight: boolean,
): string => {
  const attrsStr = attrs ? ` ${attrs}` : "";
  if (!highlight) return `<${tagName}${attrsStr}>${content}</${tagName}>`;

  return `${colors.tag}<${tagName}${colors.reset}${attrsStr}${colors.tag}>${colors.reset}${content}${colors.tag}</${tagName}>${colors.reset}`;
};

const formatSelfClosingTag = (
  tagName: string,
  attrs: string,
  highlight: boolean,
): string => {
  const attrsStr = attrs ? ` ${attrs}` : "";
  if (!highlight) return `<${tagName}${attrsStr} />`;

  return `${colors.tag}<${tagName}${colors.reset}${attrsStr}${colors.tag} />${colors.reset}`;
};

const prettifyDOM = (
  dom: Element | Document,
  options?: { maxDepth?: number; highlight?: boolean },
): string => {
  const maxDepth = options?.maxDepth ?? 3;
  const highlight = options?.highlight ?? true;
  const element = dom instanceof Document ? dom.body : dom;

  const compactify = (node: Element, depth = 0): string => {
    if (depth > maxDepth) return "";

    const indent = "  ".repeat(depth);
    const tagName = node.tagName.toLowerCase();
    const attrs = formatAttributes(node.attributes, highlight);

    if (tagName === "svg") {
      const svgContent = highlight
        ? `${colors.comment}...${colors.reset}`
        : "...";
      return indent + formatTag("svg", attrs, svgContent, highlight);
    }

    const children = Array.from(node.children);
    const textContent = node.textContent?.trim();

    if (children.length === 0 && textContent && textContent.length < 50) {
      return indent + formatTag(tagName, attrs, textContent, highlight);
    }

    if (children.length === 0) {
      return indent + formatSelfClosingTag(tagName, attrs, highlight);
    }

    const childrenStr = children
      .map((child) => compactify(child as Element, depth + 1))
      .filter(Boolean)
      .join("\n");

    const attrsStr = attrs ? ` ${attrs}` : "";
    const openTag = highlight
      ? `${colors.tag}<${tagName}${colors.reset}${attrsStr}${colors.tag}>${colors.reset}`
      : `<${tagName}${attrsStr}>`;
    const closeTag = highlight
      ? `${colors.tag}</${tagName}>${colors.reset}`
      : `</${tagName}>`;

    return `${indent}${openTag}\n${childrenStr}\n${indent}${closeTag}`;
  };

  return compactify(element);
};

// Basic setup for tests that only need client state cleanup (no WebSocket server)
beforeEach(() => {
  // Reset client state (shared by all tests)
  __testing_reset_all_vars();
  data.sheep = [];
  data.wolves = [];
  unloadEcs();
});

afterEach(() => {
  for (const entity of app.entities) app.removeEntity(entity);
  for (const key in map) delete map[key];
  cleanup();
});
