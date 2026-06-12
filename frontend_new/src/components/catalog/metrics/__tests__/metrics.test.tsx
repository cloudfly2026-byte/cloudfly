// Unit tests for Metrics Components (CLOUD-328)
// Tests for VisitsChart, OriginsChart, TopPagesTable, and BounceRateCard

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock Recharts to avoid SVG rendering issues in tests
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children, width, height }: any) => (
      <div data-testid="responsive-container" style={{ width: width || '100%', height: height || 300 }}>
        {children}
      </div>
    ),
  };
});

import VisitsChart from '../VisitsChart';
import OriginsChart from '../OriginsChart';
import TopPagesTable from '../TopPagesTable';
import BounceRateCard from '../BounceRateCard';
import {
  demoVisitsByYear,
  demoOrigins,
  demoTopPages,
  demoBounceRate,
} from '@/data/demoMetrics';

describe('VisitsChart', () => {
  it('should render the card with title "Visitas por Año"', () => {
    render(<VisitsChart />);
    expect(screen.getByText('Visitas por Año')).toBeInTheDocument();
  });

  it('should render a responsive container for the chart', () => {
    render(<VisitsChart />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = render(<VisitsChart />);
    expect(container).toBeInTheDocument();
  });
});

describe('OriginsChart', () => {
  it('should render the card with title "Orígenes de Tráfico"', () => {
    render(<OriginsChart />);
    expect(screen.getByText('Orígenes de Tráfico')).toBeInTheDocument();
  });

  it('should render a responsive container for the chart', () => {
    render(<OriginsChart />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = render(<OriginsChart />);
    expect(container).toBeInTheDocument();
  });
});

describe('TopPagesTable', () => {
  it('should render the card with title "Páginas Más Vistas"', () => {
    render(<TopPagesTable />);
    expect(screen.getByText('Páginas Más Vistas')).toBeInTheDocument();
  });

  it('should render all top pages from demo data', () => {
    render(<TopPagesTable />);
    demoTopPages.forEach((page) => {
      expect(screen.getByText(page.page)).toBeInTheDocument();
    });
  });

  it('should render view counts formatted with locale', () => {
    render(<TopPagesTable />);
    demoTopPages.forEach((page) => {
      expect(screen.getByText(page.views.toLocaleString())).toBeInTheDocument();
    });
  });

  it('should render table headers', () => {
    render(<TopPagesTable />);
    expect(screen.getByText('Página')).toBeInTheDocument();
    expect(screen.getByText('Vistas')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = render(<TopPagesTable />);
    expect(container).toBeInTheDocument();
  });
});

describe('BounceRateCard', () => {
  it('should render the card with title "Tasa de Rebote"', () => {
    render(<BounceRateCard />);
    expect(screen.getByText('Tasa de Rebote')).toBeInTheDocument();
  });

  it('should render the bounce rate value', () => {
    render(<BounceRateCard />);
    expect(screen.getByText(`${demoBounceRate}%`)).toBeInTheDocument();
  });

  it('should render the subtitle "Promedio mensual"', () => {
    render(<BounceRateCard />);
    expect(screen.getByText('Promedio mensual')).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    const { container } = render(<BounceRateCard />);
    expect(container).toBeInTheDocument();
  });
});

describe('demoMetrics data', () => {
  it('should have 5 years of visit data', () => {
    expect(demoVisitsByYear).toHaveLength(5);
  });

  it('should have 5 origin sources', () => {
    expect(demoOrigins).toHaveLength(5);
  });

  it('should have 5 top pages', () => {
    expect(demoTopPages).toHaveLength(5);
  });

  it('should have a bounce rate of 32.5', () => {
    expect(demoBounceRate).toBe(32.5);
  });

  it('should have origins that sum to 100', () => {
    const total = demoOrigins.reduce((sum, o) => sum + o.value, 0);
    expect(total).toBe(100);
  });
});
