import React from 'react';
import './VillainRangeHeatmap.css';

// Helper to build canonical key for grid position
const canonicalKey = (r1, r2, suited) => {
  if (r1 === r2) return r1 + r2; // pocket pair
  const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
  // Ensure high→low order
  const highFirst = ranks.indexOf(r1) < ranks.indexOf(r2);
  const first = highFirst ? r1 : r2;
  const second = highFirst ? r2 : r1;
  return first + second + (suited ? 's' : 'o');
};

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

export default function VillainRangeHeatmap({ foldRange = [], callRange = [], raiseRange = [] }) {
  // Build lookup map
  const status = {};
  foldRange.forEach(k => { status[k] = 'fold'; });
  callRange.forEach(k => { status[k] = 'call'; });
  raiseRange.forEach(k => { status[k] = 'raise'; });

  return (
    <div className="heatmap-container">
      <table className="heatmap-table">
        <tbody>
          {RANKS.map((r1, rowIdx) => (
            <tr key={r1}>
              {RANKS.map((r2, colIdx) => {
                const suited = colIdx < rowIdx; // lower triangle off-suit? Actually typical: upper triangle suited? We'll use this mapping: upper (row<col) suited.
                const key = canonicalKey(r1, r2, rowIdx < colIdx /* upper triangle */);
                const cls = status[key] || 'empty';
                return (
                  <td key={r1 + r2} className={`cell ${cls}`}>{key}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 