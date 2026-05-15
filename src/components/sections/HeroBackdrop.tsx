export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 start-[-8%] -z-10 h-[640px] w-[640px] opacity-40 blur-[100px] lg:-top-32 lg:start-[-4%] lg:h-[780px] lg:w-[780px]"
    >
      <svg
        viewBox="0 0 600 600"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <path
          d="M300 60c92 0 168 38 210 110 32 56 38 124 12 188-30 76-104 134-198 154-92 20-186-4-244-66-52-56-66-138-38-218 24-68 80-122 152-150 36-12 72-18 106-18z"
          fill="var(--brand-lavender)"
        />
      </svg>
    </div>
  );
}
