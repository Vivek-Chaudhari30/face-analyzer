import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

type Variant = "solid" | "outline" | "ghost" | "gold" | "light";

const base =
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-7 py-3.5 text-[0.78rem] font-medium uppercase tracking-[0.18em] transition-all duration-500 ease-luxe disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  solid: "bg-charcoal text-ivory hover:bg-charcoal-soft hover:shadow-[0_14px_30px_-12px_rgba(38,35,31,0.55)]",
  gold: "bg-gold text-ivory hover:bg-gold-light hover:shadow-[0_14px_30px_-12px_rgba(176,141,87,0.7)]",
  outline: "border border-charcoal/30 text-charcoal hover:border-charcoal hover:bg-charcoal hover:text-ivory",
  ghost: "text-charcoal hover:text-gold px-2",
  light: "bg-ivory text-charcoal hover:bg-champagne",
};

interface CommonProps {
  variant?: Variant;
  children: ReactNode;
  arrow?: boolean;
  className?: string;
}

type LinkProps = CommonProps & { to: string; onClick?: () => void };
type BtnProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { to?: undefined };

export function Button(props: LinkProps | BtnProps) {
  const { variant = "solid", children, arrow, className = "" } = props;
  const cls = `${base} ${variants[variant]} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      {arrow && (
        <ArrowUpRight
          size={15}
          aria-hidden="true"
          className="transition-transform duration-500 ease-luxe group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      )}
    </>
  );
  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={cls} onClick={props.onClick}>
        {inner}
      </Link>
    );
  }
  const { variant: _v, children: _c, arrow: _a, className: _cn, to: _t, ...rest } = props as BtnProps;
  void _v; void _c; void _a; void _cn; void _t;
  return (
    <button type="button" {...rest} className={cls}>
      {inner}
    </button>
  );
}
