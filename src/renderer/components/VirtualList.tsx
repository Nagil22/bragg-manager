import React, { useRef, useState, useEffect, useCallback, memo } from 'react';

interface Props<T> {
  items:              T[];
  itemHeight:         number;
  height:             number;
  overscan?:          number;
  renderItem:         (item: T, index: number) => React.ReactNode;
  keyExtractor:       (item: T, index: number) => string;
  onScroll?:          (scrollTop: number) => void;
  scrollToTopSignal?: number; // increment this value from outside to trigger scroll-to-top
}

// Browsers degrade severely doing layout on very tall elements (18M+ px = 52s layout time).
// Cap the inner scrollable div and map scroll position proportionally.
const MAX_INNER_HEIGHT = 5_000_000;

function VirtualList<T>({
  items, itemHeight, height, overscan = 5,
  renderItem, keyExtractor, onScroll: onScrollProp, scrollToTopSignal,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback(() => {
    const top = containerRef.current?.scrollTop ?? 0;
    setScrollTop(top);
    onScrollProp?.(top);
  }, [onScrollProp]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Scroll to top when signal increments
  useEffect(() => {
    if (scrollToTopSignal !== undefined && scrollToTopSignal > 0) {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTopSignal]);

  const totalHeight = items.length * itemHeight;
  const innerHeight = Math.min(totalHeight, MAX_INNER_HEIGHT);
  const clamped     = totalHeight > MAX_INNER_HEIGHT;

  // Map real scrollTop → virtual scrollTop when height is clamped
  const virtualScrollTop = clamped
    ? (scrollTop / innerHeight) * totalHeight
    : scrollTop;

  const startIndex   = Math.max(0, Math.floor(virtualScrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
  const endIndex     = Math.min(items.length - 1, startIndex + visibleCount);

  const visibleItems: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    // In clamped mode position proportionally; otherwise pixel-accurate
    const top = clamped
      ? Math.round((i * itemHeight / totalHeight) * innerHeight)
      : i * itemHeight;
    visibleItems.push(
      <div
        key={keyExtractor(items[i], i)}
        style={{ position: 'absolute', top, left: 0, right: 0, height: itemHeight }}
      >
        {renderItem(items[i], i)}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height, overflowY: 'auto', position: 'relative' }}>
      <div style={{ height: innerHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

export default memo(VirtualList) as typeof VirtualList;
