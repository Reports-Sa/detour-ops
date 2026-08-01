import type { Metadata } from "next";
import { DetourOps } from "./detour-ops";

export const metadata: Metadata = {
  title: "DetourOps | Traffic Diversion Control System",
  description:
    "An evidence-led operating system for traffic diversion planning, deployment, operation, and closeout.",
};

export default function Home() {
  return <DetourOps />;
}
