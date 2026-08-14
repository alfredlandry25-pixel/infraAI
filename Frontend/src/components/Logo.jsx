import logoImg from "@/assets/infraai-logo.png";

export function Logo({ className = "h-9" }) {
  return <img src={logoImg} alt="infraAI" className={`${className} w-auto`} />;
}
