import { notFound } from 'next/navigation';
import VisualizerRoot from './VisualizerRoot';

const featureEnabled = process.env.NEXT_PUBLIC_QUERY_VISUALIZER === '1';

const VisualizerPage = () => {
  if (!featureEnabled) {
    notFound();
  }

  return <VisualizerRoot />;
};

export default VisualizerPage;
