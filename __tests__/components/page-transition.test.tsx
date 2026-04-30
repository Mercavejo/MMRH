import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockMotionDivProps = React.ComponentProps<'div'> & {
  initial?: unknown;
  animate?: unknown;
  transition?: unknown;
};
type MockAnimatePresenceProps = {
  children: React.ReactNode;
  mode?: string;
};

const motionDivCalls = vi.hoisted((): MockMotionDivProps[] => []);
const animatePresenceCalls = vi.hoisted((): MockAnimatePresenceProps[] => []);

// Mock framer-motion to avoid SSR issues in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children, mode }: MockAnimatePresenceProps) => {
    animatePresenceCalls.push({ children, mode });
    return <>{children}</>;
  },
  motion: {
    div: ({ children, ...props }: MockMotionDivProps) => {
      motionDivCalls.push(props);
      const { initial, animate, transition, ...divProps } = props;
      void initial;
      void animate;
      void transition;

      return <div data-testid="motion-div" {...divProps}>{children}</div>;
    },
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/rh',
}));

// Import after mocks
import { PageTransition } from '@/components/ui/PageTransition';

describe('PageTransition', () => {
  beforeEach(() => {
    motionDivCalls.length = 0;
    animatePresenceCalls.length = 0;
  });

  it('renders children content', () => {
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>Test Content</p>
      </PageTransition>
    );
    expect(html).toContain('Test Content');
  });

  it('renders as a div wrapper', () => {
    const html = renderToStaticMarkup(
      <PageTransition>
        <span>Wrapped</span>
      </PageTransition>
    );
    expect(html).toContain('<div');
    expect(html).toContain('Wrapped');
  });

  it('keeps the fade-in animation contract', () => {
    renderToStaticMarkup(
      <PageTransition>
        <span>Animated</span>
      </PageTransition>
    );
    expect(animatePresenceCalls[0]?.mode).toBe('wait');
    expect(motionDivCalls[0]?.initial).toEqual({ opacity: 0 });
    expect(motionDivCalls[0]?.animate).toEqual({ opacity: 1 });
    expect(motionDivCalls[0]?.transition).toEqual({ duration: 0.3, ease: 'easeOut' });
  });
});
