import React from 'react';
import { render } from '@testing-library/react-native';
import CompassDial from '../CompassDial';

describe('CompassDial', () => {
  const angleMap = { 9: 5, 7: 20, 5: 40, 3: 60, 1: 80 };

  it('renders "Straight" when direction is null', () => {
    const { getByText } = render(<CompassDial />);
    expect(getByText('Straight')).toBeTruthy();
  });

  it('renders "L 3" when direction=L and detectedSev=3', () => {
    const { getByText } = render(
      <CompassDial angleDeg={60} direction="L" angleMap={angleMap} detectedSev="3" />,
    );
    expect(getByText('L  3')).toBeTruthy();
  });

  it('renders "R --" when direction=R and no detectedSev', () => {
    const { getByText } = render(<CompassDial angleDeg={30} direction="R" angleMap={angleMap} />);
    expect(getByText('R  --')).toBeTruthy();
  });

  it('renders severity labels for each angleMap entry', () => {
    const { getAllByText } = render(<CompassDial angleMap={angleMap} />);
    // Each non-zero angle severity appears twice (L and R side)
    for (const sev of ['9', '7', '5', '3', '1']) {
      const nodes = getAllByText(sev);
      expect(nodes.length).toBe(2); // L side + R side
    }
  });

  it('matches snapshot with default props', () => {
    const tree = render(<CompassDial />);
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('matches snapshot with full props', () => {
    const tree = render(
      <CompassDial angleDeg={45} direction="L" angleMap={angleMap} detectedSev="5" />,
    );
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
