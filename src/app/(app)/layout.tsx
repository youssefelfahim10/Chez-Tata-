import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-6 pb-28">{children}</main>
      <Suspense>
        <BottomNav />
      </Suspense>
    </>
  );
}
