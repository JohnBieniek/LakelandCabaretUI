import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Meta, Title } from '@angular/platform-browser';
import seo from '../content/seo.json';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the hero message', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Every event');
  });

  it('uses content for SEO and contact links and hides empty optional sections', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Title).getTitle()).toBe(seo.title);
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(seo.description);
    expect(element.querySelector('a[href^="mailto:"]')?.textContent).toContain(
      'Contact@LakelandCabaret.com',
    );
    expect(element.querySelector('#faq-heading')).toBeNull();
    expect(element.querySelector('#staff-heading')).toBeNull();
  });

  it('renders new content safely and keeps slideshows when services are renamed', async () => {
    const fixture = TestBed.createComponent(App);
    Object.assign(fixture.componentInstance, {
      services: [
        {
          key: 'music',
          content: {
            title: 'Celebration DJs',
            eyebrow: 'Music',
            description: 'Your playlist',
            detail: 'Call us',
          },
        },
      ],
      faqs: {
        heading: 'Your questions',
        items: [{ question: 'Where do you travel?', answer: '<script>alert(1)</script>' }],
      },
      staff: {
        heading: 'Our people',
        items: [
          {
            name: 'Test performer',
            role: 'DJ',
            bio: 'New profile',
            image: '/images/portrait.webp',
            imageAlt: 'Test portrait',
          },
        ],
      },
      testimonials: {
        heading: 'Reviews',
        items: [{ name: 'Test client', quote: 'Wonderful evening!' }],
      },
      announcements: {
        heading: 'News',
        items: [{ title: 'Booking now', body: 'Contact us for dates.' }],
      },
      business: {
        name: 'Lakeland Cabaret',
        hours: [{ days: 'Monday', hours: 'By appointment' }],
        address: 'Mid-Michigan',
      },
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.service-card h3')?.textContent).toContain('Celebration DJs');
    expect(element.querySelectorAll('.dj-slideshow img').length).toBe(10);
    expect(element.querySelector('details p')?.textContent).toBe('<script>alert(1)</script>');
    expect(element.querySelector('details script')).toBeNull();
    expect(element.querySelector('#staff-heading')?.textContent).toBe('Our people');
    expect(element.querySelector('blockquote')?.textContent).toBe('Wonderful evening!');
    expect(element.querySelector('#announcements-heading')?.textContent).toBe('News');
    expect(element.querySelector('.business-hours')?.textContent).toContain('By appointment');
  });
});
