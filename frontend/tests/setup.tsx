import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ priority, ...props }: Record<string, unknown>) => <img alt="" {...props} />,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
});
