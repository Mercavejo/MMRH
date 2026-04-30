import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusChip } from '@/components/ui/StatusChip';
import { tokens } from '@/lib/theme/tokens';

describe('StatusChip', () => {
  it('renders with success status label', () => {
    const html = renderToStaticMarkup(<StatusChip status="success" label="Sucesso" />);
    expect(html).toContain('Sucesso');
    expect(html).toContain(tokens.statusColors.success);
  });

  it('renders with warning status label', () => {
    const html = renderToStaticMarkup(<StatusChip status="warning" label="Atenção" />);
    expect(html).toContain('Atenção');
    expect(html).toContain(tokens.statusColors.warning);
  });

  it('renders with error status label', () => {
    const html = renderToStaticMarkup(<StatusChip status="error" label="Erro" />);
    expect(html).toContain('Erro');
    expect(html).toContain(tokens.statusColors.error);
  });

  it('renders with processing status label', () => {
    const html = renderToStaticMarkup(<StatusChip status="processing" label="Processando" />);
    expect(html).toContain('Processando');
    expect(html).toContain(tokens.statusColors.processing);
  });

  it('renders with pending status using gray color, not orange', () => {
    const html = renderToStaticMarkup(<StatusChip status="pending" label="Pendente" />);
    expect(html).toContain('Pendente');
    expect(html).toContain(tokens.statusColors.pending);
    // Assert pending is gray, NOT the orange from colors.pending
    expect(tokens.statusColors.pending).toBe('#94a3b8');
    expect(tokens.statusColors.pending).not.toBe(tokens.colors.pending);
  });

  it('renders with neutral status using gray color', () => {
    const html = renderToStaticMarkup(<StatusChip status="neutral" label="Neutro" />);
    expect(html).toContain('Neutro');
    expect(html).toContain(tokens.statusColors.neutral);
  });

  it('falls back to neutral for unknown status strings', () => {
    const html = renderToStaticMarkup(<StatusChip status="archived" label="Arquivado" />);
    expect(html).toContain('Arquivado');
    expect(html).toContain(tokens.statusColors.neutral);
  });

  it('keeps valid sx array input without dropping semantic color', () => {
    const html = renderToStaticMarkup(
      <StatusChip status="success" label="Com sx" sx={[{ borderRadius: 1 }]} />
    );
    expect(html).toContain('Com sx');
    expect(html).toContain(tokens.statusColors.success);
  });

  it('verifies all required status keys exist in statusColors', () => {
    const requiredKeys = ['success', 'warning', 'error', 'processing', 'pending', 'neutral'] as const;
    for (const key of requiredKeys) {
      expect(tokens.statusColors[key]).toBeDefined();
      expect(typeof tokens.statusColors[key]).toBe('string');
      expect(tokens.statusColors[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('renders MUI Chip markup', () => {
    const html = renderToStaticMarkup(<StatusChip status="success" label="Test" />);
    expect(html).toContain('MuiChip');
  });
});
