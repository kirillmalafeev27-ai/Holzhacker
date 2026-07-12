export const GERMAN_QUESTIONS = [
  { prompt: 'Der Baum ist ___.', options: ['hoch', 'hohe', 'hohen'], answer: 'hoch', topic: 'Wald' },
  { prompt: 'Ich nehme ___ Hammer.', options: ['den', 'dem', 'der'], answer: 'den', topic: 'Akkusativ' },
  { prompt: 'Wir bauen ___ Holz.', options: ['mit', 'ohne', 'gegen'], answer: 'mit', topic: 'Bauen' },
  { prompt: '___ das Tor!', options: ['Öffne', 'Öffnet', 'Öffnen'], answer: 'Öffne', topic: 'Imperativ' },
  { prompt: 'Der Goblin läuft ___ Burg.', options: ['zur', 'zum', 'bei'], answer: 'zur', topic: 'Richtung' },
  { prompt: 'Ich gebe ___ Wächter einen Stein.', options: ['dem', 'den', 'der'], answer: 'dem', topic: 'Dativ' },
  { prompt: 'Wir müssen die Mauer ___.', options: ['reparieren', 'repariert', 'Reparatur'], answer: 'reparieren', topic: 'Aktion' },
  { prompt: 'Wo ist die Axt? — Sie liegt ___ Baum.', options: ['am', 'auf', 'aus'], answer: 'am', topic: 'Ort' },
  { prompt: 'Das Gegenteil von „links“ ist ___.', options: ['rechts', 'oben', 'hinten'], answer: 'rechts', topic: 'Richtung' },
  { prompt: '___ schneller!', options: ['Lauf', 'Läufst', 'Laufen'], answer: 'Lauf', topic: 'Imperativ' },
  { prompt: 'Der Stein fliegt ___ das Katapult.', options: ['gegen', 'bei', 'von'], answer: 'gegen', topic: 'Bewegung' },
  { prompt: 'Ich trage ___ Holz.', options: ['das', 'dem', 'der'], answer: 'das', topic: 'Akkusativ' },
  { prompt: 'Die Burg braucht drei ___.', options: ['Bäume', 'Baum', 'Bäumen'], answer: 'Bäume', topic: 'Plural' },
  { prompt: 'Wir stehen ___ dem Turm.', options: ['auf', 'durch', 'für'], answer: 'auf', topic: 'Ort' },
  { prompt: 'Der Wächter schützt ___ Dorf.', options: ['das', 'dem', 'des'], answer: 'das', topic: 'Akkusativ' },
  { prompt: 'Die Katapulte sind ___ der Mauer.', options: ['vor', 'in', 'unter'], answer: 'vor', topic: 'Ort' },
  { prompt: '___ den Stein nach oben!', options: ['Wirf', 'Wirfst', 'Werfen'], answer: 'Wirf', topic: 'Imperativ' },
  { prompt: 'Der Weg führt ___ den Wald.', options: ['durch', 'mit', 'an'], answer: 'durch', topic: 'Richtung' },
  { prompt: 'Die Notiz liegt ___ Gras.', options: ['im', 'am', 'zum'], answer: 'im', topic: 'Ort' },
  { prompt: 'Wir sammeln sechs ___.', options: ['Notizen', 'Notiz', 'Notize'], answer: 'Notizen', topic: 'Plural' },
  { prompt: 'Der Spieler geht ___ dem Tor.', options: ['durch', 'aus', 'von'], answer: 'durch', topic: 'Richtung' },
  { prompt: 'Ich helfe ___ Freund.', options: ['dem', 'den', 'die'], answer: 'dem', topic: 'Dativ' },
  { prompt: 'Das Holz ist ___ als der Stein.', options: ['leichter', 'leicht', 'leichteste'], answer: 'leichter', topic: 'Vergleich' },
  { prompt: 'Wir ___ die Burg gemeinsam.', options: ['verteidigen', 'verteidigt', 'verteidigst'], answer: 'verteidigen', topic: 'Verb' },
];

function shuffledCopy(values, rng = Math.random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export class QuestionDeck {
  constructor(questions = GERMAN_QUESTIONS, rng = Math.random) {
    this.questions = questions;
    this.rng = rng;
    this.order = shuffledCopy(questions.map((_, index) => index), rng);
    this.cursor = 0;
    this.lastIndex = -1;
  }

  next() {
    if (this.cursor >= this.order.length) {
      this.order = shuffledCopy(this.questions.map((_, index) => index), this.rng);
      this.cursor = 0;
    }
    let index = this.order[this.cursor++];
    if (index === this.lastIndex && this.order.length > 1) {
      const replacementPosition = this.cursor % this.order.length;
      [index, this.order[replacementPosition]] = [this.order[replacementPosition], index];
    }
    this.lastIndex = index;
    const source = this.questions[index];
    return {
      ...source,
      options: shuffledCopy(source.options, this.rng),
    };
  }
}
