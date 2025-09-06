export const CheckedIcon = ({
  size = 16,
  color = "currentColor",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="-5 0 21.875 20.187"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      className="box"
      d="m 11.156,14.031 2.313,-3.313 v 9.469 H -5 V 1.749 H 9.875 L 8.281,4.062 H -2.688 v 13.813 l 13.844,0.031 z"
      fill={color}
    />
    <path
      className="tick"
      d="M 13.219,0 5.844,10.656 0.688,6.843 -1.906,10.437 6.844,17.125 16.875,2.719 Z"
      fill={color}
    />
  </svg>
);
