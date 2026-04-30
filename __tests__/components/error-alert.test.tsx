import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

describe('ErrorAlert', () => {
  it('renders error message', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Falha ao carregar dados" />);
    expect(html).toContain('Falha ao carregar dados');
    expect(html).toContain('MuiAlert');
  });

  it('renders with error severity by default', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Error" />);
    expect(html).toContain('MuiAlert-colorError');
  });

  it('renders with warning severity when specified', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Warning" severity="warning" />);
    expect(html).toContain('MuiAlert-colorWarning');
  });

  it('renders with info severity when specified', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Info" severity="info" />);
    expect(html).toContain('MuiAlert-colorInfo');
  });

  it('renders with success severity when specified', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Success" severity="success" />);
    expect(html).toContain('MuiAlert-colorSuccess');
  });

  it('renders action text when provided', () => {
    const html = renderToStaticMarkup(
      <ErrorAlert message="Erro de sessão" action="Faça login novamente" />
    );
    expect(html).toContain('Erro de sessão');
    expect(html).toContain('Próximo passo');
    expect(html).toContain('Faça login novamente');
  });

  it('does not render action text when not provided', () => {
    const html = renderToStaticMarkup(<ErrorAlert message="Simple error" />);
    expect(html).not.toContain('Próximo passo');
  });
});
