import {
  NoticeEnrichmentService,
  NOTICE_ENRICHMENT_TIMEOUT_MS,
} from './notice-enrichment.service';

const generate = jest.fn();
jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: (...args: unknown[]) => generate(...args) },
    })),
  };
});

describe('Notice AI generation and output validation', () => {
  const content =
    'Submit the registration form by 7 November 2026. Attend the orientation in Room 101.';
  const valid = {
    summary: 'Register for orientation.',
    deadlines: [
      {
        label: 'Registration',
        when: '7 November 2026',
        sourceQuote: 'Submit the registration form by 7 November 2026.',
      },
    ],
    actionItems: ['Submit the registration form.'],
    keyHighlights: ['Orientation is in Room 101.'],
    tags: ['orientation'],
  };
  const makeService = (key: string | undefined = 'synthetic-test-key') =>
    new NoticeEnrichmentService({
      get: (name: string) =>
        name === 'GEMINI_API_KEY' ? key : 'configured-test-model',
    } as any);
  beforeEach(() => {
    jest.clearAllMocks();
    generate.mockResolvedValue({ text: JSON.stringify(valid) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('calls the existing SDK with structured output and preserves source-backed deadlines', async () => {
    const result = await makeService().enrich('Orientation', content);
    expect(result).toEqual(valid);
    const args = generate.mock.calls[0][0];
    expect(args.model).toBe('configured-test-model');
    expect(JSON.parse(args.contents)).toEqual({
      title: 'Orientation',
      content,
    });
    expect(args.config.responseMimeType).toBe('application/json');
    expect(args.config.abortSignal).toBeDefined();
    expect(args.config.systemInstruction).toContain(
      'untrusted source material',
    );
  });
  it('does not call an external provider without an API key', async () => {
    const service = new NoticeEnrichmentService({
      get: () => undefined,
    } as any);
    await expect(service.enrich('Orientation', content)).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
  it('skips oversized input instead of generating incomplete highlights', async () => {
    await expect(
      makeService().enrich('Orientation', 'x'.repeat(40001)),
    ).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
  it('does not generate for an empty body', async () => {
    await expect(makeService().enrich('Title', '   ')).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
  it('returns unavailable on a provider error without exposing the raw exception', async () => {
    generate.mockRejectedValue(new Error('private provider request details'));
    await expect(
      makeService().enrich('Orientation', content),
    ).resolves.toBeNull();
  });
  it('bounds a hung provider call and aborts it', async () => {
    jest.useFakeTimers();
    generate.mockImplementation(() => new Promise(() => {}));
    const operation = makeService().enrich('Orientation', content);
    await jest.advanceTimersByTimeAsync(NOTICE_ENRICHMENT_TIMEOUT_MS);
    await expect(operation).resolves.toBeNull();
    expect(generate.mock.calls[0][0].config.abortSignal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(
    [
      'not json',
      '[]',
      'null',
      '{}',
      JSON.stringify({ ...valid, summary: '' }),
      JSON.stringify({ ...valid, summary: 'x'.repeat(1201) }),
      JSON.stringify({ ...valid, actionItems: ['valid', 123] }),
      JSON.stringify({ ...valid, tags: Array(11).fill('tag') }),
      JSON.stringify({ ...valid, deadlines: [{}] }),
      'x'.repeat(30001),
    ].map((text, index) => ({ text, index })),
  )('rejects malformed or oversized output case $index', async ({ text }) => {
    generate.mockResolvedValue({ text });
    await expect(
      makeService().enrich('Orientation', content),
    ).resolves.toBeNull();
  });
  it('drops hallucinated deadlines that have no matching source quotation', async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        ...valid,
        deadlines: [
          ...valid.deadlines,
          {
            label: 'Invented',
            when: '31 December',
            sourceQuote: 'Submit by 31 December.',
          },
        ],
      }),
    });
    const result = await makeService().enrich('Orientation', content);
    expect(result?.deadlines).toEqual(valid.deadlines);
  });
  it('drops normalized/inferred dates that were not copied from the source', async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        ...valid,
        deadlines: [{ ...valid.deadlines[0], when: '2026-11-07' }],
      }),
    });
    expect(
      (await makeService().enrich('Orientation', content))?.deadlines,
    ).toEqual([]);
  });
  it('trims and deduplicates list values and ignores unexpected control fields', async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        ...valid,
        tags: [' orientation ', 'orientation'],
        status: 'PUBLISHED',
        authorId: 'other',
      }),
    });
    const result = await makeService().enrich('Orientation', content);
    expect(result?.tags).toEqual(['orientation']);
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('authorId');
  });
});
