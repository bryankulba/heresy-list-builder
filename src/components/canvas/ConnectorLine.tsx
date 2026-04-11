import React from 'react';

interface Point {
  x: number;
  y: number;
}

interface ConnectorLineProps {
  from: Point;
  to: Point;
}

/** Renders a single bezier connector path inside the Canvas SVG overlay. */
export default function ConnectorLine({ from, to }: ConnectorLineProps) {
  const midY = (from.y + to.y) / 2;
  const d = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--cds-border-subtle-01)"
      strokeWidth={1}
      strokeDasharray="4 3"
      opacity={0.6}
    />
  );
}
