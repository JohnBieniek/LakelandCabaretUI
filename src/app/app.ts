import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import businessContent from '../content/business.json';
import page from '../content/page.json';
import serviceContent from '../content/services.json';
import pricingContent from '../content/pricing.json';
import photos from '../content/photos.json';
import staffContent from '../content/staff.json';
import testimonialContent from '../content/testimonials.json';
import faqContent from '../content/faqs.json';
import announcementContent from '../content/announcements.json';
import seo from '../content/seo.json';

interface Section<T> {
  heading: string;
  items: T[];
}

interface Service {
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  image?: string;
  imageAlt?: string;
}

function section<T>(content: { heading: string; items?: T[] | null }): Section<T> {
  return { heading: content.heading, items: content.items ?? [] };
}

const business: {
  name: string;
  phone: string;
  email: string;
  address?: string;
  tagline: string;
  hours?: { days: string; hours: string }[];
} = businessContent;
const priceData: {
  groups?: {
    title: string;
    description?: string[];
    items?: { name: string; price: string; note?: string }[];
  }[];
} = pricingContent;

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly menuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();
  protected readonly business = { ...business, hours: business.hours ?? [] };
  protected readonly page = page;
  protected readonly services: { key: string; content: Service }[] = Object.entries(
    serviceContent,
  ).map(([key, content]) => ({
    key,
    content,
  }));
  protected readonly pricing = (priceData.groups ?? []).map((group) => ({
    ...group,
    items: group.items ?? [],
  }));
  protected readonly djPhotos = photos.dj;
  protected readonly firePhotos = photos.fire;
  protected readonly staff: Section<{
    name: string;
    role: string;
    bio: string;
    image: string;
    imageAlt: string;
  }> = section(staffContent);
  protected readonly testimonials: Section<{ name: string; quote: string; context?: string }> =
    section(testimonialContent);
  protected readonly faqs: Section<{ question: string; answer: string }> = section(faqContent);
  protected readonly announcements: Section<{ title: string; body: string }> =
    section(announcementContent);
  protected readonly emailHref =
    'mailto:' + encodeURIComponent(this.business.email) + '?subject=Event%20inquiry';
  protected readonly phoneHref = 'tel:' + this.business.phone.replace(/[^+\d]/g, '');

  constructor() {
    inject(Title).setTitle(seo.title);
    inject(Meta).updateTag({ name: 'description', content: seo.description });
    inject(Meta).updateTag({ property: 'og:title', content: seo.title });
    inject(Meta).updateTag({ property: 'og:description', content: seo.description });
  }

  protected photoBackground(src: string): string {
    return `url("${encodeURI(src).replace(/"/g, '%22')}")`;
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
