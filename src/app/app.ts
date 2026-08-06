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
  description?: string[];
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

  protected readonly djPhotos = [
    { src: '/images/k wedding dj.jpg', alt: 'Lakeland Cabaret DJ performing at a wedding' },
    {
      src: '/images/close christmas backdrop.png',
      alt: 'Lakeland Cabaret DJ at a Christmas event',
    },
    {
      src: '/images/mall christmas far.jpg',
      alt: 'Lakeland Cabaret DJ performing at a mall Christmas event',
    },
    { src: '/images/photography.webp', alt: 'Lakeland Cabaret DJ performing at a holiday event' },
    {
      src: '/images/whoville tight.png',
      alt: 'Lakeland Cabaret DJ performing at a Whoville event',
    },
    { src: '/images/dance floor dj.jpg', alt: 'Lakeland Cabaret DJ beside a dance floor' },
    { src: '/images/dj pov.jpg', alt: 'A DJ booth view of a Lakeland Cabaret event' },
    { src: '/images/suit dj.jpg', alt: 'Lakeland Cabaret DJ performing in a suit' },
    { src: '/images/mcordy dj.jpg', alt: 'Lakeland Cabaret DJ performing at an event' },
    {
      src: '/images/bouncy house dj close.jpg',
      alt: 'Lakeland Cabaret DJ performing near a bouncy house',
    },
  ];

  protected readonly firePhotos = [
    { src: '/images/mccordy whip.jpg', alt: 'Lakeland Cabaret fire whip performance' },
    { src: '/images/ryan ropedart.jpg', alt: 'Ryan performing with a fire rope dart' },
    { src: '/images/mcordy doubles wide.jpg', alt: 'McCordy performing with double fire props' },
    {
      src: '/images/kiss cover concert performance.jpg',
      alt: 'Lakeland Cabaret performing fire at a concert',
    },
    { src: '/images/mcordy staff.jpg', alt: 'McCordy performing with a fire staff' },
    { src: '/images/yard wand.jpg', alt: 'Lakeland Cabaret fire wand performance' },
    { src: '/images/mcordy eating.jpg', alt: 'McCordy performing a fire-eating act' },
    { src: '/images/mcordy wand.jpg', alt: 'McCordy performing with a fire wand' },
  ];

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
      image: '/images/suitable officiant.jpg',
      imageAlt: 'A Lakeland Cabaret officiant standing with a newly married couple',
      detail: 'Consultation available',
    },
  ];

  protected readonly pricing: PriceGroup[] = [
    {
      title: 'Live Cabaret',
      description: [
        'We specialize in fire performance, encompassing a wide variety of flaming objects twirled, tossed, and manipulated to music. We perform with more than a dozen unique fire props and have trained with many of the world’s best performers. The listed fire-performance times are the minimum duration we will burn. A typical performance lasts about an hour, including time to refuel between props and a brief five-minute intermission.',
      ],
      items: [
        {
          name: 'Event fire performance',
          price: '$300',
          note: '1+ performers + fire safety · 30-minute minimum',
        },
        {
          name: 'Event flow performance',
          price: '$300',
          note: '2 performers · no fire · 2 hours',
        },
        {
          name: 'Wedding fire performance',
          price: '$500',
          note: '2+ performers + fire safety · 30-minute minimum',
        },
      ],
    },
    {
      title: 'Music',
      description: [
        'Our DJs are ready to energize your event. Parties, holiday events, grand openings, weddings, and special occasions of every kind are better with music. We carefully curate the music and atmosphere for your occasion and are happy to collaborate on set-list details, including requested tracks and a blacklist of songs or artists you do not want to hear.',
        'Every wedding includes music for the prelude, ceremony, dinner, and dancing. Dance sets are mixed live, and we take requests according to the host’s preferences.',
      ],
      items: [
        { name: 'Holiday events', price: '$150–$300', note: '3–6 hours' },
        { name: 'Parties & festivals', price: '$300–$600', note: '3–6 hours' },
        { name: 'Award shows', price: '$300–$600', note: '3–6 hours' },
        { name: 'Wedding package', price: '$2,000', note: 'up to 6 hours' },
      ],
    },
    {
      title: 'Photo & video',
      description: [
        'Our photographers and videographers bring the professionalism and skill needed to make your event shine for years to come. Our well-shot, high-resolution imagery ensures you have plenty of memories to share from your special occasion. Need extra coverage? Add a second photographer or videographer at half price.',
      ],
      items: [
        { name: 'Student or graduation session', price: '$350', note: '1 hour' },
        { name: 'Family session', price: '$350–$600', note: '1–2 hours' },
        { name: 'Parade or sports coverage', price: '$600', note: '2 hours' },
        { name: 'Event coverage', price: '$600–$1,200', note: '2–4 hours' },
        { name: 'Full wedding coverage', price: '$1,500', note: 'up to 6 hours' },
      ],
    },
    {
      title: 'Wedding officiant',
      description: [
        'Our ordained officiants provide the professional, soulful touch that brings your ceremony together. We’re glad to collaborate on your wedding plans, vows, and more. Whether you need help finding the right words, someone to solemnize the marriage and pronounce you married, or something in between, we’d be honored to bring our experience to your occasion.',
      ],
      items: [
        { name: 'Consultation', price: '$100', note: 'Planning, vows & ceremony prep' },
        {
          name: 'Ceremony officiation',
          price: '$200',
          note: 'Your ceremony, led by our officiant',
        },
        {
          name: 'Ceremony package',
          price: '$250',
          note: 'Full preparation, officiation & added support',
        },
      ],
    },
  ];

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
