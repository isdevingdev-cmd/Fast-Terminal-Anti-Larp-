import { Suspense } from "react";
import { LarpScanner } from "@/components/larp/LarpScanner";

export default function LarpCheckPage() {
  return (
    <Suspense fallback={null}>
      <LarpScanner />
    </Suspense>
  );
}
