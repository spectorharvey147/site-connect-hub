import { getInitials } from "@/utils/format";

export function UserAvatar({
  name,
  src,
  className = "h-10 w-10",
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light font-bold text-brand-blue ${className}`}
    >
      {src ? (
        <img src={src} alt={`${name} profile`} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
