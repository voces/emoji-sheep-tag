type UncheckedIconProps = {
  size?: number;
  color?: string;
  className?: string;
};

export const UncheckedIcon = ({
  size = 16,
  color = "currentColor",
  className,
}: UncheckedIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="-5 0 21.875 20.187"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      className="box"
      d="M -4.999397,20.187446 V 1.7489361 H 13.464785 V 20.187446 Z M 11.152388,4.062 H -2.688 v 13.844383 h 13.840388 z"
      fill={color}
    />
  </svg>
);
