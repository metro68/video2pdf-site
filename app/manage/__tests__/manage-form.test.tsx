import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageForm } from "@/app/manage/components/ManageForm";

const fetchMock = vi.fn(
  async (
    _url: string,
    _init?: RequestInit,
  ): Promise<{ ok: boolean; json: () => Promise<{ url?: string; error?: string }> }> => ({
    ok: true,
    json: async () => ({ url: "https://billing.stripe.test/p/session_1" }),
  }),
);
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockClear();
});

describe("ManageForm", () => {
  it("renders a heading, email input, and manage subscription button", () => {
    render(<ManageForm />);
    expect(screen.getByRole("heading", { name: /manage your subscription/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage subscription/i })).toBeInTheDocument();
  });

  it("posts the email to /api/portal and redirects to the returned url on success", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign, href: "" }, writable: true });
    render(<ManageForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/portal");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: "a@b.com" });
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://billing.stripe.test/p/session_1"),
    );
  });

  it("shows an inline error when the email has no subscription", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "No subscription found for that email" }),
    });
    render(<ManageForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "nobody@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));
    await waitFor(() =>
      expect(screen.getByText(/we could not find a subscription for that email/i)).toBeInTheDocument(),
    );
  });

  it("shows a generic error and re-enables the button when the request throws", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("network down");
    });
    render(<ManageForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    const button = screen.getByRole("button", { name: /manage subscription/i });
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
