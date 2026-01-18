/**
 * MiniChart - Lightweight SVG line/area chart for dashboard
 * No external dependencies, pure SVG for performance
 */

import { useMemo } from 'react';

export interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  showDots?: boolean;
  label?: string;
  valueFormatter?: (value: number) => string;
}

export function MiniChart({
  data,
  width = 200,
  height = 60,
  color = '#6366f1',
  fill = true,
  showDots = false,
  label,
  valueFormatter = (v) => v.toFixed(1),
}: MiniChartProps) {
  const { path, areaPath, points, currentVal } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', areaPath: '', points: [], minVal: 0, maxVal: 0, currentVal: 0 };
    }

    const padding = 4;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;

    const points = data.map((value, index) => {
      const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minVal) / range) * chartHeight;
      return { x, y, value };
    });

    // Line path
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    // Area path (for fill)
    const areaPath = fill
      ? `${path} L ${points[points.length - 1]?.x || 0} ${height - padding} L ${padding} ${height - padding} Z`
      : '';

    return {
      path,
      areaPath,
      points,
      minVal,
      maxVal,
      currentVal: data[data.length - 1] || 0,
    };
  }, [data, width, height, fill]);

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-white/40 text-sm"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="relative">
      {label && (
        <div className="absolute top-0 left-0 text-xs text-white/50">{label}</div>
      )}
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {fill && areaPath && (
          <path
            d={areaPath}
            fill={`url(#gradient-${color.replace('#', '')})`}
          />
        )}

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            className="opacity-70"
          />
        ))}

        {/* Current value dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        )}
      </svg>
      
      {/* Value label */}
      <div className="absolute bottom-0 right-0 text-right">
        <span className="text-lg font-bold text-white">{valueFormatter(currentVal)}</span>
      </div>
    </div>
  );
}

export default MiniChart;
