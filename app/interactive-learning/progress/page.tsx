import { notFound } from 'next/navigation';

import InteractiveLearningProgressRoot from './InteractiveLearningProgressRoot';

const featureEnabled = process.env.NEXT_PUBLIC_INTERACTIVE_LEARNING === '1';

const InteractiveLearningProgressPage = () => {
  if (!featureEnabled) {
    notFound();
  }

  return <InteractiveLearningProgressRoot />;
};

export default InteractiveLearningProgressPage;
