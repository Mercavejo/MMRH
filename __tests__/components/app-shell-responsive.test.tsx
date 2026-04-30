import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const navigationState = vi.hoisted(() => ({
  pathname: '/rh',
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    push: navigationState.push,
    refresh: navigationState.refresh,
  }),
}));

import { AppShell } from '@/components/layout/AppShell';

describe('AppShell responsive controls', () => {
  it('renders both mobile and desktop view-switch affordances when access is enabled', () => {
    const html = renderToStaticMarkup(
      <AppShell userRole="rh" userName="Victor" hasAccessToBoth>
        <span>Conteúdo</span>
      </AppShell>
    );

    expect(html).toContain('Alternar para Visão Colaborador');
    expect(html).toContain('Visão Colaborador');
  });
});
