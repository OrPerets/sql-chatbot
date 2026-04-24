import { notFound } from 'next/navigation';

import InteractiveLearningRoot from './InteractiveLearningRoot';

const featureEnabled = process.env.NEXT_PUBLIC_INTERACTIVE_LEARNING === '1';

const InteractiveLearningPage = () => {
  if (!featureEnabled) {
    notFound();
  }

  return <InteractiveLearningRoot />;
};

export default InteractiveLearningPage;
