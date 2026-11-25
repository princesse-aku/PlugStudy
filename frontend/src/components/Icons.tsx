import type { SVGProps } from "react";

function Icon({ children, size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number; className?: string };

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 12C5 6 19 6 22 12C19 18 5 18 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 12C5 6 19 6 22 12C19 18 5 18 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4L20 20" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9L12 15L18 9" />
  </Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8C8 5 16 5 16 8V11" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12L10 17L19 7" />
  </Icon>
);

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 11L12 4L21 11V20H15V14H9V20H3Z" />
  </Icon>
);

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 6C9 4 5 4 3 5V19C5 18 9 18 12 20C15 18 19 18 21 19V5C19 4 15 4 12 6Z" />
    <path d="M12 6V20" />
  </Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10H20M9 3V7M15 3V7" />
  </Icon>
);

export const BarsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 20V11M12 20V5M19 20V14" />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21C4 16 8 14 12 14C16 14 20 16 20 21" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5V19M5 12H19" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5L16 12L9 19" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 5L8 12L15 19" />
  </Icon>
);

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3H14L19 8V21H6Z" />
    <path d="M14 3V8H19" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16V5M7 10L12 5L17 10" />
    <path d="M4 17V20H20V17" />
  </Icon>
);

export const CircleCheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12L11 15L16 9" />
  </Icon>
);

/** Cercle à demi plein : état « En cours ». */
export const HalfCircleIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
    <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 1.5A4.5 4.5 0 0 1 6 10.5Z" fill="currentColor" />
  </svg>
);

export const MessageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 5H20V16H11L6 20V16H4Z" />
  </Icon>
);

export const FlagIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 21V4M5 5H17L14 9L17 13H5" />
  </Icon>
);

export const CrossIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6L18 18M18 6L6 18" />
  </Icon>
);

export const SendIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12H19M13 6L19 12L13 18" />
  </Icon>
);

export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 4H5V20H9M15 8L19 12L15 16M19 12H9" />
  </Icon>
);
