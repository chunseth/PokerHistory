# Poker History with GTO Analysis

A comprehensive poker hand history tracker with Game Theory Optimal (GTO) analysis capabilities.

## Features

### Hand Analysis
- Real-time GTO-based hand analysis
- Preflop range integration
- Dynamic postflop decision-making
- Balanced value-bet and bluff ratios
- Fold equity and pot odds calculations

### Components

#### HandAnalysis
The main component that provides GTO-based analysis of poker hands. It includes:
- Street-by-street analysis (preflop, flop, turn, river)
- Hand strength evaluation
- Equity calculations
- Pot odds analysis
- Action recommendations based on GTO principles

#### Poker Analysis Utilities
Core utility functions for poker hand analysis:
- `calculateHandStrength`: Evaluates the strength of a poker hand
- `calculateEquity`: Estimates hand equity against opponent ranges
- `calculatePotOdds`: Computes pot odds for decision making
- `getRecommendedAction`: Provides GTO-based action recommendations
- `evaluateHand`: Determines the rank of a poker hand
- `parseCard`: Converts card strings to structured data

## GTO Implementation

### Preflop Strategy
- Position-based opening ranges
- 3-bet and 4-bet ranges
- Defending ranges against different positions
- Balanced value and bluff frequencies

### Postflop Strategy
- Dynamic c-betting frequencies
- Turn and river bet sizing
- Balanced value-bet and bluff ratios
- Fold equity considerations
- Pot odds integration

### Hand Strength Evaluation
- Hand ranking system (royal flush to high card)
- Equity calculations against ranges
- Board texture analysis
- Draw completion probabilities

## Usage

```jsx
import { HandAnalysis } from './components/HandAnalysis';

// Example usage
<HandAnalysis
    handData={{
        holeCards: ['As', 'Ks'],
        communityCards: ['Qs', 'Js', 'Ts'],
        position: 'BTN',
        potSize: 100,
        betSize: 50,
        street: 'flop'
    }}
/>
```

## Testing

Run the test suite:
```bash
npm test
```

The test suite includes comprehensive tests for:
- Card parsing and validation
- Hand evaluation
- Hand strength calculations
- Equity calculations
- Pot odds computations
- GTO action recommendations

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

None suckers!
