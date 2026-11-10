interface MiniSparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
}

export default function MiniSparkline({
  values,
  width = 80,
  height = 28,
  color = "hsl(var(--primary))",
  showDot = true,
}: MiniSparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 3;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const lastPoint = points[points.length - 1].split(",").map(Number);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}
