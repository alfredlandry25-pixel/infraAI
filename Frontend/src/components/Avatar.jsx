export function Avatar({ src, name, size = "h-9 w-9", textSize = "text-sm" }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name || "User"}
        className={`${size} rounded-full object-cover border border-border shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground font-semibold ${textSize} shrink-0`}
    >
      {initial}
    </div>
  );
}