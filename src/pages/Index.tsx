import { BinauralWorkstation } from '@/components/binaural/BinauralWorkstation';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>iBinaural | Beat Lab - Create Custom Binaural Beats</title>
        <meta 
          name="description" 
          content="Create and customize binaural beats with our intuitive DAW-style sequencer. Design meditation sessions, focus tracks, and brainwave entrainment audio."
        />
      </Helmet>
      <BinauralWorkstation />
    </>
  );
};

export default Index;
