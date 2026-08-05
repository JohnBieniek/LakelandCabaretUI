import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

interface Service {
  title: string;
  eyebrow: string;
  description: string;
  image: string;
  imageAlt: string;
  detail: string;
}

interface PriceGroup {
  title: string;
  items: { name: string; price: string; note?: string }[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly menuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly services: Service[] = [
    {
      title: 'Music & DJ',
      eyebrow: 'Set the tone',
      description:
        'Thoughtful music for weddings, holidays, graduations, festivals, and every celebration in between.',
      image: '/images/photography.webp',
      imageAlt: 'Lakeland Cabaret DJ performing at a holiday event',
      detail: 'Custom playlists available',
    },
    {
      title: 'Fire Performance',
      eyebrow: 'Light up the night',
      description:
        'A bold, unforgettable spectacle featuring fire poi, fans, staffs, rope dart, sword, torches, and more.',
      image: '/images/wedding.webp',
      imageAlt: 'Lakeland Cabaret fire performers in theatrical masks',
      detail: 'Indoor and outdoor options',
    },
    {
      title: 'Photo & Video',
      eyebrow: 'Keep the moment',
      description:
        'Natural, story-led photography and videography for families, graduates, events, and once-in-a-lifetime days.',
      image: '/images/portrait.webp',
      imageAlt: 'A Lakeland Cabaret photographer working beside a stream',
      detail: 'Flexible session lengths',
    },
    {
      title: 'Wedding Officiant',
      eyebrow: 'Make it official',
      description:
        'A warm, personal ceremony shaped around your story, your people, and the kind of day you want to remember.',
      image: '/images/officiant.webp',
      imageAlt: 'A wedding ceremony led by a Lakeland Cabaret officiant',
      detail: 'Consultation available',
    },
  ];

  protected readonly pricing: PriceGroup[] = [
    {
      title: 'Live Cabaret',
      items: [
        { name: 'Event fire performance', price: '$300', note: '30 minutes' },
        { name: 'Event flow performance', price: '$300', note: '2 hours' },
        { name: 'Wedding fire performance', price: '$500', note: '30 minutes' },
      ],
    },
    {
      title: 'Music',
      items: [
        { name: 'Holiday events', price: '$200', note: 'up to 4 hours' },
        { name: 'Parties & festivals', price: '$400', note: 'up to 4 hours' },
        { name: 'Award shows', price: '$400', note: 'up to 4 hours' },
        { name: 'Wedding package', price: '$2,000', note: 'up to 6 hours' },
      ],
    },
    {
      title: 'Photo & video',
      items: [
        { name: 'Student or graduation session', price: '$350', note: '1 hour' },
        { name: 'Family session', price: '$350–$600', note: '1–2 hours' },
        { name: 'Parade or sports coverage', price: '$600', note: '2 hours' },
        { name: 'Event coverage', price: '$1,200', note: 'up to 4 hours' },
        { name: 'Full wedding coverage', price: '$1,500', note: 'up to 6 hours' },
      ],
    },
    {
      title: 'Wedding officiant',
      items: [
        { name: 'Consultation', price: '$100' },
        { name: 'Ceremony officiation', price: '$200' },
        { name: 'Ceremony package', price: '$250' },
      ],
    },
  ];

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
