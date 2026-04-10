# Rhythm Trainer

A high-precision rhythm training application built with React, TypeScript, and the Web Audio API.

## Features

- **High Precision Timing**: Uses `requestAnimationFrame` and the Web Audio API for millisecond-accurate feedback.
- **Multiple Visual Modes**:
  - **Pills**: Clean, modern indicator for early/late hits.
  - **Circles**: Rhythmic shrinking circle that overlaps at the beat.
  - **Bar**: Linear progress bar with a central target.
- **Detailed Analytics**:
  - Accuracy percentage.
  - Average error in milliseconds.
  - **Timing Tendency**: Visual breakdown of early vs. late hits.
- **Customizable Sessions**:
  - Adjustable BPM (Checkpoints per minute).
  - Configurable session duration.
  - Adjustable difficulty (Green/Orange thresholds).
- **Mobile Optimized**: Fully responsive with touch-friendly controls and mobile audio support.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/rhythm-trainer.git
   cd rhythm-trainer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist/` folder, ready to be hosted on any static web server (GitHub Pages, Vercel, Netlify, etc.).

## Deployment to GitHub Pages

This project includes a GitHub Actions workflow for automatic deployment.

1. Push your code to a GitHub repository.
2. Go to **Settings > Pages** in your repository.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. The site will automatically build and deploy whenever you push to the `main` branch.

## License

This project is licensed under the Apache-2.0 License.
