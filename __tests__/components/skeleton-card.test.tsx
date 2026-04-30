import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

describe('SkeletonCard', () => {
  it('renders summary variant by default', () => {
    const html = renderToStaticMarkup(<SkeletonCard />);
    expect(html).toContain('MuiSkeleton');
    expect(html).toContain('MuiPaper');
  });

  it('renders summary variant with wave animation', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="summary" />);
    expect(html).toContain('MuiSkeleton-wave');
  });

  it('renders detail variant with wave animation', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="detail" />);
    expect(html).toContain('MuiSkeleton-wave');
  });

  it('summary variant contains circular skeleton for icon placeholder', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="summary" />);
    expect(html).toContain('MuiSkeleton-circular');
  });

  it('detail variant contains rectangular skeleton for content area', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="detail" />);
    expect(html).toContain('MuiSkeleton-rectangular');
  });

  it('detail variant does not contain circular skeleton', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="detail" />);
    expect(html).not.toContain('MuiSkeleton-circular');
  });

  it('summary variant does not contain rectangular skeleton', () => {
    const html = renderToStaticMarkup(<SkeletonCard variant="summary" />);
    expect(html).not.toContain('MuiSkeleton-rectangular');
  });
});
