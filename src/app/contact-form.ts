import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

interface SubmissionResult {
  ok?: boolean;
  saved?: boolean;
  queued?: boolean;
  message?: string;
}

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.html',
  styleUrl: './contact-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactForm {
  readonly services = input.required<string[]>();
  readonly email = input.required<string>();
  protected readonly status = signal<'idle' | 'sending' | 'sent' | 'warning' | 'error'>('idle');
  protected readonly message = signal('Your information is used only to respond to your inquiry.');
  private submission: { id: string; fields: string } | null = null;

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.status() === 'sending') return;
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    for (const key of ['desiredDate', 'service', 'name', 'email', 'details']) {
      if (typeof fields[key] !== 'string' || !fields[key].trim()) {
        this.status.set('error');
        this.message.set('Please complete every required field.');
        return;
      }
      fields[key] = fields[key].trim();
    }
    const serialized = JSON.stringify(fields);
    this.status.set('sending');
    this.message.set('Saving your inquiry…');
    try {
      // An unchanged retry keeps its ID; edited inquiries receive a new ID.
      if (this.submission?.fields !== serialized) {
        this.submission = { id: crypto.randomUUID(), fields: serialized };
      }
      const response = await fetch('https://lakeland-contact-form.johnbieniekgt.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, submissionId: this.submission.id }),
        signal: AbortSignal.timeout(20_000),
      });
      const result: SubmissionResult | null = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || !result.saved) {
        this.status.set('error');
        this.message.set(
          result?.message ??
            `We could not save your inquiry. Please try again or email ${this.email()} directly.`,
        );
        return;
      }
      form.reset();
      this.submission = null;
      this.status.set(result.queued === false ? 'warning' : 'sent');
      this.message.set(result.message ?? 'Thanks—your inquiry is safely saved.');
    } catch {
      this.status.set('error');
      this.message.set(
        `We could not confirm your inquiry was saved. Please try again; an unchanged submission will not be duplicated. You can also email ${this.email()} directly.`,
      );
    }
  }
}
