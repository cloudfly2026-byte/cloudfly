import React from 'react';
import { render, screen } from '@testing-library/react';
import TiendaLayout from './layout';

describe('TiendaLayout', () => {
  it('renders children inside a main element', () => {
    render(
      <TiendaLayout>
        <div data-testid="child">Test Child</div>
      </TiendaLayout>
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('child'));
  });

  it('applies correct minHeight style', () => {
    render(
      <TiendaLayout>
        <div>Test</div>
      </TiendaLayout>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveStyle({ minHeight: 'calc(100vh - 64px)' });
  });
});
