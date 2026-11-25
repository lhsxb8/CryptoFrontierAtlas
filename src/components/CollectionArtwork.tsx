import openQuestionsArtwork from '../assets/home/open-questions.webp';
import symmetricArtwork from '../assets/home/symmetric-cryptanalysis.webp';
import asymmetricArtwork from '../assets/home/asymmetric-cryptanalysis.webp';
import implementationArtwork from '../assets/home/implementation.webp';

const artwork = {
  questions: openQuestionsArtwork,
  analysis: symmetricArtwork,
  asymmetric: asymmetricArtwork,
  implementation: implementationArtwork,
};

/** Decorative collection illustrations, not research results or security claims. */
export default function CollectionArtwork({kind}: {kind: keyof typeof artwork}) {
  return <img className="atlas-collection-art" src={artwork[kind]}
    width={1200} height={800} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}
