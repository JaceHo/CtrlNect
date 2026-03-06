/** Feishu (Lark) brand icon – simplified SVG mark. */
export function FeishuIcon({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Feishu"
    >
      {/* Stylised feather / wing shape approximating the Feishu logo */}
      <path
        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
        fill="#00B2B2"
      />
      <path
        d="M16.5 7.5C14.5 9 12.5 10 10 10.5c1 1.5 2.5 3 5 4-2 .5-4 .5-6-.5-1-2-1-4.5.5-6.5C11.5 6 14.5 6 16.5 7.5z"
        fill="white"
      />
      <path
        d="M8 14.5c.5 1.5 2 2.5 3.5 3-1 .5-2.5.5-3.5-.5C7 16 7.5 15 8 14.5z"
        fill="white"
        opacity="0.8"
      />
    </svg>
  );
}
