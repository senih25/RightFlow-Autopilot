import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RightFlow Autopilot",
  description: "Explainable Qwen-powered social-rights case orchestration.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
