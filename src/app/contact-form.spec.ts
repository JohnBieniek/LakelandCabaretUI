import { TestBed } from '@angular/core/testing';
import { ContactForm } from './contact-form';

describe('ContactForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    await TestBed.configureTestingModule({ imports: [ContactForm] }).compileComponents();
    const fixture = TestBed.createComponent(ContactForm);
    fixture.componentRef.setInput('services', ['Music & DJ', 'Fire Performance']);
    fixture.componentRef.setInput('email', 'Contact@LakelandCabaret.com');
    await fixture.whenStable();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const values = {
      desiredDate: '2027-05-14',
      service: 'Music & DJ',
      name: 'Jane Visitor',
      email: 'jane@example.com',
      details: 'An outdoor wedding.',
    };
    for (const [name, value] of Object.entries(values)) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    const submit = async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, form, submit };
  }

  it('requires all five fields and does not submit an incomplete form', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { form, submit } = await setup();
    expect(form.querySelectorAll('[required]')).toHaveLength(5);
    (form.elements.namedItem('desiredDate') as HTMLInputElement).value = '';
    await submit();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains data and submission ID for an uncertain retry, then resets after confirmed storage', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          saved: true,
          queued: true,
          message: 'Your inquiry is safely saved.',
        }),
      });
    vi.stubGlobal('fetch', fetch);
    const { form, submit } = await setup();
    await submit();
    expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Jane Visitor');
    expect(form.querySelector('[role="status"]')?.textContent).toContain('could not confirm');
    await submit();
    const first = JSON.parse(fetch.mock.calls[0][1].body);
    const second = JSON.parse(fetch.mock.calls[1][1].body);
    expect(second.submissionId).toBe(first.submissionId);
    expect(second.desiredDate).toBe('2027-05-14');
    expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('');
  });

  it('uses a new ID when a failed submission is edited', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', fetch);
    const { form, submit } = await setup();
    await submit();
    (form.elements.namedItem('details') as HTMLTextAreaElement).value = 'Updated event plans.';
    await submit();
    expect(JSON.parse(fetch.mock.calls[0][1].body).submissionId).not.toBe(
      JSON.parse(fetch.mock.calls[1][1].body).submissionId,
    );
  });

  it('only resets saved inquiries and displays delivery delays accurately', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, saved: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          saved: true,
          queued: false,
          message: 'Saved, but delivery is delayed.',
        }),
      });
    vi.stubGlobal('fetch', fetch);
    const { form, submit } = await setup();
    await submit();
    expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Jane Visitor');
    await submit();
    expect(form.querySelector('.form-status.warning')?.textContent).toContain(
      'delivery is delayed',
    );
  });
});
