import Link from "next/link";
import { Button } from "@/components/ui/button";
import ChatgptIcon from "@/components/layout/svgs/chatgpt";
import ClaudeIcon from "@/components/layout/svgs/claude";
import GeminiIcon from "@/components/layout/svgs/gemini";

const lightStripes = {
  background:
    "repeating-linear-gradient(-45deg, #f5f5f5, #f5f5f5 14px, #f0f0f0 14px, #f0f0f0 16px)",
  borderImageSource:
    "repeating-linear-gradient(to bottom, #e5e5e5 0px, #e5e5e5 10px, transparent 10px, transparent 20px)",
};
const darkStripes = {
  background:
    "repeating-linear-gradient(-45deg, #1a1a1a, #1a1a1a 14px, #262626 14px, #262626 16px)",
  borderImageSource:
    "repeating-linear-gradient(to bottom, #404040 0px, #404040 10px, transparent 10px, transparent 20px)",
};
const borderImageStyle = {
  borderStyle: "dashed" as const,
  borderImageSlice: 1,
};

function StripedPanel({
  className,
  borderSide,
  children,
}: {
  className: string;
  borderSide: "left" | "right";
  children?: React.ReactNode;
}) {
  const borderClass = borderSide === "right" ? "border-r" : "border-l";
  return (
    <div className={`relative ${className}`}>
      {/* Light mode – dashed border only on inner layer */}
      <div
        className={`absolute inset-0 dark:hidden ${borderClass} border-transparent`}
        style={{ ...lightStripes, ...borderImageStyle }}
      >
        {children}
      </div>
      {/* Dark mode */}
      <div
        className={`absolute inset-0 hidden dark:block ${borderClass} border-transparent`}
        style={{ ...darkStripes, ...borderImageStyle }}
      >
        {children}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="flex h-screen w-full">
      <StripedPanel className="h-full w-40 shrink-0" borderSide="right" />

      <div className="flex h-full w-full">
        <div className="flex hid den h-full w-1/2 flex-col items-start justify-end">
          <div className="flex w-fit flex-col gap-4 p-10">
            <div className="flex flex-col gap-1">
              <h1 className="text-[32px] leading-[38px] font-medium tracking-[-0.8px]">
                Build Better AI Interfaces
              </h1>
              <p className="w-[317px] text-base leading-6 font-normal text-[#737373]">
                Flexible, customizable components engineered for modern AI
                experiences.
              </p>
            </div>
            <Button
              className="w-fit rounded-full text-sm leading-6 font-normal"
              asChild
            >
              <Link href="/docs">Get Started</Link>
            </Button>
          </div>
        </div>

        <StripedPanel className="1/2 h-full w-1/2 full px-6" borderSide="left">
          <div className="flex px-6 h-full w-full flex-col items-center justify-between">
            <div className="flex h-14/51 w-full flex-col items-center justify-end rounded-b-[40px] border-x border-b border-[#E5E5E5] dark:bg-background dark:border-white/10 bg-white p-7"></div>

            <div className="flex h-4/51 w-full items-center justify-center gap-2">
              <Button className="w-fit cursor-pointer rounded-full bg-[#E5E5E5] dark:bg-[#404040] text-sm leading-6 font-normal text-[#171717] dark:text-white hover:bg-[#E5E5E5] gap-1">
                <ChatgptIcon className="size-4" />
                ChatGPT
              </Button>
              <Button className="w-fit cursor-pointer rounded-full bg-transparent dark:text-white text-sm leading-6 font-normal text-[#171717] hover:bg-[#E5E5E5] dark:hover:bg-[#404040] gap-1">
                <GeminiIcon className="size-4" />
                Gemini
              </Button>
              <Button className="w-fit cursor-pointer rounded-full bg-transparent dark:text-white text-sm leading-6 font-normal text-[#171717] hover:bg-[#E5E5E5] dark:hover:bg-[#404040] gap-1">
                <ClaudeIcon className="size-4" />
                Claude
              </Button>
            </div>

            <div className="h-33/51 w-full rounded-t-[40px] border-x border-t border-[#E5E5E5] dark:bg-background dark:border-white/10 bg-white"></div>
          </div>
        </StripedPanel>
      </div>
    </main>
  );
}
