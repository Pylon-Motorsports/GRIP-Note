import React from 'react';
import { render } from '@testing-library/react-native';
import GpsOdoBar from '../GpsOdoBar';

// Mock the hook — default: not ready
const mockUseGpsOdo = jest.fn();
jest.mock('../../hooks/useGpsOdo', () => ({
  useGpsOdo: (...args) => mockUseGpsOdo(...args),
}));

describe('GpsOdoBar', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns null when GPS is not ready', () => {
    mockUseGpsOdo.mockReturnValue({ totalM: 0, lapM: 0, resetLap: jest.fn(), ready: false });
    const { toJSON } = render(<GpsOdoBar />);
    expect(toJSON()).toBeNull();
  });

  it('renders TOTAL and LAP labels when ready', () => {
    mockUseGpsOdo.mockReturnValue({ totalM: 0, lapM: 0, resetLap: jest.fn(), ready: true });
    const { getByText } = render(<GpsOdoBar />);
    expect(getByText('TOTAL')).toBeTruthy();
    expect(getByText(/LAP/)).toBeTruthy();
  });

  it('displays formatted metre distances', () => {
    mockUseGpsOdo.mockReturnValue({ totalM: 500, lapM: 250, resetLap: jest.fn(), ready: true });
    const { getByText } = render(<GpsOdoBar />);
    expect(getByText('500 m')).toBeTruthy();
    expect(getByText('250 m')).toBeTruthy();
  });

  it('displays km for distances >= 1000m', () => {
    mockUseGpsOdo.mockReturnValue({ totalM: 2500, lapM: 1234, resetLap: jest.fn(), ready: true });
    const { getByText } = render(<GpsOdoBar />);
    expect(getByText('2.50 km')).toBeTruthy();
    expect(getByText('1.23 km')).toBeTruthy();
  });
});
