import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { render, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "@std/expect";
import { Wrapper } from "../../Wrapper.tsx";
import { Chat } from "./Chat.tsx";
import { showChatBoxVar } from "@/vars/showChatBox.ts";

const findChatInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector("input");
  if (!input) throw new Error("chat input not found");
  return input;
};

it("does not leave showChatBox as 'open' after the input blurs (empty)", async () => {
  showChatBoxVar("open");
  const { container } = render(<Chat />, { wrapper: Wrapper });
  const input = findChatInput(container);

  await waitFor(() => expect(document.activeElement).toBe(input));

  input.blur();

  await waitFor(() => expect(showChatBoxVar()).not.toBe("open"));
  expect(showChatBoxVar()).toBe("closed");
});

it("transitions to 'dismissed' when blurring with text in the input", async () => {
  showChatBoxVar("open");
  const { container } = render(<Chat />, { wrapper: Wrapper });
  const input = findChatInput(container);

  await waitFor(() => expect(document.activeElement).toBe(input));

  await userEvent.type(input, "hello");

  input.blur();

  await waitFor(() => expect(showChatBoxVar()).toBe("dismissed"));
});

it("does not clobber a non-open state when blur fires after an external state change", async () => {
  showChatBoxVar("open");
  const { container } = render(<Chat />, { wrapper: Wrapper });
  const input = findChatInput(container);

  await waitFor(() => expect(document.activeElement).toBe(input));

  await userEvent.type(input, "hello");

  showChatBoxVar("sent");

  await waitFor(() => expect(showChatBoxVar()).toBe("closed"));
});
